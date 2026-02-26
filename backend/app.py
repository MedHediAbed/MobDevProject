from flask import Flask, request, jsonify
from flask_pymongo import PyMongo
from flask_bcrypt import Bcrypt
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity
)
from flask_cors import CORS
from datetime import datetime, timedelta
from bson.objectid import ObjectId
import re
import requests as http_requests  # pip install requests

# ----------------------------
# App Setup
# ----------------------------

app = Flask(__name__)

app.config["MONGO_URI"] = "mongodb://localhost:27017/freelancehub"
app.config["JWT_SECRET_KEY"] = "super-secret-key-change-later"
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=2)

mongo = PyMongo(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

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

# ----------------------------
# Routes
# ----------------------------

@app.route("/")
def home():
    return jsonify({"message": "FreelanceHub Auth API", "version": "1.0.0"})

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

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role = data.get("role", "")

    if not name or not email or not password or not role:
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
        "name": name,
        "email": email,
        "password": hashed_password,
        "role": role,
        "status": "active",
        "provider": "local",
        "createdAt": datetime.utcnow()
    }

    result = mongo.db.users.insert_one(user)
    token = create_access_token(
        identity=str(result.inserted_id),
        additional_claims={"role": role}
    )

    return jsonify({
        "message": "Registration successful",
        "token": token,
        "user": {"id": str(result.inserted_id), "name": name, "email": email, "role": role}
    }), 201

# ----------------------------
# LOGIN
# ----------------------------

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json()

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    user = mongo.db.users.find_one({"email": email})

    if not user:
        return jsonify({"error": "Invalid email or password"}), 401
    if not bcrypt.check_password_hash(user["password"], password):
        return jsonify({"error": "Invalid email or password"}), 401
    if user.get("status") != "active":
        return jsonify({"error": "Account is not active"}), 403

    token = create_access_token(
        identity=str(user["_id"]),
        additional_claims={"role": user["role"]}
    )

    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": {"id": str(user["_id"]), "name": user["name"], "email": user["email"], "role": user["role"]}
    }), 200

# ----------------------------
# GOOGLE LOGIN
# ----------------------------

@app.route("/api/auth/google", methods=["POST"])
def google_login():
    data = request.get_json()

    access_token = data.get("access_token")
    name         = data.get("name", "")
    email        = data.get("email", "").strip().lower()
    google_id    = data.get("google_id", "")

    if not access_token or not email:
        return jsonify({"error": "Invalid Google credentials"}), 400

    # Verify token with Google
    verify = http_requests.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {access_token}"}
    )

    if verify.status_code != 200:
        return jsonify({"error": "Failed to verify Google token"}), 401

    google_data = verify.json()

    # Double-check email matches
    if google_data.get("email") != email:
        return jsonify({"error": "Google token verification failed"}), 401

    # Find or create user
    user = mongo.db.users.find_one({"email": email})

    if user:
        # Existing user — just log them in
        if user.get("status") != "active":
            return jsonify({"error": "Account is not active"}), 403
    else:
        # New user — create account (default role: freelancer, can be changed later)
        new_user = {
            "name": name or google_data.get("name", "User"),
            "email": email,
            "password": "",           # No password for OAuth users
            "role": "freelancer",
            "status": "active",
            "provider": "google",
            "google_id": google_id,
            "createdAt": datetime.utcnow()
        }
        result = mongo.db.users.insert_one(new_user)
        user = mongo.db.users.find_one({"_id": result.inserted_id})

    token = create_access_token(
        identity=str(user["_id"]),
        additional_claims={"role": user["role"]}
    )

    return jsonify({
        "message": "Google login successful",
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "role": user["role"]
        }
    }), 200

# ----------------------------
# GET PROFILE (Protected)
# ----------------------------

@app.route("/api/auth/profile", methods=["GET"])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "status": user["status"]
    }), 200

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