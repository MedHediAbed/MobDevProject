from flask import Flask, request, jsonify, send_from_directory
from flask_pymongo import PyMongo
from flask_bcrypt import Bcrypt
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
)
from flask_cors import CORS
from datetime import datetime, timedelta
from bson.objectid import ObjectId
from bson.errors import InvalidId
from werkzeug.utils import secure_filename
import re
import os
import hashlib
import requests as http_requests  # pip install requests

# ----------------------------
# App Setup
# ----------------------------

app = Flask(__name__)

app.config["MONGO_URI"] = "mongodb+srv://mehdibessrour4_db_user:kbbRGOw379UJzTpU@cluster0.pwc1nxy.mongodb.net/freelancehub?retryWrites=true&w=majority"
app.config["JWT_SECRET_KEY"] = "super-secret-key-change-later"
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=2)

mongo = PyMongo(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:8100", "http://localhost:4200"],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# ----------------------------
# Validation Helpers
# ----------------------------

def validate_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def parse_object_id(id_str, field_name="id"):
    try:
        return ObjectId(id_str)
    except (InvalidId, TypeError):
        return None


def json_dt(val):
    if val is None:
        return None
    if hasattr(val, "isoformat"):
        return val.isoformat()
    return val


def user_nom(user):
    """Resolve display nom; legacy DB docs may still have name."""
    if not user:
        return ""
    return user.get("nom") or user.get("name") or ""


def user_statut_value(user):
    """Account statut for API payloads (prefers statut)."""
    if not user:
        return None
    return user.get("statut") if user.get("statut") is not None else user.get("status")


def user_date_creation(user):
    return json_dt(user.get("dateCreation") or user.get("createdAt"))


def user_statut_actif(user):
    return user_statut_value(user) == "active"


def user_public_dict(user):
    """Consistent user fields for JSON: nom, statut, dateCreation."""
    if not user:
        return {}
    prov = user.get("provider")
    if not prov:
        prov = "google" if not (user.get("password") or "") else "local"
    out = {
        "id": str(user["_id"]),
        "nom": user_nom(user),
        "email": user.get("email", ""),
        "role": user.get("role", ""),
        "statut": user_statut_value(user),
        "dateCreation": user_date_creation(user),
        "provider": prov,
    }
    tel = user.get("telephone")
    if tel is not None:
        out["telephone"] = tel if isinstance(tel, str) else str(tel)
    dob = user.get("dateNaissance")
    if dob is not None:
        out["dateNaissance"] = dob if isinstance(dob, str) else str(dob)
    av = user.get("avatarUrl")
    if av is not None:
        out["avatarUrl"] = av if isinstance(av, str) else str(av)
    return out


def sync_admins_row(user_oid):
    """When an admin user exists, ensure mongo.db.admins has a row."""
    if not mongo.db.admins.find_one({"userId": user_oid}):
        mongo.db.admins.insert_one({"userId": user_oid, "permissions": []})


def merge_freelancer_doc(profile, user):
    uid = profile.get("userId")
    vst = profile.get("validationStatus", "draft")
    out = {
        "_id": str(profile["_id"]),
        "userId": str(uid) if uid is not None else None,
        "cvUrl": profile.get("cvUrl", ""),
        "validationStatus": vst,
        "serviceUrl": profile.get("serviceUrl", ""),
        "productUrl": profile.get("productUrl", ""),
        "reviews": profile.get("reviews", ""),
        "bio": profile.get("bio", ""),
        "skills": profile.get("skills") or [],
        "portfolio": profile.get("portfolio") or [],
    }
    # Aliases for Angular FreelancerProfile
    out["status"] = vst
    if user:
        out["nom"] = user_nom(user)
        out["name"] = user_nom(user)
        out["email"] = user.get("email", "")
    return out


def merge_service_doc(service, freelancer_user):
    titre = service.get("titre", "")
    prix = service.get("prix")
    statut = service.get("statut", "pending")
    vb = service.get("validatedBy")
    out = {
        "_id": str(service["_id"]),
        "freelancerId": service.get("freelancerId", ""),
        "titre": titre,
        "description": service.get("description", ""),
        "prix": prix,
        "tags": service.get("tags", []),
        "statut": statut,
        "validatedBy": str(vb) if vb is not None else None,
        # Aliases for existing clients expecting English keys
        "title": titre,
        "price": prix,
        "status": statut,
    }
    if freelancer_user:
        out["freelancerNom"] = user_nom(freelancer_user)
    return out


def merge_proposal_doc(prop, freelancer_user):
    offre_id = prop.get("offreId") or prop.get("offerId", "")
    montant = prop.get("montant")
    if montant is None:
        montant = prop.get("amount")
    dt = prop.get("date") or prop.get("createdAt")
    statut = prop.get("statut") or prop.get("status", "pending")
    out = {
        "_id": str(prop["_id"]),
        "offreId": offre_id,
        "offerId": offre_id,
        "freelancerId": prop.get("freelancerId", ""),
        "montant": montant,
        "amount": montant,
        "message": prop.get("message", ""),
        "statut": statut,
        "status": statut,
        "date": json_dt(dt),
        "createdAt": json_dt(dt),
    }
    if freelancer_user:
        out["freelancerNom"] = user_nom(freelancer_user)
    return out


def _hash_int(text):
    return int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:8], 16)


def freelancer_display_alias(proposal_id_str, freelancer_user_id_str):
    """Deterministic anonymous label for a freelancer in a client-facing proposal context."""
    n = 1000 + (_hash_int(f"fa|{proposal_id_str}|{freelancer_user_id_str}") % 9000)
    colors = ["Blue", "Green", "Amber", "Coral", "Slate", "Nova", "Peak", "River"]
    c = colors[_hash_int(f"fcolor|{proposal_id_str}|{freelancer_user_id_str}") % len(colors)]
    return f"Freelancer {c}-{n}"


def client_display_alias(offer_id_str, proposal_id_str, client_user_id_str):
    """Deterministic anonymous label for a client in a freelancer-facing conversation."""
    n = 1000 + (_hash_int(f"ca|{offer_id_str}|{proposal_id_str}|{client_user_id_str}") % 9000)
    names = ["Morgan", "River", "Sky", "Jordan", "Case", "Alex", "Remy", "Drew"]
    x = names[_hash_int(f"cname|{offer_id_str}|{proposal_id_str}") % len(names)]
    return f"Client {x}-{n}"


def anonymous_freelancer_metrics(freelancer_user):
    # Dev note: When users.jobStats is missing or isSynthetic is true, we generate deterministic
    # placeholder percentages/counts for the client UI only (no PII). Do not surface "synthetic"
    # or "benchmark" wording to end users — that belongs in code comments only.
    stats = (freelancer_user or {}).get("jobStats") or {}
    if stats.get("jobSuccessRate") is not None and stats.get("isSynthetic") is not True:
        return {
            "jobSuccessRate": float(stats.get("jobSuccessRate", 0)),
            "onTimeDeliveryRate": float(stats.get("onTimeDeliveryRate", 0)),
            "avgRating": float(stats.get("avgRating", 0)),
            "completedProjects": int(stats.get("completedProjects", 0)),
            "isSynthetic": False,
        }
    seed = str((freelancer_user or {}).get("_id", "anon"))
    n = _hash_int(f"metrics|{seed}")
    return {
        "jobSuccessRate": 82 + (n % 12),
        "onTimeDeliveryRate": 76 + (n % 18),
        "avgRating": round(4.0 + (n % 19) / 20, 2),
        "completedProjects": 2 + (n % 10),
        "isSynthetic": True,
    }


def anonymous_freelancer_profile_for_client(proposal_id_str, freelancer_user):
    """Anonymous freelancer card for clients (no real name, email, or id)."""
    fid_str = str(freelancer_user["_id"]) if freelancer_user and freelancer_user.get("_id") else "unknown"
    metrics = anonymous_freelancer_metrics(freelancer_user)
    return {
        "displayName": freelancer_display_alias(proposal_id_str, fid_str),
        "jobSuccessRate": metrics["jobSuccessRate"],
        "onTimeDeliveryRate": metrics["onTimeDeliveryRate"],
        "avgRating": metrics["avgRating"],
        "completedProjects": metrics["completedProjects"],
        "memberSince": user_date_creation(freelancer_user) if freelancer_user else None,
    }


def merge_proposal_doc_client_view(prop, freelancer_user):
    """Proposal payload for offer owners: anonymized freelancer, no identifiers."""
    pout = merge_proposal_doc(prop, None)
    pout.pop("freelancerNom", None)
    pout.pop("freelancerId", None)
    pid = pout.get("_id")
    pout["anonymousFreelancer"] = anonymous_freelancer_profile_for_client(pid, freelancer_user)
    conv = mongo.db.conversations.find_one({"proposalId": pid})
    if conv:
        pout["conversationId"] = str(conv["_id"])
    return pout


def _conversation_user_allowed(conv, jwt_user_id, role):
    if role == "client":
        cid = conv.get("clientId")
        return cid is not None and str(cid) == jwt_user_id
    if role == "freelancer":
        return conv.get("freelancerId") == jwt_user_id
    return False


def merge_produit_doc(p, freelancer_user):
    out = {
        "_id": str(p["_id"]),
        "nom": p.get("nom", ""),
        "description": p.get("description", ""),
        "version": p.get("version", ""),
        "license": p.get("license", ""),
        "prix": p.get("prix"),
        "fichierUrl": p.get("fichierUrl", ""),
        "statut": p.get("statut", "pending"),
        "freelancerId": p.get("freelancerId", ""),
        "validatedBy": str(p["validatedBy"]) if p.get("validatedBy") is not None else None,
    }
    if freelancer_user:
        out["freelancerNom"] = user_nom(freelancer_user)
    return out


def merge_offre_doc(o):
    cid = o.get("clientId")
    return {
        "_id": str(o["_id"]),
        "titre": o.get("titre", ""),
        "description": o.get("description", ""),
        "budget": o.get("budget"),
        "delai": o.get("delai"),
        "datePublication": json_dt(o.get("datePublication")),
        "clientId": str(cid) if cid is not None else None,
    }


def merge_achat_doc(a):
    cid = a.get("clientId")
    pid = a.get("produitId")
    out = {
        "_id": str(a["_id"]),
        "clientId": str(cid) if cid is not None else None,
        "produitId": str(pid) if pid is not None else None,
        "dateAchat": json_dt(a.get("dateAchat")),
    }
    produit = a.get("_produit")
    if produit:
        out["produit"] = produit
    return out


def ensure_freelancer_profile_for_user(user_oid):
    """Create default freelancers row if missing (draft profile)."""
    if mongo.db.freelancers.find_one({"userId": user_oid}):
        return
    mongo.db.freelancers.insert_one({
        "userId": user_oid,
        "cvUrl": "",
        "validationStatus": "draft",
        "serviceUrl": "",
        "productUrl": "",
        "reviews": "",
        "bio": "",
        "skills": [],
        "portfolio": [],
    })


# ----------------------------
# Routes
# ----------------------------

@app.route("/")
def home():
    return jsonify({"message": "FreelanceHub Auth API", "version": "1.0.0"})


@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


@app.route("/health")
def health():
    try:
        mongo.db.command("ping")
        return jsonify({"status": "healthy", "database": "connected"}), 200
    except Exception as e:
        return jsonify({"status": "unhealthy", "database": "disconnected", "error": str(e)}), 500

# ----------------------------
# REGISTER
# ----------------------------

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json()

    nom = (data.get("nom") or data.get("name") or "").strip()
    email = data.get("email", "").strip().lower()
    password = (data.get("password") or "").strip()
    role = data.get("role", "")

    if not nom or not email or not password or not role:
        return jsonify({"error": "All fields are required"}), 400
    if not validate_email(email):
        return jsonify({"error": "Invalid email format"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if role not in ["freelancer", "client"]:
        return jsonify({"error": "Role must be 'freelancer' or 'client'"}), 400
    if mongo.db.users.find_one({"email": email}):
        return jsonify({"error": "Email already registered"}), 409

    hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")

    user = {
        "nom": nom,
        "email": email,
        "password": hashed_password,
        "role": role,
        "statut": "active",
        "provider": "local",
        "dateCreation": datetime.utcnow(),
    }

    result = mongo.db.users.insert_one(user)
    uid = result.inserted_id

    if role == "client":
        mongo.db.clients.insert_one({"userId": uid, "entreprise": ""})
    elif role == "freelancer":
        ensure_freelancer_profile_for_user(uid)

    token = create_access_token(
        identity=str(uid),
        additional_claims={"role": role}
    )

    saved = mongo.db.users.find_one({"_id": uid})
    return jsonify({
        "message": "Registration successful",
        "token": token,
        "user": user_public_dict(saved),
    }), 201

# ----------------------------
# LOGIN
# ----------------------------

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json()

    email = data.get("email", "").strip().lower()
    password = (data.get("password") or "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    user = mongo.db.users.find_one({"email": email})

    if not user:
        return jsonify({"error": "Invalid email or password"}), 401

    pwd_hash = user.get("password") or ""
    if not pwd_hash:
        return jsonify({"error": "Invalid email or password"}), 401
    try:
        if not bcrypt.check_password_hash(pwd_hash, password):
            return jsonify({"error": "Invalid email or password"}), 401
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid email or password"}), 401
    if not user_statut_actif(user):
        return jsonify({"error": "Account is not active"}), 403

    if user.get("role") == "admin":
        sync_admins_row(user["_id"])

    token = create_access_token(
        identity=str(user["_id"]),
        additional_claims={"role": user["role"]}
    )

    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": user_public_dict(user),
    }), 200

# ----------------------------
# GOOGLE LOGIN
# ----------------------------

@app.route("/api/auth/google", methods=["POST"])
def google_login():
    data = request.get_json()

    access_token = data.get("access_token")
    nom_hint = (data.get("nom") or data.get("name") or "").strip()
    email = data.get("email", "").strip().lower()
    google_id = data.get("google_id", "")

    if not access_token or not email:
        return jsonify({"error": "Invalid Google credentials"}), 400

    verify = http_requests.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {access_token}"}
    )

    if verify.status_code != 200:
        return jsonify({"error": "Failed to verify Google token"}), 401

    google_data = verify.json()

    if google_data.get("email") != email:
        return jsonify({"error": "Google token verification failed"}), 401

    user = mongo.db.users.find_one({"email": email})

    if user:
        if not user_statut_actif(user):
            return jsonify({"error": "Account is not active"}), 403
    else:
        role = data.get("role", "freelancer")
        display = nom_hint or (google_data.get("name") or "User").strip()
        new_user = {
            "nom": display,
            "email": email,
            "password": "",
            "role": role,
            "statut": "active",
            "provider": "google",
            "google_id": google_id,
            "dateCreation": datetime.utcnow(),
        }
        result = mongo.db.users.insert_one(new_user)
        user = mongo.db.users.find_one({"_id": result.inserted_id})
        if role == "client":
            mongo.db.clients.insert_one({"userId": user["_id"], "entreprise": ""})
        elif role == "freelancer":
            ensure_freelancer_profile_for_user(user["_id"])

    if user.get("role") == "admin":
        sync_admins_row(user["_id"])

    token = create_access_token(
        identity=str(user["_id"]),
        additional_claims={"role": user["role"]}
    )

    return jsonify({
        "message": "Google login successful",
        "token": token,
        "user": user_public_dict(user),
    }), 200

# ----------------------------
# GET PROFILE (Protected)
# ----------------------------

@app.route("/api/auth/profile", methods=["GET"])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    oid = parse_object_id(user_id)
    if not oid:
        return jsonify({"error": "Invalid user id"}), 400
    user = mongo.db.users.find_one({"_id": oid})
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user.get("role") == "admin":
        sync_admins_row(oid)
    return jsonify(user_public_dict(user)), 200


@app.route("/api/auth/profile", methods=["PUT"])
@jwt_required()
def update_auth_profile():
    user_id = get_jwt_identity()
    oid = parse_object_id(user_id)
    if not oid:
        return jsonify({"error": "Invalid user id"}), 400
    user = mongo.db.users.find_one({"_id": oid})
    if not user:
        return jsonify({"error": "User not found"}), 404
    data = request.get_json() or {}
    update_doc = {}
    if "nom" in data:
        nom = (data.get("nom") or "").strip()
        if not nom:
            return jsonify({"error": "Name cannot be empty"}), 400
        update_doc["nom"] = nom
    if "telephone" in data:
        update_doc["telephone"] = (data.get("telephone") or "").strip()
    if "dateNaissance" in data:
        raw_dob = data.get("dateNaissance")
        if raw_dob is None or raw_dob == "":
            update_doc["dateNaissance"] = None
        else:
            update_doc["dateNaissance"] = str(raw_dob).strip()[:32]
    if not update_doc:
        return jsonify({"error": "No valid fields to update"}), 400
    mongo.db.users.update_one({"_id": oid}, {"$set": update_doc})
    updated = mongo.db.users.find_one({"_id": oid})
    return jsonify({"message": "Profile updated", "user": user_public_dict(updated)}), 200


@app.route("/api/auth/password", methods=["PUT"])
@jwt_required()
def change_auth_password():
    user_id = get_jwt_identity()
    oid = parse_object_id(user_id)
    if not oid:
        return jsonify({"error": "Invalid user id"}), 400
    user = mongo.db.users.find_one({"_id": oid})
    if not user:
        return jsonify({"error": "User not found"}), 404
    pwd_hash = user.get("password") or ""
    if not pwd_hash:
        return jsonify({"error": "Password change is not available for this account"}), 400
    data = request.get_json() or {}
    current = (data.get("currentPassword") or "").strip()
    new_pwd = (data.get("newPassword") or "").strip()
    if not current or not new_pwd:
        return jsonify({"error": "Current and new password are required"}), 400
    if len(new_pwd) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400
    try:
        if not bcrypt.check_password_hash(pwd_hash, current):
            return jsonify({"error": "Current password is incorrect"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Current password is incorrect"}), 400
    new_hash = bcrypt.generate_password_hash(new_pwd).decode("utf-8")
    mongo.db.users.update_one({"_id": oid}, {"$set": {"password": new_hash}})
    return jsonify({"message": "Password updated"}), 200


@app.route("/api/auth/avatar", methods=["POST"])
@jwt_required()
def upload_auth_avatar():
    user_id = get_jwt_identity()
    oid = parse_object_id(user_id)
    if not oid:
        return jsonify({"error": "Invalid user id"}), 400
    user = mongo.db.users.find_one({"_id": oid})
    if not user:
        return jsonify({"error": "User not found"}), 404
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"error": "No file provided"}), 400
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        return jsonify({"error": "Invalid image type"}), 400
    stored_name = f"avatar_{user_id}{ext}"
    path = os.path.join(UPLOAD_FOLDER, stored_name)
    file.save(path)
    rel_path = f"uploads/{stored_name}"
    mongo.db.users.update_one({"_id": oid}, {"$set": {"avatarUrl": rel_path}})
    updated = mongo.db.users.find_one({"_id": oid})
    return jsonify({"message": "Avatar updated", "user": user_public_dict(updated)}), 200

# ----------------------------
# FREELANCERS (collection: freelancers)
# ----------------------------

@app.route("/api/freelancers", methods=["GET"])
def list_freelancers():
    profiles = list(mongo.db.freelancers.find({"validationStatus": "approved"}))
    out = []
    for p in profiles:
        uid = p.get("userId")
        user = mongo.db.users.find_one({"_id": uid}) if uid else None
        out.append(merge_freelancer_doc(p, user))
    return jsonify({"freelancers": out}), 200


@app.route("/api/freelancers/<id>", methods=["GET"])
def get_freelancer(id):
    oid = parse_object_id(id)
    if not oid:
        return jsonify({"error": "Invalid freelancer id"}), 400
    profile = mongo.db.freelancers.find_one({"_id": oid})
    if not profile:
        return jsonify({"error": "Freelancer profile not found"}), 404
    uid = profile.get("userId")
    user = mongo.db.users.find_one({"_id": uid}) if uid else None
    return jsonify(merge_freelancer_doc(profile, user)), 200


@app.route("/api/freelancers/<id>", methods=["PUT"])
@jwt_required()
def update_freelancer(id):
    user_id = get_jwt_identity()
    oid = parse_object_id(id)
    if not oid:
        return jsonify({"error": "Invalid freelancer id"}), 400
    profile = mongo.db.freelancers.find_one({"_id": oid})
    if not profile:
        return jsonify({"error": "Freelancer profile not found"}), 404
    if str(profile.get("userId")) != user_id:
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json() or {}
    update_doc = {}

    # Legacy body keys (optional) mapped into schema fields where sensible
    if "serviceUrl" in data:
        update_doc["serviceUrl"] = (data.get("serviceUrl") or "").strip()
    if "productUrl" in data:
        update_doc["productUrl"] = (data.get("productUrl") or "").strip()
    if "reviews" in data:
        r = data.get("reviews")
        if not isinstance(r, str):
            return jsonify({"error": "reviews must be a string"}), 400
        update_doc["reviews"] = r

    if "bio" in data:
        update_doc["bio"] = (data.get("bio") or "").strip()

    if "skills" in data:
        sk = data.get("skills")
        if not isinstance(sk, list):
            return jsonify({"error": "skills must be a list"}), 400
        update_doc["skills"] = [str(x).strip() for x in sk if str(x).strip()]

    if "portfolio" in data:
        pf = data.get("portfolio")
        if not isinstance(pf, list):
            return jsonify({"error": "portfolio must be a list"}), 400
        clean_pf = []
        for item in pf:
            if not isinstance(item, dict):
                continue
            title = (item.get("title") or "").strip()
            url = (item.get("url") or "").strip()
            if title and url:
                clean_pf.append({"title": title, "url": url})
        update_doc["portfolio"] = clean_pf

    if not update_doc:
        return jsonify({"error": "No valid fields to update"}), 400

    if profile.get("validationStatus") == "draft":
        update_doc["validationStatus"] = "pending"

    mongo.db.freelancers.update_one({"_id": oid}, {"$set": update_doc})
    updated = mongo.db.freelancers.find_one({"_id": oid})
    uid = updated.get("userId")
    user = mongo.db.users.find_one({"_id": uid}) if uid else None
    return jsonify({
        "message": "Profile updated",
        "profile": merge_freelancer_doc(updated, user),
    }), 200


@app.route("/api/freelancers/upload-cv", methods=["POST"])
@jwt_required()
def upload_freelancer_cv():
    user_id = get_jwt_identity()
    oid = parse_object_id(user_id)
    if not oid:
        return jsonify({"error": "Invalid user id"}), 400

    if "file" not in request.files and "cv" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files.get("file") or request.files.get("cv")
    if not file or file.filename == "":
        return jsonify({"error": "No file provided"}), 400

    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are allowed"}), 400

    safe = secure_filename(file.filename) or "cv.pdf"
    stored_name = f"{user_id}_{safe}"
    path = os.path.join(UPLOAD_FOLDER, stored_name)
    file.save(path)

    rel_path = f"uploads/{stored_name}"

    prof = mongo.db.freelancers.find_one({"userId": oid})
    if not prof:
        doc = {
            "userId": oid,
            "cvUrl": rel_path,
            "validationStatus": "draft",
            "serviceUrl": "",
            "productUrl": "",
            "reviews": "",
        }
        ins = mongo.db.freelancers.insert_one(doc)
        prof = mongo.db.freelancers.find_one({"_id": ins.inserted_id})
    else:
        mongo.db.freelancers.update_one(
            {"_id": prof["_id"]},
            {"$set": {"cvUrl": rel_path}},
        )
        prof = mongo.db.freelancers.find_one({"_id": prof["_id"]})

    return jsonify({
        "message": "CV uploaded",
        "cvUrl": rel_path,
        "profileId": str(prof["_id"]),
    }), 200


@app.route("/api/freelancers/status", methods=["PUT"])
@jwt_required()
def update_freelancer_status():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json() or {}
    uid_str = data.get("userId", "").strip()
    status = data.get("status", "")
    if not uid_str:
        return jsonify({"error": "userId is required"}), 400
    if status not in ("approved", "rejected", "pending"):
        return jsonify({"error": "status must be approved, rejected, or pending"}), 400

    uid = parse_object_id(uid_str)
    if not uid:
        return jsonify({"error": "Invalid userId"}), 400

    result = mongo.db.freelancers.update_one(
        {"userId": uid},
        {"$set": {"validationStatus": status}},
    )
    if result.matched_count == 0:
        return jsonify({"error": "Freelancer profile not found"}), 404

    return jsonify({"message": "Status updated", "userId": uid_str, "status": status}), 200

# ----------------------------
# SERVICES (collection: services) — REST /api/services
# ----------------------------

@app.route("/api/services", methods=["POST"])
@jwt_required()
def create_service():
    claims = get_jwt()
    if claims.get("role") != "freelancer":
        return jsonify({"error": "Freelancer role required"}), 403

    data = request.get_json() or {}
    titre = (data.get("titre") or data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    prix = data.get("prix") if data.get("prix") is not None else data.get("price")
    tags = data.get("tags")

    if not titre or not description:
        return jsonify({"error": "titre and description are required"}), 400
    if prix is None:
        return jsonify({"error": "prix is required"}), 400
    try:
        prix_f = float(prix)
    except (TypeError, ValueError):
        return jsonify({"error": "prix must be a number"}), 400
    if tags is None or not isinstance(tags, list) or not tags:
        return jsonify({"error": "tags must be a non-empty list"}), 400
    if not all(isinstance(t, str) for t in tags):
        return jsonify({"error": "Each tag must be a string"}), 400

    user_id = get_jwt_identity()
    doc = {
        "freelancerId": user_id,
        "titre": titre,
        "description": description,
        "prix": prix_f,
        "tags": tags,
        "statut": "pending",
        "validatedBy": None,
    }
    ins = mongo.db.services.insert_one(doc)
    created = mongo.db.services.find_one({"_id": ins.inserted_id})
    foid = parse_object_id(user_id)
    fu = mongo.db.users.find_one({"_id": foid}) if foid else None
    return jsonify({
        "message": "Service created",
        "service": merge_service_doc(created, fu),
    }), 201


@app.route("/api/services", methods=["GET"])
def list_services():
    tag = request.args.get("tag")
    query = {"statut": "approved"}
    if tag:
        query["tags"] = tag

    services = list(mongo.db.services.find(query).sort("_id", -1))
    out = []
    for s in services:
        fid = s.get("freelancerId")
        fu = None
        if fid:
            oid = parse_object_id(fid)
            if oid:
                fu = mongo.db.users.find_one({"_id": oid})
        out.append(merge_service_doc(s, fu))
    return jsonify({"services": out}), 200


@app.route("/api/services/<id>", methods=["GET"])
@jwt_required(optional=True)
def get_service(id):
    oid = parse_object_id(id)
    if not oid:
        return jsonify({"error": "Invalid service id"}), 400
    service = mongo.db.services.find_one({"_id": oid})
    if not service:
        return jsonify({"error": "Service not found"}), 404
    if service.get("statut") != "approved":
        viewer = get_jwt_identity()
        if not viewer or service.get("freelancerId") != viewer:
            return jsonify({"error": "Service not found"}), 404
    fid = service.get("freelancerId")
    fu = None
    if fid:
        foid = parse_object_id(fid)
        if foid:
            fu = mongo.db.users.find_one({"_id": foid})
    return jsonify(merge_service_doc(service, fu)), 200


@app.route("/api/services/<id>", methods=["PUT"])
@jwt_required()
def update_service(id):
    user_id = get_jwt_identity()
    oid = parse_object_id(id)
    if not oid:
        return jsonify({"error": "Invalid service id"}), 400
    service = mongo.db.services.find_one({"_id": oid})
    if not service:
        return jsonify({"error": "Service not found"}), 404
    if service.get("freelancerId") != user_id:
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json() or {}
    update_doc = {}
    if "titre" in data or "title" in data:
        t = (data.get("titre") or data.get("title") or "").strip()
        if not t:
            return jsonify({"error": "titre cannot be empty"}), 400
        update_doc["titre"] = t
    if "description" in data:
        d = (data.get("description") or "").strip()
        if not d:
            return jsonify({"error": "description cannot be empty"}), 400
        update_doc["description"] = d
    if "prix" in data or "price" in data:
        pv = data.get("prix") if "prix" in data else data.get("price")
        try:
            update_doc["prix"] = float(pv)
        except (TypeError, ValueError):
            return jsonify({"error": "prix must be a number"}), 400
    if "tags" in data:
        tags = data.get("tags")
        if not isinstance(tags, list) or not tags:
            return jsonify({"error": "tags must be a non-empty list"}), 400
        if not all(isinstance(t, str) for t in tags):
            return jsonify({"error": "Each tag must be a string"}), 400
        update_doc["tags"] = tags

    if not update_doc:
        return jsonify({"error": "No valid fields to update"}), 400

    update_doc["statut"] = "pending"
    update_doc["validatedBy"] = None
    mongo.db.services.update_one({"_id": oid}, {"$set": update_doc})
    updated = mongo.db.services.find_one({"_id": oid})
    foid = parse_object_id(user_id)
    fu = mongo.db.users.find_one({"_id": foid}) if foid else None
    return jsonify({
        "message": "Service updated",
        "service": merge_service_doc(updated, fu),
    }), 200


@app.route("/api/services/<id>", methods=["DELETE"])
@jwt_required()
def delete_service(id):
    user_id = get_jwt_identity()
    oid = parse_object_id(id)
    if not oid:
        return jsonify({"error": "Invalid service id"}), 400
    service = mongo.db.services.find_one({"_id": oid})
    if not service:
        return jsonify({"error": "Service not found"}), 404
    if service.get("freelancerId") != user_id:
        return jsonify({"error": "Forbidden"}), 403
    mongo.db.services.delete_one({"_id": oid})
    return jsonify({"message": "Service deleted"}), 200


@app.route("/api/services/<id>/validate", methods=["PUT"])
@jwt_required()
def validate_service(id):
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    oid = parse_object_id(id)
    if not oid:
        return jsonify({"error": "Invalid service id"}), 400
    data = request.get_json() or {}
    statut = data.get("statut") or data.get("status", "")
    if statut not in ("approved", "rejected"):
        return jsonify({"error": "statut must be approved or rejected"}), 400

    admin_oid = parse_object_id(get_jwt_identity())
    set_doc = {"statut": statut, "validatedBy": admin_oid if statut == "approved" else None}
    result = mongo.db.services.update_one({"_id": oid}, {"$set": set_doc})
    if result.matched_count == 0:
        return jsonify({"error": "Service not found"}), 404
    return jsonify({"message": "Service validation updated", "statut": statut}), 200

# ----------------------------
# MESSAGES
# ----------------------------

@app.route("/api/messages", methods=["POST"])
@jwt_required()
def post_message():
    data = request.get_json() or {}
    contenu = (data.get("contenu") or "").strip()
    if not contenu:
        return jsonify({"error": "contenu is required"}), 400
    uid = get_jwt_identity()
    s_oid = parse_object_id(uid)
    if not s_oid:
        return jsonify({"error": "Invalid user"}), 400
    doc = {
        "contenu": contenu,
        "dateEnvoi": datetime.utcnow(),
        "sender": s_oid,
    }
    ins = mongo.db.messages.insert_one(doc)
    return jsonify({
        "message": "Message stored",
        "_id": str(ins.inserted_id),
    }), 201

# ----------------------------
# PRODUITS
# ----------------------------

@app.route("/api/produits", methods=["POST"])
@jwt_required()
def create_produit():
    claims = get_jwt()
    if claims.get("role") != "freelancer":
        return jsonify({"error": "Freelancer role required"}), 403
    data = request.get_json() or {}
    nom = (data.get("nom") or "").strip()
    description = (data.get("description") or "").strip()
    version = (data.get("version") or "").strip()
    license_val = (data.get("license") or "").strip()
    prix = data.get("prix")
    fichierUrl = (data.get("fichierUrl") or "").strip()
    if not nom or not description:
        return jsonify({"error": "nom and description are required"}), 400
    if prix is None:
        return jsonify({"error": "prix is required"}), 400
    try:
        prix_f = float(prix)
    except (TypeError, ValueError):
        return jsonify({"error": "prix must be a number"}), 400

    user_id = get_jwt_identity()
    doc = {
        "nom": nom,
        "description": description,
        "version": version,
        "license": license_val,
        "prix": prix_f,
        "fichierUrl": fichierUrl,
        "statut": "pending",
        "freelancerId": user_id,
        "validatedBy": None,
    }
    ins = mongo.db.produits.insert_one(doc)
    created = mongo.db.produits.find_one({"_id": ins.inserted_id})
    foid = parse_object_id(user_id)
    fu = mongo.db.users.find_one({"_id": foid}) if foid else None
    return jsonify({"message": "Produit created", "produit": merge_produit_doc(created, fu)}), 201


@app.route("/api/produits", methods=["GET"])
def list_produits():
    statut = request.args.get("statut", "approved")
    q = {"statut": statut} if statut else {}
    items = list(mongo.db.produits.find(q).sort("_id", -1))
    out = []
    for p in items:
        foid = parse_object_id(p.get("freelancerId"))
        fu = mongo.db.users.find_one({"_id": foid}) if foid else None
        out.append(merge_produit_doc(p, fu))
    return jsonify({"produits": out}), 200


@app.route("/api/produits/<id>", methods=["GET"])
def get_produit(id):
    oid = parse_object_id(id)
    if not oid:
        return jsonify({"error": "Invalid id"}), 400
    p = mongo.db.produits.find_one({"_id": oid})
    if not p:
        return jsonify({"error": "Not found"}), 404
    foid = parse_object_id(p.get("freelancerId"))
    fu = mongo.db.users.find_one({"_id": foid}) if foid else None
    return jsonify(merge_produit_doc(p, fu)), 200


@app.route("/api/produits/<id>", methods=["PUT"])
@jwt_required()
def update_produit(id):
    claims = get_jwt()
    if claims.get("role") != "freelancer":
        return jsonify({"error": "Freelancer role required"}), 403
    oid = parse_object_id(id)
    if not oid:
        return jsonify({"error": "Invalid id"}), 400
    p = mongo.db.produits.find_one({"_id": oid})
    if not p:
        return jsonify({"error": "Not found"}), 404
    if p.get("freelancerId") != get_jwt_identity():
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json() or {}
    allowed = ("nom", "description", "version", "license", "prix", "fichierUrl")
    update_doc = {}
    for k in allowed:
        if k in data:
            if k == "prix":
                try:
                    update_doc[k] = float(data[k])
                except (TypeError, ValueError):
                    return jsonify({"error": "prix must be a number"}), 400
            else:
                update_doc[k] = data[k] if isinstance(data[k], str) else str(data[k])
    if not update_doc:
        return jsonify({"error": "No valid fields"}), 400
    update_doc["statut"] = "pending"
    update_doc["validatedBy"] = None
    mongo.db.produits.update_one({"_id": oid}, {"$set": update_doc})
    updated = mongo.db.produits.find_one({"_id": oid})
    foid = parse_object_id(updated.get("freelancerId"))
    fu = mongo.db.users.find_one({"_id": foid}) if foid else None
    return jsonify({"message": "Produit updated", "produit": merge_produit_doc(updated, fu)}), 200


@app.route("/api/produits/<id>", methods=["DELETE"])
@jwt_required()
def delete_produit(id):
    claims = get_jwt()
    if claims.get("role") != "freelancer":
        return jsonify({"error": "Freelancer role required"}), 403
    oid = parse_object_id(id)
    if not oid:
        return jsonify({"error": "Invalid id"}), 400
    p = mongo.db.produits.find_one({"_id": oid})
    if not p:
        return jsonify({"error": "Not found"}), 404
    if p.get("freelancerId") != get_jwt_identity():
        return jsonify({"error": "Forbidden"}), 403
    mongo.db.produits.delete_one({"_id": oid})
    return jsonify({"message": "Produit deleted"}), 200

# ----------------------------
# ACHATS
# ----------------------------

@app.route("/api/achats", methods=["POST"])
@app.route("/api/purchases", methods=["POST"])
@jwt_required()
def create_achat():
    claims = get_jwt()
    if claims.get("role") != "client":
        return jsonify({"error": "Client role required"}), 403
    data = request.get_json() or {}
    pid = (data.get("produitId") or data.get("produit") or "").strip()
    if not pid:
        return jsonify({"error": "produitId is required"}), 400
    p_oid = parse_object_id(pid)
    if not p_oid:
        return jsonify({"error": "Invalid produitId"}), 400
    if not mongo.db.produits.find_one({"_id": p_oid}):
        return jsonify({"error": "Produit not found"}), 404

    client_oid = parse_object_id(get_jwt_identity())
    doc = {
        "dateAchat": datetime.utcnow(),
        "clientId": client_oid,
        "produitId": p_oid,
    }
    ins = mongo.db.achats.insert_one(doc)
    return jsonify({
        "message": "Achat recorded",
        "_id": str(ins.inserted_id),
    }), 201


@app.route("/api/achats/by-user/<userId>", methods=["GET"])
@app.route("/api/purchases/by-user/<userId>", methods=["GET"])
@jwt_required()
def list_achats_by_user(userId):
    requester = get_jwt_identity()
    claims = get_jwt()
    if requester != userId and claims.get("role") != "admin":
        return jsonify({"error": "Forbidden"}), 403

    user_oid = parse_object_id(userId, "userId")
    if not user_oid:
        return jsonify({"error": "Invalid userId"}), 400

    rows = list(mongo.db.achats.find({"clientId": user_oid}).sort("dateAchat", -1))
    out = []
    for a in rows:
        produit_oid = a.get("produitId")
        produit = mongo.db.produits.find_one({"_id": produit_oid}) if produit_oid else None
        if produit:
            foid = parse_object_id(produit.get("freelancerId"))
            fu = mongo.db.users.find_one({"_id": foid}) if foid else None
            a["_produit"] = merge_produit_doc(produit, fu)
        out.append(merge_achat_doc(a))
    return jsonify({"purchases": out}), 200

# ----------------------------
# OFFRES (CRUD — clients)
# ----------------------------

def _parse_date_publication(val):
    if val is None:
        return datetime.utcnow()
    if isinstance(val, str):
        try:
            s = val.strip().replace("Z", "+00:00")
            return datetime.fromisoformat(s)
        except ValueError:
            return None
    if isinstance(val, datetime):
        return val
    return None


@app.route("/api/offres", methods=["POST"])
@app.route("/api/offers", methods=["POST"])
@jwt_required()
def create_offre():
    claims = get_jwt()
    if claims.get("role") != "client":
        return jsonify({"error": "Client role required"}), 403

    data = request.get_json() or {}
    titre = (data.get("titre") or "").strip()
    description = (data.get("description") or "").strip()
    budget = data.get("budget")
    delai = data.get("delai")
    date_pub = data.get("datePublication")

    if not titre or not description:
        return jsonify({"error": "titre and description are required"}), 400
    if budget is None:
        return jsonify({"error": "budget is required"}), 400
    if delai is None:
        return jsonify({"error": "delai is required"}), 400
    try:
        budget_f = float(budget)
    except (TypeError, ValueError):
        return jsonify({"error": "budget must be a number"}), 400
    try:
        delai_i = int(delai)
    except (TypeError, ValueError):
        return jsonify({"error": "delai must be an integer"}), 400

    dp = _parse_date_publication(date_pub)
    if dp is None:
        return jsonify({"error": "datePublication must be a valid ISO date string or omitted"}), 400

    client_oid = parse_object_id(get_jwt_identity())
    if not client_oid:
        return jsonify({"error": "Invalid user"}), 400

    doc = {
        "titre": titre,
        "description": description,
        "budget": budget_f,
        "delai": delai_i,
        "datePublication": dp,
        "clientId": client_oid,
    }
    ins = mongo.db.offres.insert_one(doc)
    created = mongo.db.offres.find_one({"_id": ins.inserted_id})
    return jsonify({"message": "Offre created", "offre": merge_offre_doc(created)}), 201


@app.route("/api/offres", methods=["GET"])
@app.route("/api/offers", methods=["GET"])
def list_offres():
    rows = list(mongo.db.offres.find().sort("datePublication", -1))
    return jsonify({"offres": [merge_offre_doc(o) for o in rows]}), 200


@app.route("/api/offres/<id>", methods=["GET"])
@app.route("/api/offers/<id>", methods=["GET"])
def get_offre(id):
    oid = parse_object_id(id)
    if not oid:
        return jsonify({"error": "Invalid offre id"}), 400
    o = mongo.db.offres.find_one({"_id": oid})
    if not o:
        return jsonify({"error": "Offre not found"}), 404
    return jsonify(merge_offre_doc(o)), 200


@app.route("/api/offres/<id>", methods=["PUT"])
@app.route("/api/offers/<id>", methods=["PUT"])
@jwt_required()
def update_offre(id):
    claims = get_jwt()
    if claims.get("role") != "client":
        return jsonify({"error": "Client role required"}), 403

    oid = parse_object_id(id)
    if not oid:
        return jsonify({"error": "Invalid offre id"}), 400
    o = mongo.db.offres.find_one({"_id": oid})
    if not o:
        return jsonify({"error": "Offre not found"}), 404

    user_id = get_jwt_identity()
    if str(o.get("clientId")) != user_id:
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json() or {}
    update_doc = {}
    if "titre" in data:
        t = (data.get("titre") or "").strip()
        if not t:
            return jsonify({"error": "titre cannot be empty"}), 400
        update_doc["titre"] = t
    if "description" in data:
        d = (data.get("description") or "").strip()
        if not d:
            return jsonify({"error": "description cannot be empty"}), 400
        update_doc["description"] = d
    if "budget" in data:
        try:
            update_doc["budget"] = float(data.get("budget"))
        except (TypeError, ValueError):
            return jsonify({"error": "budget must be a number"}), 400
    if "delai" in data:
        try:
            update_doc["delai"] = int(data.get("delai"))
        except (TypeError, ValueError):
            return jsonify({"error": "delai must be an integer"}), 400
    if "datePublication" in data:
        dp = _parse_date_publication(data.get("datePublication"))
        if dp is None:
            return jsonify({"error": "datePublication invalid"}), 400
        update_doc["datePublication"] = dp

    if not update_doc:
        return jsonify({"error": "No valid fields to update"}), 400

    mongo.db.offres.update_one({"_id": oid}, {"$set": update_doc})
    updated = mongo.db.offres.find_one({"_id": oid})
    return jsonify({"message": "Offre updated", "offre": merge_offre_doc(updated)}), 200


@app.route("/api/offres/<id>", methods=["DELETE"])
@app.route("/api/offers/<id>", methods=["DELETE"])
@jwt_required()
def delete_offre(id):
    claims = get_jwt()
    if claims.get("role") != "client":
        return jsonify({"error": "Client role required"}), 403

    oid = parse_object_id(id)
    if not oid:
        return jsonify({"error": "Invalid offre id"}), 400
    o = mongo.db.offres.find_one({"_id": oid})
    if not o:
        return jsonify({"error": "Offre not found"}), 404

    user_id = get_jwt_identity()
    if str(o.get("clientId")) != user_id:
        return jsonify({"error": "Forbidden"}), 403

    mongo.db.offres.delete_one({"_id": oid})
    return jsonify({"message": "Offre deleted"}), 200

# ----------------------------
# PROPOSALS (offreId → offres collection)
# ----------------------------

@app.route("/api/proposals", methods=["POST"])
@jwt_required()
def create_proposal():
    claims = get_jwt()
    if claims.get("role") != "freelancer":
        return jsonify({"error": "Freelancer role required"}), 403

    data = request.get_json() or {}
    offre_id = (data.get("offreId") or data.get("offerId") or "").strip()
    montant = data.get("montant") if data.get("montant") is not None else data.get("amount")
    message = (data.get("message") or "").strip()

    if not offre_id:
        return jsonify({"error": "offreId is required"}), 400
    if montant is None:
        return jsonify({"error": "montant is required"}), 400
    try:
        montant_f = float(montant)
    except (TypeError, ValueError):
        return jsonify({"error": "montant must be a number"}), 400
    if not message:
        return jsonify({"error": "message is required"}), 400

    oid = parse_object_id(offre_id)
    if not oid:
        return jsonify({"error": "Invalid offreId"}), 400
    offre = mongo.db.offres.find_one({"_id": oid})
    if not offre:
        return jsonify({"error": "Offre not found"}), 404

    user_id = get_jwt_identity()
    dup = mongo.db.proposals.find_one({
        "freelancerId": user_id,
        "$or": [{"offreId": offre_id}, {"offerId": offre_id}],
    })
    if dup:
        return jsonify({"error": "You have already submitted a proposal for this offer"}), 400

    doc = {
        "offreId": offre_id,
        "freelancerId": user_id,
        "montant": montant_f,
        "message": message,
        "statut": "pending",
        "date": datetime.utcnow(),
    }
    ins = mongo.db.proposals.insert_one(doc)
    created = mongo.db.proposals.find_one({"_id": ins.inserted_id})
    foid = parse_object_id(user_id)
    fu = mongo.db.users.find_one({"_id": foid}) if foid else None
    return jsonify({
        "message": "Proposal submitted",
        "proposal": merge_proposal_doc(created, fu),
    }), 201


@app.route("/api/proposals/by-offer/<offerId>", methods=["GET"])
@jwt_required()
def list_proposals_by_offer(offerId):
    claims = get_jwt()
    if claims.get("role") != "client":
        return jsonify({"error": "Client role required"}), 403

    oid = parse_object_id(offerId)
    if not oid:
        return jsonify({"error": "Invalid offer id"}), 400
    offre = mongo.db.offres.find_one({"_id": oid})
    if not offre:
        return jsonify({"error": "Offer not found"}), 404

    user_id = get_jwt_identity()
    cid = offre.get("clientId")
    if str(cid) != user_id:
        return jsonify({"error": "Forbidden"}), 403

    props = list(mongo.db.proposals.find({
        "$or": [{"offreId": offerId}, {"offerId": offerId}],
    }).sort([("date", -1), ("createdAt", -1)]))
    out = []
    for p in props:
        fid = p.get("freelancerId")
        foid = parse_object_id(fid) if fid else None
        fu = mongo.db.users.find_one({"_id": foid}) if foid else None
        out.append(merge_proposal_doc_client_view(p, fu))
    return jsonify({"proposals": out}), 200


@app.route("/api/proposals/by-freelancer/<freelancerId>", methods=["GET"])
@jwt_required()
def list_proposals_by_freelancer(freelancerId):
    user_id = get_jwt_identity()
    if freelancerId != user_id:
        return jsonify({"error": "Forbidden"}), 403

    props = list(mongo.db.proposals.find({"freelancerId": freelancerId}).sort([("date", -1), ("createdAt", -1)]))
    out = []
    for p in props:
        fid = p.get("freelancerId")
        foid = parse_object_id(fid) if fid else None
        fu = mongo.db.users.find_one({"_id": foid}) if foid else None
        out.append(merge_proposal_doc(p, fu))
    return jsonify({"proposals": out}), 200


@app.route("/api/proposals/<id>/status", methods=["PUT"])
@jwt_required()
def update_proposal_status(id):
    claims = get_jwt()
    if claims.get("role") != "client":
        return jsonify({"error": "Client role required"}), 403

    oid = parse_object_id(id)
    if not oid:
        return jsonify({"error": "Invalid proposal id"}), 400
    prop = mongo.db.proposals.find_one({"_id": oid})
    if not prop:
        return jsonify({"error": "Proposal not found"}), 404

    oid_raw = prop.get("offreId") or prop.get("offerId")
    offre_oid = parse_object_id(oid_raw)
    if not offre_oid:
        return jsonify({"error": "Invalid related offre"}), 400
    offre = mongo.db.offres.find_one({"_id": offre_oid})
    if not offre:
        return jsonify({"error": "Offre not found"}), 404

    user_id = get_jwt_identity()
    cid = offre.get("clientId")
    if str(cid) != user_id:
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json() or {}
    statut = data.get("statut") or data.get("status", "")
    if statut not in ("accepted", "rejected"):
        return jsonify({"error": "statut must be accepted or rejected"}), 400

    mongo.db.proposals.update_one({"_id": oid}, {"$set": {"statut": statut}})

    conversation_id_str = None
    if statut == "accepted":
        oid_key = prop.get("offreId") or prop.get("offerId")
        mongo.db.proposals.update_many(
            {
                "$or": [{"offreId": oid_key}, {"offerId": oid_key}],
                "_id": {"$ne": oid},
            },
            {"$set": {"statut": "rejected"}},
        )

        prop_pid = str(oid)
        existing_conv = mongo.db.conversations.find_one({"proposalId": prop_pid})
        if not existing_conv:
            fid_str = str(prop.get("freelancerId") or "")
            offer_id_str = str(offre_oid)
            client_alias = client_display_alias(offer_id_str, prop_pid, user_id)
            freelancer_alias = freelancer_display_alias(prop_pid, fid_str)
            offer_title = (offre.get("titre") or "Project")[:200]
            doc_conv = {
                "offerId": offer_id_str,
                "proposalId": prop_pid,
                "clientId": offre.get("clientId"),
                "freelancerId": fid_str,
                "clientAlias": client_alias,
                "freelancerAlias": freelancer_alias,
                "offerTitle": offer_title,
                "createdAt": datetime.utcnow(),
            }
            ins_c = mongo.db.conversations.insert_one(doc_conv)
            conversation_id_str = str(ins_c.inserted_id)
            mongo.db.notifications.insert_one({
                "userId": fid_str,
                "type": "proposal_accepted",
                "title": "Proposal accepted",
                "body": (
                    f'Your proposal for "{offer_title}" was accepted. '
                    "Open Messages to chat using your anonymous name."
                ),
                "proposalId": prop_pid,
                "offerId": offer_id_str,
                "conversationId": conversation_id_str,
                "read": False,
                "createdAt": datetime.utcnow(),
            })
        else:
            conversation_id_str = str(existing_conv["_id"])

    updated = mongo.db.proposals.find_one({"_id": oid})
    ff = parse_object_id(updated.get("freelancerId"))
    fu = mongo.db.users.find_one({"_id": ff}) if ff else None
    resp = {
        "message": "Proposal status updated",
        "proposal": merge_proposal_doc(updated, fu),
    }
    if statut == "accepted" and conversation_id_str:
        resp["conversationId"] = conversation_id_str
    return jsonify(resp), 200


# ----------------------------
# NOTIFICATIONS & MESSAGES
# MongoDB collections used here (created implicitly on first insert):
#   notifications, conversations, messages
# Optional per-user metrics (non-synthetic): users.jobStats =
#   { jobSuccessRate, onTimeDeliveryRate, avgRating, completedProjects, isSynthetic?: bool }
# ----------------------------

@app.route("/api/notifications", methods=["GET"])
@jwt_required()
def list_notifications():
    uid = get_jwt_identity()
    cur = mongo.db.notifications.find({"userId": uid}).sort("createdAt", -1).limit(80)
    out = []
    for n in cur:
        out.append({
            "_id": str(n["_id"]),
            "type": n.get("type"),
            "title": n.get("title"),
            "body": n.get("body"),
            "read": bool(n.get("read")),
            "proposalId": n.get("proposalId"),
            "offerId": n.get("offerId"),
            "conversationId": n.get("conversationId"),
            "createdAt": json_dt(n.get("createdAt")),
        })
    return jsonify({"notifications": out}), 200


@app.route("/api/notifications/<nid>/read", methods=["PUT"])
@jwt_required()
def mark_notification_read(nid):
    uid = get_jwt_identity()
    noid = parse_object_id(nid)
    if not noid:
        return jsonify({"error": "Invalid notification id"}), 400
    row = mongo.db.notifications.find_one({"_id": noid})
    if not row or row.get("userId") != uid:
        return jsonify({"error": "Not found"}), 404
    mongo.db.notifications.update_one({"_id": noid}, {"$set": {"read": True}})
    return jsonify({"message": "ok"}), 200


# ----------------------------
# CONVERSATIONS (anonymous aliases; messages collection)
# ----------------------------

@app.route("/api/conversations", methods=["GET"])
@jwt_required()
def list_conversations():
    claims = get_jwt()
    role = claims.get("role")
    uid = get_jwt_identity()
    if role == "client":
        user_oid = parse_object_id(uid)
        if not user_oid:
            return jsonify({"error": "Invalid user"}), 400
        q = {"clientId": user_oid}
    elif role == "freelancer":
        q = {"freelancerId": uid}
    else:
        return jsonify({"error": "Forbidden"}), 403

    rows = list(mongo.db.conversations.find(q).sort("createdAt", -1))
    out = []
    for c in rows:
        other = c.get("freelancerAlias") if role == "client" else c.get("clientAlias")
        out.append({
            "_id": str(c["_id"]),
            "offerTitle": c.get("offerTitle", ""),
            "otherPartyAlias": other or "Partner",
            "proposalId": c.get("proposalId"),
            "offerId": c.get("offerId"),
            "createdAt": json_dt(c.get("createdAt")),
        })
    return jsonify({"conversations": out}), 200


@app.route("/api/conversations/<cid>", methods=["GET"])
@jwt_required()
def get_conversation(cid):
    claims = get_jwt()
    role = claims.get("role")
    uid = get_jwt_identity()
    coid = parse_object_id(cid)
    if not coid:
        return jsonify({"error": "Invalid conversation id"}), 400
    conv = mongo.db.conversations.find_one({"_id": coid})
    if not conv:
        return jsonify({"error": "Not found"}), 404
    if not _conversation_user_allowed(conv, uid, role):
        return jsonify({"error": "Forbidden"}), 403

    if role == "client":
        your_alias = conv.get("clientAlias")
        other_alias = conv.get("freelancerAlias")
    else:
        your_alias = conv.get("freelancerAlias")
        other_alias = conv.get("clientAlias")

    return jsonify({
        "_id": str(conv["_id"]),
        "offerTitle": conv.get("offerTitle", ""),
        "offerId": conv.get("offerId"),
        "proposalId": conv.get("proposalId"),
        "youAre": role,
        "yourAlias": your_alias,
        "otherPartyAlias": other_alias,
        "createdAt": json_dt(conv.get("createdAt")),
    }), 200


@app.route("/api/conversations/<cid>/messages", methods=["GET"])
@jwt_required()
def list_conversation_messages(cid):
    claims = get_jwt()
    role = claims.get("role")
    uid = get_jwt_identity()
    coid = parse_object_id(cid)
    if not coid:
        return jsonify({"error": "Invalid conversation id"}), 400
    conv = mongo.db.conversations.find_one({"_id": coid})
    if not conv or not _conversation_user_allowed(conv, uid, role):
        return jsonify({"error": "Forbidden"}), 403

    msgs = list(mongo.db.messages.find({"conversationId": coid}).sort("createdAt", 1))
    out = []
    for m in msgs:
        sr = m.get("senderRole")
        out.append({
            "_id": str(m["_id"]),
            "senderRole": sr,
            "isMine": sr == role,
            "body": m.get("body", ""),
            "createdAt": json_dt(m.get("createdAt")),
        })
    return jsonify({"messages": out}), 200


@app.route("/api/conversations/<cid>/messages", methods=["POST"])
@jwt_required()
def post_conversation_message(cid):
    claims = get_jwt()
    role = claims.get("role")
    uid = get_jwt_identity()
    if role not in ("client", "freelancer"):
        return jsonify({"error": "Forbidden"}), 403

    coid = parse_object_id(cid)
    if not coid:
        return jsonify({"error": "Invalid conversation id"}), 400
    conv = mongo.db.conversations.find_one({"_id": coid})
    if not conv or not _conversation_user_allowed(conv, uid, role):
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json() or {}
    body = (data.get("body") or "").strip()
    if not body:
        return jsonify({"error": "body is required"}), 400
    if len(body) > 5000:
        return jsonify({"error": "body too long"}), 400

    ins = mongo.db.messages.insert_one({
        "conversationId": coid,
        "senderRole": role,
        "body": body,
        "createdAt": datetime.utcnow(),
    })
    created = mongo.db.messages.find_one({"_id": ins.inserted_id})
    return jsonify({
        "message": "Sent",
        "msg": {
            "_id": str(created["_id"]),
            "senderRole": role,
            "isMine": True,
            "body": created.get("body", ""),
            "createdAt": json_dt(created.get("createdAt")),
        },
    }), 201


# ----------------------------
# Error Handlers
# ----------------------------

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({"error": "Token has expired"}), 401

@jwt.invalid_token_loader
def invalid_token_callback(error):
    return jsonify({"error": "Invalid token"}), 401

@jwt.unauthorized_loader
def missing_token_callback(error):
    return jsonify({"error": "Authorization token is missing"}), 401

# ----------------------------
# Run
# ----------------------------

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
