# FreelanceHub (MobDevProject) — Project & API Documentation

This document describes the **FreelanceHub** MVP in `MobDevProject/`: a **Flask + MongoDB** REST API (`backend/app.py`) and an **Ionic / Angular** client (`myApp/`).

---

## 1. Architecture overview

| Layer | Technology | Notes |
|--------|------------|--------|
| API server | Python 3, Flask | Default `http://127.0.0.1:5000` |
| Database | MongoDB (Atlas URI in `app.py`) | Collections created implicitly (users, freelancers, services, offres, proposals, etc.) |
| Auth | Flask-JWT-Extended + bcrypt | JWT in `Authorization: Bearer <token>`; claims include `role` (`client`, `freelancer`, `admin`) |
| Frontend | Ionic 8 + Angular 20 | Dev server often `http://localhost:8100`; HTTP calls use `http://127.0.0.1:5000/api/...` |
| File uploads | Local `backend/uploads/` | Served at `GET /uploads/<path>` |

**CORS** is enabled for API routes from `http://localhost:8100` and `http://localhost:4200`.

---

## 2. How authentication works in this project

1. **Register / login** return a **JWT** and a **user** object (`id`, `nom`, `email`, `role`, …).
2. The Angular app stores the token (Ionic Storage) and attaches it on API calls via **`AuthInterceptor`**.
3. Protected routes use `@jwt_required()`; role checks use `get_jwt()` → `claims["role"]`.
4. **Logout** is implemented **only on the client** (token removed from storage). There is **no** `POST /api/auth/logout` endpoint in this codebase.

**Bonus endpoints (not in your original list):**

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/google` | Google OAuth login / signup |
| PUT | `/api/auth/password` | Change password (local accounts) |
| POST | `/api/auth/avatar` | Upload profile image (`multipart`, field `file`) |

---

## 3. Your checklist vs what this repo implements

Use this table so expectations match the code.

| Your item | Status in this project |
|-----------|-------------------------|
| `POST /api/auth/register` | Implemented |
| `POST /api/auth/login` | Implemented; typing email `admin` maps to the seeded admin account |
| `GET /api/auth/profile` | Implemented |
| `PUT /api/auth/profile` | Implemented |
| `POST /api/auth/logout` | **Not implemented** — client drops JWT locally |
| Freelancer profile APIs | Implemented (see §4) |
| `PUT /api/freelancers/status` (admin) | Implemented — body-based, **not** `/validate-user/:id` |
| Services (gigs) APIs | Implemented under `/api/services` |
| `PUT /api/services/:id/validate` (admin) | Implemented |
| Offers APIs | Implemented as **`/api/offers`** *and* **`/api/offres`** (same handlers) |
| Proposals APIs | Implemented + extra routes for submit-work, admin validation, MVP payment ack |
| Messaging | **Not** `GET /api/messages/:conversationId`. Implemented as **conversations + nested messages** (§8) |
| `POST /api/messages` | Implemented but **legacy/simple** — inserts a loose document in `messages`; **project chat uses `/api/conversations/.../messages`** instead |
| Store (products) | Implemented as **`/api/produits`** (French resource name). **No** `/api/products` alias in backend |
| Purchases | Implemented as **`/api/purchases`** *and* **`/api/achats`** |
| `GET /api/admin/dashboard` | **Not implemented** |
| `PUT /api/admin/validate-user/:id` | **Not implemented** — use **`PUT /api/freelancers/status`** with JSON `{ userId, status }` |
| `PUT /api/admin/validate-product/:id` | **Not implemented** — there is **no** admin validate route for `produits` in `app.py` |
| Admin deliverables (proposal flow) | **`GET /api/admin/deliverables`** (added for MVP payout flow) |

---

## 4. Authentication APIs

### `POST /api/auth/register`

- **Body (JSON):** `nom` (or `name`), `email`, `password`, `role` — `freelancer` or `client` only (not `admin`).
- **Behavior:** Validates email/password length; hashes password; creates `users` row; if client → `clients` doc; if freelancer → freelancer profile stub.
- **Returns:** `201` — `{ message, token, user }`.

### `POST /api/auth/login`

- **Body:** `email`, `password`.
- **Behavior:** If `email === "admin"`, resolves to `admin@freelancehub.local` (demo admin). Checks bcrypt hash; requires active account.
- **Returns:** `200` — `{ message, token, user }`.

### `GET /api/auth/profile`

- **Auth:** JWT required.
- **Returns:** Public user fields (`user_public_dict`).

### `PUT /api/auth/profile`

- **Auth:** JWT required.
- **Body:** Optional `nom`, `telephone`, `dateNaissance` (partial updates).
- **Returns:** `{ message, user }`.

---

## 5. Freelancer profile APIs

### `GET /api/freelancers`

- **Public.** Lists freelancer profiles with `validationStatus: "approved"` only.

### `GET /api/freelancers/:id`

- **Public.** `:id` is the **freelancer profile document id** (`freelancers._id`), not the user id.

### `PUT /api/freelancers/:id`

- **Auth:** JWT; must be the owning freelancer (`profile.userId` === JWT identity).
- **Body:** Optional `bio`, `skills`, `portfolio`, `serviceUrl`, `productUrl`, `reviews`, etc.
- **Side effect:** If profile was `draft`, moving content can set `validationStatus` to `pending`.

### `POST /api/freelancers/upload-cv`

- **Auth:** JWT (freelancer).
- **Body:** `multipart/form-data`, field **`file`** or **`cv`** — **PDF only**.
- **Returns:** `cvUrl` (relative path under `/uploads/...`), `profileId`.

### `PUT /api/freelancers/status` *(admin validation)*

- **Auth:** JWT with **role `admin`**.
- **Body (JSON):** `{ "userId": "<Mongo user ObjectId string>", "status": "approved" | "rejected" | "pending" }`.
- **Behavior:** Updates `freelancers.validationStatus` for that user’s profile.

> **Note:** This replaces a hypothetical `PUT /api/admin/validate-user/:id` — validation is **body-based**, not path-based.

---

## 6. Services (“gigs”) APIs — `/api/services`

Mongo collection: **`services`**. Freelancers create listings; admins approve/reject.

| Method | Path | Role | Summary |
|--------|------|------|---------|
| POST | `/api/services` | freelancer | Create service (`titre`/`title`, `description`, `prix`/`price`, `tags` array required) |
| GET | `/api/services` | public | Query `?statut=` (default filters approved in code — see implementation) |
| GET | `/api/services/:id` | public | Detail |
| PUT | `/api/services/:id` | freelancer owner | Update fields |
| DELETE | `/api/services/:id` | freelancer owner | Delete |
| PUT | `/api/services/:id/validate` | **admin** | Body: `{ "statut": "approved" \| "rejected" }` (or `status`) — sets `validatedBy` |

---

## 7. Offers (client projects) — `/api/offers` and `/api/offres`

Both prefixes call the **same** Flask handlers. Mongo collection: **`offres`**.

| Method | Path | Role | Summary |
|--------|------|------|---------|
| POST | `/api/offers` | client | Create offer: `titre`, `description`, `budget`, `delai`, optional `datePublication` (ISO) |
| GET | `/api/offers` | public | List all offers (newest publication first) |
| GET | `/api/offers/:id` | public | Single offer |
| PUT | `/api/offers/:id` | client owner | Partial update |
| DELETE | `/api/offers/:id` | client owner | Delete |

---

## 8. Proposals APIs — `/api/proposals`

| Method | Path | Role | Summary |
|--------|------|------|---------|
| POST | `/api/proposals` | freelancer | Create proposal for an offer: `offreId`/`offerId`, `montant`/`amount`, `message` |
| GET | `/api/proposals/by-offer/:offerId` | JWT | Client sees **anonymized** freelancer info for their offer |
| GET | `/api/proposals/by-freelancer/:freelancerId` | freelancer | Own proposals only (`freelancerId` must match JWT) |
| PUT | `/api/proposals/:id/status` | client | `{ "status": "accepted" \| "rejected" }` — accepts one proposal, rejects others on same offer; creates conversation + notifications |
| GET | `/api/proposals/:id` | client / freelancer / admin | Single proposal detail for payout/submit flows |

**MVP payout / deliverable extensions:**

| Method | Path | Role | Summary |
|--------|------|------|---------|
| POST | `/api/proposals/:id/submit-work` | freelancer | JSON **or** `multipart`: deliverable text + optional `.zip` |
| POST | `/api/proposals/:id/admin-validate` | admin | Marks deliverable approved; notifies client; deletes old `project_in_progress` notification |
| POST | `/api/proposals/:id/ack-mvp-payment` | client | Removes `payment_due` notifications after fake checkout |

---

## 9. Messaging APIs — conversations (primary)

The Angular app uses **anonymous conversations** tied to an accepted proposal. Legacy **`POST /api/messages`** exists but **does not** match this flow.

| Method | Path | Role | Summary |
|--------|------|------|---------|
| GET | `/api/conversations` | client / freelancer | Lists conversations where user participates |
| GET | `/api/conversations/:cid` | participant | Metadata + aliases |
| GET | `/api/conversations/:cid/messages` | participant | Message history |
| POST | `/api/conversations/:cid/messages` | participant | Body `{ "body": "..." }` — sends chat message |

### Legacy: `POST /api/messages`

- Inserts `{ contenu, sender, dateEnvoi }` into `messages` **without** `conversationId`.
- **Not used** by the Ionic conversation screens; kept for backward compatibility or tests.

### Notifications

| Method | Path | Summary |
|--------|------|---------|
| GET | `/api/notifications` | Lists notifications for JWT user |
| PUT | `/api/notifications/:nid/read` | Mark read |

---

## 10. Store (digital products) — `/api/produits`

There is **no** `/api/products` route in this backend — use **`/api/produits`**.

| Method | Path | Role | Summary |
|--------|------|------|---------|
| POST | `/api/produits` | freelancer | Create digital product (`nom`, `description`, `prix`, optional `version`, `license`, `fichierUrl`) — starts `statut: pending` |
| GET | `/api/produits` | public | Query `?statut=` (defaults toward approved listings) |
| GET | `/api/produits/:id` | public | Detail |
| PUT | `/api/produits/:id` | freelancer owner | Update; resets to `pending` |
| DELETE | `/api/produits/:id` | freelancer owner | Delete |

**Admin product validation:** **Not implemented** as `PUT /api/admin/validate-product/:id`. Approving products would require a new admin endpoint or reusing a pattern similar to `/api/services/:id/validate`.

---

## 11. Purchase APIs — `/api/purchases` and `/api/achats`

| Method | Path | Role | Summary |
|--------|------|------|---------|
| POST | `/api/purchases` | client | Body `{ "produitId": "<id>" }` — records purchase in `achats` |
| POST | `/api/achats` | client | **Alias** — same handler |
| GET | `/api/purchases/by-user/:userId` | user self or admin | Purchase history with embedded product info |
| GET | `/api/achats/by-user/:userId` | user self or admin | **Alias** |

---

## 12. Admin APIs (as implemented)

| Method | Path | Purpose |
|--------|------|---------|
| PUT | `/api/freelancers/status` | Approve/reject freelancer profiles (`userId` + `status`) |
| PUT | `/api/services/:id/validate` | Approve/reject services |
| GET | `/api/admin/deliverables` | List proposals awaiting admin validation of submitted work |

**Not implemented in this codebase:**

- `GET /api/admin/dashboard`
- `PUT /api/admin/validate-user/:id` — use **`PUT /api/freelancers/status`**
- `PUT /api/admin/validate-service/:id` — use **`PUT /api/services/:id/validate`**
- `PUT /api/admin/validate-product/:id`

---

## 13. Angular client (`myApp/`) — how it maps to APIs

- **`AuthService`** → `/api/auth/*`
- **`ProposalService`** → `/api/proposals/*`
- **`OfferService`** → `/api/offers`
- **`ConversationService`** → `/api/conversations`, `/api/notifications`
- **`FreelancerService` / gig flows** → `/api/freelancers`, `/api/services` as wired in each page
- **`PurchaseService`** → `/api/purchases`, `/api/produits` (check service files for exact paths)

Routes are declared in `myApp/src/app/app.routes.ts` (lazy-loaded pages).

---

## 14. Error shape & status codes

Most endpoints return JSON `{ "error": "<message>" }` with appropriate HTTP status (`400`, `401`, `403`, `404`, `409`, …). JWT expiry returns `401` via Flask-JWT-Extended handlers.

---

## 15. Quick reference — all Flask routes in `app.py` (excluding static)

See `@app.route` definitions in `MobDevProject/backend/app.py` for the authoritative list; this doc focuses on the domains you listed plus important deviations (`produits`, `offres`, conversations, notifications, proposal MVP).

---

*Generated for the MobDevProject codebase. If you add new endpoints, keep this file in sync or regenerate from `grep @app.route backend/app.py`.*
