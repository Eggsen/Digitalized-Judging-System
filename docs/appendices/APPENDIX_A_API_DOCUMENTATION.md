# Appendix A: Application Programming Interface (API) Documentation

## A.1. System Overview and Architectural Framework

The Digitalized Judging and Tabulation System (**JudgeTab**), developed by the Trilogic project group for Bukidnon State University, is an enterprise-grade, RESTful web application built upon Node.js (v20 LTS / Express framework) and MongoDB Atlas. The backend service layer coordinates scoring tabulation, identity verification, role-based access governance, real-time synchronization, and multi-tier audit trails.

The application adheres strictly to a decoupled layered MVC architecture:
1. **Network & Transport Layer:** Managed via Express, HTTP/TLS termination, Helmet security headers, Cross-Origin Resource Sharing (CORS), and dual rate-limiting filters.
2. **Middleware Pipeline:** Request pre-processing, body parsing (15 MB limit), cookie parsing, JWT token authentication (`authenticateToken`, `optionalToken`), reCAPTCHA validation, and granular role enforcement (`requireRole`).
3. **Controller & Business Domain Logic:** Nine asynchronous controllers governing distinct system domains: `authController`, `eventController`, `contestantController`, `criteriaController`, `scoreController`, `settingsController`, `userController`, `notificationController`, and `logController`.
4. **Data Persistence & Concurrency Engine:** MongoDB native driver collections with document-level atomicity, Multi-Version Concurrency Control (MVCC) on scoring records, and audit log persistence.
5. **Integration Utilities:** Pusher Channels for real-time WebSocket state broadcasting, Nodemailer for SMTP transactional messaging, Cloudinary for binary image assets, and pdfmake for client-side and server-side PDF document generation.

---

## A.2. Global API Conventions, Transport Protocols, and Error Handling

### A.2.1. Base URL and Transport Standards
* **Production Base URI:** `https://<domain>/api`
* **Local Development Base URI:** `http://localhost:3000/api`
* **Transport Security:** All client-server transmissions in production require TLS 1.3 encryption (HTTPS).
* **Payload Encoding:** Endpoints accept `application/json` (UTF-8) and standard `application/x-www-form-urlencoded` schemas. Maximum payload body size is enforced at `15MB` via `express.json({ limit: '15mb' })` and `express.urlencoded({ extended: true, limit: '15mb' })` in `server.js`.

### A.2.2. Rate Limiting and DoS Defense
The API implements dual-tiered defensive rate limiting via `express-rate-limit`:
1. **Authentication Limiter (`authLimiter`):** Enforces a limit of **30 requests per 15-minute window** on sensitive security routes: `/api/auth/login`, `/api/auth/verify-login-pin`, `/api/auth/request-reset`, and `/api/auth/reset-password`. Exceeding this limit returns HTTP `429 Too Many Requests`.
2. **General API Limiter (`generalApiLimiter`):** Enforces a throughput boundary of **300 requests per 1-minute window** across the entire `/api/*` mount path.

### A.2.3. Uniform Response Envelope and Status Code Taxonomy
All responses emitted by the JudgeTab API strictly conform to a standardized JSON schema envelope:

* **Success Envelope (`200 OK`, `201 Created`):**
```json
{
  "success": true,
  "message": "Operation executed successfully.",
  "data": {}
}
```

* **Error Envelope (`4xx`, `5xx`):**
```json
{
  "success": false,
  "message": "Detailed academic/operational error description.",
  "error": "Error identifier or validation error trace."
}
```

#### Standard HTTP Status Codes Utilized
* `200 OK`: Request succeeded; entity retrieved, updated, or action executed.
* `201 Created`: New resource successfully instantiated (e.g., event, contestant, criterion, user).
* `400 Bad Request`: Syntactic failure, malformed payload, missing mandatory fields, or invalid enum parameters.
* `401 Unauthorized`: Missing, invalid, expired, or revoked JWT bearer token or cookie session.
* `403 Forbidden`: Authenticated identity lacks required role privileges (e.g., judge attempting administrative mutation).
* `404 Not Found`: Target entity identifier does not exist in the designated MongoDB collection.
* `409 Conflict`: Concurrency conflict, lost update detection under MVCC, or resource state lock.
* `422 Unprocessable Entity`: Semantic constraint failure (e.g., criterion score exceeds assigned maximum, invalid date range).
* `429 Too Many Requests`: Rate limit threshold exceeded.
* `500 Internal Server Error`: Unhandled runtime exception intercepted by `middleware/errorHandler.js`.
* `503 Service Unavailable`: Dependent storage or external service connection offline.

---

## A.3. Security, Authentication, and Role-Based Access Control (RBAC)

### A.3.1. JSON Web Token (JWT) Architecture
Authentication is powered by HMAC-SHA256 signed JSON Web Tokens (`jsonwebtoken`). The secret signature key is derived from `process.env.JWT_SECRET` with a default token lifetime of 7 days (`7d`).

#### JWT Claims Schema
```json
{
  "id": "6735a123f456b789c012345a",
  "username": "chief_judge_1",
  "email": "judge1@buksu.edu.ph",
  "role": "judge",
  "can_create_admin": false,
  "full_name": "Dr. Czarissa Louise Navidad",
  "token_version": 1,
  "iat": 1731984000,
  "exp": 1732588800
}
```

#### Dual Delivery Channels
1. **Authorization Header:** `Authorization: Bearer <JWT>` (preferred for programmatic and AJAX clients).
2. **HTTP Cookies:** Evaluated via `req.cookies.djs_token` or `req.cookies.jwt_token` (`cookie-parser`).

### A.3.2. Two-Factor Authentication (2FA) for Administrators
To mitigate credential compromise, accounts holding the `admin` role are subjected to a compulsory second-factor PIN challenge:
1. **Primary Challenge:** `POST /api/auth/login` validates email and password. For `admin` accounts with an active PIN, the server returns `{ success: true, require_pin: true, challenge_token: "<signed_short_lived_token>" }`.
2. **PIN Verification:** The administrator posts the challenge token and 4–6 digit PIN to `POST /api/auth/verify-login-pin`. The server validates the PIN against the stored bcrypt hash and only then issues the final authenticated session JWT.

### A.3.3. MVCC Session Invalidation (`token_version`)
Each user document in MongoDB maintains an integer field: `token_version` (default: 1).
* Upon receiving any authenticated request, `middleware/auth.js` extracts the `token_version` claim from the JWT and compares it against the user's live database record.
* Whenever a user logs out (`POST /api/auth/logout`), changes passwords, or an administrator revokes sessions (`POST /api/users/:id/revoke-sessions`), the database executes `{$inc: { token_version: 1 }}`.
* This immediately invalidates every outstanding JWT previously issued to that user across all browsers and devices without requiring token blacklists.

### A.3.4. Role-Based Access Control (RBAC) Permissions Matrix

| Functional Module | Public / Guest | Judge | Tabulator | Administrator |
| :--- | :---: | :---: | :---: | :---: |
| **User Sign-In & Password Reset** | Read/Write | Read/Write | Read/Write | Read/Write |
| **System Branding & Public Settings** | Read Only | Read Only | Read Only | Read/Write |
| **WebSocket Pusher Config** | Read Only | Read Only | Read Only | Read Only |
| **Event Listing & Details** | Denied | Assigned Only | Assigned/All | Full Access |
| **Event Creation, Modification & Archive** | Denied | Denied | Denied | Full Access |
| **Judging Period (Start/Stop/Reset)** | Denied | Denied | Manage Period | Manage Period |
| **Contestant Setup & Reordering** | Denied | Denied | Denied | Full Access |
| **Contestant Special Awards / Citations** | Denied | Add/Remove Own | Denied | Full Access |
| **Judging Criteria & Weight Allocation** | Denied | Read Only | Read Only | Full Access |
| **Score Submission & Lock** | Denied | Submit & Lock | Denied | Submit & Lock (Override) |
| **Score Unlock Request** | Denied | Request Unlock | Denied | Direct Unlock |
| **Score Unlock Approval / Rejection** | Denied | Denied | Approve/Reject | Approve/Reject |
| **Score Verification / Unverification** | Denied | Denied | Verify/Unverify | Verify/Unverify |
| **Tabulation Matrix & Score Versions** | Denied | Read Assigned* | Read Full | Read Full |
| **Tabulation & Summary PDF Exports** | Denied | Denied | Full Access | Full Access |
| **User Management & Role Assignment** | Denied | Denied | Denied | Full Access |
| **Audit Logs (Viewing & PDF/CSV Export)** | Denied | Denied | Denied | Full Access |
| **Security Controls, API Keys & Backups** | Denied | Denied | Denied | Full Access |

*\*Note: In Blind Judging Mode, judges are strictly restricted to their own submitted scores.*

---

## A.4. Comprehensive Endpoint Specifications

### A.4.1. Module 1: Authentication and Session Management

#### 1. POST `/api/auth/login`
* **Description:** Authenticates user credentials via email and password. Applies Google reCAPTCHA verification when enabled.
* **Authentication:** Public (Protected by `authLimiter` and `verifyRecaptcha`).
* **Request Headers:** `Content-Type: application/json`
* **Request Body:**
  * `email` (string, required): Registered user email address.
  * `password` (string, required): User account plaintext password.
  * `recaptcha_token` (string, optional): reCAPTCHA response token when bot protection is active.
* **Success Responses:**
  * *Standard User (`200 OK`):*
    ```json
    {
      "success": true,
      "message": "Login successful.",
      "token": "<JWT_TOKEN>",
      "user": {
        "id": "6735a123f456b789c012345a",
        "username": "judge_jane",
        "email": "jane@buksu.edu.ph",
        "role": "judge",
        "full_name": "Jane Doe"
      },
      "redirect_url": "/judge/dashboard"
    }
    ```
  * *Admin 2FA Required (`200 OK`):*
    ```json
    {
      "success": true,
      "require_pin": true,
      "challenge_token": "<CHALLENGE_JWT>",
      "message": "Two-factor authentication required. Please enter your Administrator PIN."
    }
    ```
* **Error Responses:**
  * `400 Bad Request`: Missing credentials or invalid email syntax.
  * `401 Unauthorized`: Invalid password or account marked inactive (`is_active: false`).
  * `429 Too Many Requests`: Exceeded 30 requests per 15 minutes.

#### 2. POST `/api/auth/verify-login-pin`
* **Description:** Validates administrator 4-6 digit PIN against bcrypt hash to finalize 2FA login.
* **Authentication:** Public (Requires valid `challenge_token`).
* **Request Body:**
  * `challenge_token` (string, required): Temporary token issued during step 1.
  * `pin` (string, required): 4 to 6 digit administrator numeric PIN.
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "PIN verified successfully. Authentication complete.",
    "token": "<FULL_ADMIN_JWT>",
    "user": { "id": "...", "username": "admin", "role": "admin" },
    "redirect_url": "/admin/dashboard"
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Expired challenge token or missing PIN.
  * `401 Unauthorized`: Incorrect Administrator PIN.

#### 3. POST `/api/auth/logout`
* **Description:** Invalidates the current user session by incrementing `token_version` in MongoDB and clearing client-side cookies.
* **Authentication:** Optional / Authenticated (`optionalToken`).
* **Success Response (`200 OK`):** `{ "success": true, "message": "Signed out successfully." }`

#### 4. GET `/api/auth/me` and GET `/api/auth/check-session`
* **Description:** Validates active session and returns authenticated user profile.
* **Authentication:** Required (`authenticateToken`).
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "user": {
      "_id": "6735a123f456b789c012345a",
      "username": "tabulator_john",
      "email": "john@buksu.edu.ph",
      "role": "tabulator",
      "full_name": "John Smith",
      "token_version": 1
    }
  }
  ```

#### 5. POST `/api/auth/request-reset`
* **Description:** Initiates password reset by generating a cryptographic SHA-256 token and dispatching an email link.
* **Authentication:** Public (`verifyRecaptcha`, `authLimiter`).
* **Request Body:** `email` (string, required).
* **Success Response (`200 OK`):** `{ "success": true, "message": "If that email address is registered, a password reset link has been dispatched." }`

#### 6. GET `/api/auth/reset-password`
* **Description:** Validates password reset token validity and expiry before presenting reset UI.
* **Query Parameters:** `token` (string, required).
* **Success Response (`200 OK`):** `{ "success": true, "email": "user@buksu.edu.ph" }`

#### 7. POST `/api/auth/reset-password`
* **Description:** Sets new password using validated reset token.
* **Request Body:** `token` (string, required), `password` (string, required, min 8 chars), `confirm_password` (string, required).
* **Success Response (`200 OK`):** `{ "success": true, "message": "Password updated successfully." }`

#### 8. GET `/api/auth/accept-invitation` & POST `/api/auth/accept-invitation`
* **Description:** Validates token and finalizes user activation for invited judges and tabulators.
* **POST Request Body:** `token` (string), `password` (string), `confirm_password` (string), `first_name` (string), `last_name` (string).
* **Success Response (`200 OK`):** `{ "success": true, "message": "Account activated successfully." }`

#### 9. GET `/api/auth/google` & GET `/api/auth/google/callback`
* **Description:** Google OAuth 2.0 redirection and callback endpoints for institutional Single Sign-On (SSO).
* **Aliases:** `/backend/auth/google_redirect.php`, `/backend/auth/google_callback.php`.

---

### A.4.2. Module 2: Competition and Event Lifecycle Management

#### 1. GET `/api/events`
* **Description:** Retrieves competition events. Administrators receive all events; judges and tabulators receive assigned competitions.
* **Authentication:** Required (`authenticateToken`).
* **Query Parameters:** `status` (`Upcoming`, `In Progress`, `Completed`, `Archived`, `ALL`), `include_archived` (`true`/`false`).
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "events": [
      {
        "_id": "6735a987f456b789c012345b",
        "eventName": "Mr. and Ms. BukSU 2026",
        "type": "Pageant",
        "venue": "University Gymnasium",
        "date": "2026-12-15",
        "status": "In Progress",
        "judging_status": "In Progress",
        "assignedjudges": [{ "id": "...", "username": "judge1", "name": "Judge One" }],
        "tabulators": [{ "id": "...", "username": "tab1", "name": "Tabulator One" }]
      }
    ]
  }
  ```

#### 2. GET `/api/events/:id`
* **Description:** Retrieves detailed configuration for a specific event, including contestants, criteria, and assigned officials.
* **Path Parameters:** `id` (string, required): Event ObjectId.
* **Success Response (`200 OK`):** `{ "success": true, "event": { ... } }`

#### 3. POST `/api/events`
* **Description:** Creates a new competition event record.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Request Body:** `eventName` (string, required), `type` (string), `venue` (string), `date` (string, required), `start_time` (string), `description` (string), `assignedjudges` (array), `tabulators` (array).
* **Success Response (`201 Created`):** `{ "success": true, "event": { ... }, "eventId": "..." }`

#### 4. PUT `/api/events/:id`
* **Description:** Updates competition metadata. Enforces read-only safeguards if event is already `Completed`.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Success Response (`200 OK`):** `{ "success": true, "message": "Event updated successfully." }`

#### 5. DELETE `/api/events/:id`
* **Description:** Permanently deletes an event and cascades deletion across contestants, criteria, scores, and versions.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Success Response (`200 OK`):** `{ "success": true, "message": "Event and associated records deleted." }`

#### 6. PATCH `/api/events/:id/archive` & POST `/api/events/:id/archive`
* **Description:** Toggles competition archive status.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Request Body:** `archive` (boolean, default true), `status` (string, optional).
* **Success Response (`200 OK`):** `{ "success": true, "status": "Archived" }`

#### 7. POST `/api/events/:id/assign-judges`
* **Description:** Updates assigned judges and tabulators, triggering automated email and system notifications.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Request Body:** `assignedjudges` (array), `tabulators` (array).
* **Success Response (`200 OK`):** `{ "success": true, "message": "Officials assigned successfully." }`

#### 8. PATCH `/api/events/:id/judging-period`
* **Description:** State machine control for scoring periods. Validates that contestants and criteria exist before permitting transition to `In Progress`.
* **Authentication:** Required (`requireRole(['admin', 'tabulator'])`).
* **Request Body:** `action` (string, required: `start`, `stop`, `pause`, `reset`, `complete`).
* **Success Response (`200 OK`):** `{ "success": true, "event_status": "In Progress", "judging_status": "In Progress" }`

#### 9. GET `/api/events/:id/qr` & GET `/api/events/qr`
* **Description:** Generates Data URI QR code for mobile scoring portal access.
* **Authentication:** Required (`requireRole(['admin', 'tabulator'])`).
* **Success Response (`200 OK`):** `{ "success": true, "qr_code": "data:image/png;base64,...", "url": "..." }`

#### 10. GET `/api/events/:id/executive-summary`
* **Description:** Generates certified Executive Summary and Final Tabulation Report in PDF format.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Success Response (`200 OK`):** Binary stream with `Content-Type: application/pdf`.

---

### A.4.3. Module 3: Contestant and Candidate Management

#### 1. GET `/api/contestants`
* **Description:** Lists all contestants assigned to a specified competition, ordered by entry number.
* **Query Parameters:** `event_id` (string, required).
* **Success Response (`200 OK`):** `{ "success": true, "contestants": [ ... ] }`

#### 2. POST `/api/contestants`
* **Description:** Registers a new contestant under an active event.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Request Body:** `event_id` (string, required), `name` (string, required), `number` (integer/string), `representation` (string), `photo_url` / `photo_base64` (string), `details` (string).
* **Success Response (`201 Created`):** `{ "success": true, "contestant": { ... } }`

#### 3. PUT `/api/contestants/:id`
* **Description:** Updates contestant profile or allows judges to annotate citations/awards.
* **Authentication:** Required (`requireRole(['admin', 'judge'])`).
* **Success Response (`200 OK`):** `{ "success": true, "message": "Contestant updated." }`

#### 4. DELETE `/api/contestants/:id`
* **Description:** Removes contestant and cascades score removals.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Success Response (`200 OK`):** `{ "success": true, "message": "Contestant deleted." }`

#### 5. POST `/api/contestants/reorder`
* **Description:** Reorders contestant roster performance numbers.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Request Body:** `order` (array of objects: `[{ "id": "...", "number": 1 }]`).
* **Success Response (`200 OK`):** `{ "success": true, "message": "Contestant roster reordered." }`

#### 6. POST `/api/contestants/:id/comments` & DELETE `/api/contestants/:id/comments/:commentId`
* **Description:** Appends or deletes special awards and citations attributed to a contestant.
* **Authentication:** Required (`requireRole(['admin', 'judge'])`).
* **Success Response (`200 OK`):** `{ "success": true, "comments": [ ... ] }`

---

### A.4.4. Module 4: Judging Criteria and Weight Configuration

#### 1. GET `/api/criteria`
* **Description:** Retrieves all criteria configured for an event.
* **Query Parameters:** `event_id` (string, required).
* **Success Response (`200 OK`):** `{ "success": true, "criteria": [ ... ] }`

#### 2. POST `/api/criteria`
* **Description:** Creates a new judging criterion. If an array of weights is submitted, automatically routes to batch weight updates.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Request Body:** `event_id` (string), `name` (string), `weight` (numeric percentage), `max_score` (numeric, default 100), `min_score` (numeric, default 0), `score_step` (numeric, default 0.1).
* **Success Response (`201 Created`):** `{ "success": true, "criterion": { ... } }`

#### 3. PUT `/api/criteria/:id` & DELETE `/api/criteria/:id`
* **Description:** Modifies or deletes a criterion record. Blocked if event is locked/completed.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Success Response (`200 OK`):** `{ "success": true, "message": "Criterion modified." }`

#### 4. POST/PUT/PATCH `/api/criteria/weights`
* **Description:** Atomically updates percentage weights across all criteria for an event.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Request Body:** Array of criteria objects with `id` and `weight`.
* **Success Response (`200 OK`):** `{ "success": true, "message": "Weights updated successfully." }`

---

### A.4.5. Module 5: Scoring, Tabulation, and Concurrency Control

#### 1. POST `/api/scores` and POST `/api/scores/submit`
* **Description:** Submits or updates raw criterion scores for a contestant under Multi-Version Concurrency Control (MVCC). Validates that score values lie between `min_score` and `max_score`.
* **Authentication:** Required (`requireRole(['judge', 'admin'])`).
* **Request Body:**
  * `event_id` (string, required): Competition identifier.
  * `contestant_id` (string, required): Contestant identifier.
  * `criteria_scores` (object, required): Key-value pairs mapping `criterion_id` to numeric score: `{ "6735c222...": 88.5 }`.
  * `comments` (string, optional): Judge qualitative feedback.
  * `is_locked` (boolean, optional): Whether to lock submission immediately.
  * `version` (integer, optional): Expected document version for OCC verification.
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Score submission recorded.",
    "score": {
      "_id": "6735d333f456b789c012345e",
      "event_id": "...",
      "contestant_id": "...",
      "judge_id": "...",
      "total_score": 89.4,
      "version": 2,
      "is_locked": false,
      "is_verified": false
    }
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Score exceeds maximum permissible criterion points.
  * `403 Forbidden`: Unassigned judge or score record is locked.
  * `409 Conflict`: Optimistic lock failure; record was modified by another transaction.

#### 2. POST `/api/scores/lock`
* **Description:** Formalizes and locks judge score submission against further editing.
* **Authentication:** Required (`requireRole(['judge', 'admin'])`).
* **Request Body:** `event_id` (string, required), `contestant_id` (string, required).
* **Success Response (`200 OK`):** `{ "success": true, "is_locked": true }`

#### 3. POST `/api/scores/request-unlock`
* **Description:** Dispatches an unlock authorization request to tabulators and administrators.
* **Authentication:** Required (`requireRole(['judge'])`).
* **Request Body:** `event_id` (string), `contestant_id` (string), `reason` (string).
* **Success Response (`200 OK`):** `{ "success": true, "message": "Unlock request submitted." }`

#### 4. POST `/api/scores/approve-unlock`
* **Description:** Approves or denies an unlock request. Unlocking resets `is_locked: false` and increments version.
* **Authentication:** Required (`requireRole(['admin', 'tabulator'])`).
* **Request Body:** `event_id` (string), `contestant_id` (string), `judge_id` (string), `approve` (boolean).
* **Success Response (`200 OK`):** `{ "success": true, "message": "Score unlocked successfully." }`

#### 5. POST `/api/scores/self-unlock`
* **Description:** Allows a judge to self-unlock an accidental submission if the system judging policy `judge_self_unlock` is enabled.
* **Authentication:** Required (`requireRole(['judge', 'admin'])`).
* **Success Response (`200 OK`):** `{ "success": true, "message": "Self-unlock granted." }`

#### 6. POST `/api/scores/verify` and POST `/api/scores/unverify`
* **Description:** Tabulator marks a judge score submission as verified and attested.
* **Authentication:** Required (`requireRole(['admin', 'tabulator'])`).
* **Request Body:** `event_id` (string), `contestant_id` (string), `judge_id` (string), `verify_all` (boolean, optional).
* **Success Response (`200 OK`):** `{ "success": true, "is_verified": true }`

#### 7. GET `/api/scores/matrix`
* **Description:** Computes the comprehensive tabulation matrix, total weighted scores, rankings, tie-breakers, and verification summaries.
* **Authentication:** Required (`requireRole(['admin', 'tabulator', 'judge'])`).
* **Query Parameters:** `event_id` (string, required).
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "event": { "eventName": "...", "status": "In Progress" },
    "criteria": [ ... ],
    "contestants": [ ... ],
    "matrix": {
      "contestant_id": {
        "judge_id": { "criteria_scores": { ... }, "total": 92.5, "is_locked": true, "is_verified": true }
      }
    },
    "rankings": [
      { "contestant_id": "...", "name": "Maria Clara", "final_score": 94.3, "rank": 1 }
    ]
  }
  ```

#### 8. GET `/api/scores/versions`
* **Description:** Retrieves the audit trail of all historical versions for a score document from `score_versions`.
* **Authentication:** Required (`requireRole(['admin', 'tabulator', 'judge'])`).
* **Query Parameters:** `event_id` (string), `contestant_id` (string), `judge_id` (string), `score_id` (string).
* **Success Response (`200 OK`):** `{ "success": true, "versions": [ ... ] }`

#### 9. GET `/api/scores/export-pdf`
* **Description:** Generates the official printable scoring sheet and certification matrix in PDF format.
* **Authentication:** Required (`requireRole(['admin', 'tabulator'])`).
* **Query Parameters:** `event_id` (string, required), `action` (string, optional: `download` or `inline`).
* **Success Response (`200 OK`):** Binary PDF stream.

---

### A.4.6. Module 6: System Configuration, Security Controls, and Integrations

#### 1. GET `/api/settings`
* **Description:** Retrieves public branding, institution metadata, and judging policies. If authenticated as administrator, returns masked integration keys.
* **Authentication:** Public (`optionalToken`).
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "branding": {
      "institutionName": "Bukidnon State University",
      "logoUrl": "/assets/logo/DJS Logo.png",
      "primaryColor": "#1976D2",
      "signatories": [{ "name": "Dr. Czarissa Louise Navidad", "title": "Lead Tabulator" }]
    },
    "judging": {
      "scoringPrecision": 2,
      "allowSelfUnlock": false,
      "blindJudging": false
    }
  }
  ```

#### 2. GET `/api/settings/websocket-config`
* **Description:** Exposes public Pusher Channels key and cluster for client browser subscription.
* **Authentication:** Public.
* **Success Response (`200 OK`):** `{ "enabled": true, "key": "...", "cluster": "ap1" }`

#### 3. POST `/api/settings/save`
* **Description:** Saves institution branding, signatory panels, and judging operational policies.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Request Body:** `branding` (object), `judging` (object).
* **Success Response (`200 OK`):** `{ "success": true, "message": "Settings persisted." }`

#### 4. POST `/api/settings/verify-admin-pin`
* **Description:** Validates administrator PIN to issue a temporary `x-unlock-token` for modifying integration keys.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Request Body:** `pin` (string, required).
* **Success Response (`200 OK`):** `{ "success": true, "unlock_token": "..." }`

#### 5. POST `/api/settings/api-keys`
* **Description:** Updates integration API keys (Cloudinary, Pusher, SMTP, Google OAuth, reCAPTCHA), synchronizing to `.env` and MongoDB.
* **Authentication:** Required (`requireRole(['admin'])`, requires `x-unlock-token`).
* **Request Body:** `api_keys` (object).
* **Success Response (`200 OK`):** `{ "success": true, "message": "API keys updated." }`

#### 6. POST `/api/settings/validate-api-token` & POST `/api/settings/validate-all-keys`
* **Description:** Performs live ping/validation diagnostics against external service APIs.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Success Response (`200 OK`):** `{ "success": true, "statuses": { "pusher": "connected", "smtp": "connected" } }`

#### 7. POST `/api/settings/reset-integration`
* **Description:** Resets a specified external integration credentials back to factory system defaults.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Request Body:** `service` (string, required: `cloudinary`, `pusher`, `smtp`, `recaptcha`, `google_oauth`).
* **Success Response (`200 OK`):** `{ "success": true, "message": "Integration reset." }`

#### 8. POST `/api/settings/security-controls`
* **Description:** Toggles system-wide security modules (reCAPTCHA, Email OTP, WebSockets, OAuth) guarded by Email OTP challenge.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Success Response (`200 OK`):** `{ "success": true, "message": "Security toggles updated." }`

#### 9. POST `/api/settings/export-backup`
* **Description:** Exports a comprehensive cryptographic JSON archive of the entire database state.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Success Response (`200 OK`):** JSON download attachment.

#### 10. POST `/api/settings/clear-logs`
* **Description:** Purges historical audit log collections. Requires explicit typing of `"Confirm"` in payload.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Request Body:** `{ "confirmation": "Confirm" }`.
* **Success Response (`200 OK`):** `{ "success": true, "message": "Logs purged." }`

#### 11. POST `/api/settings/upload-logo` & GET/POST `/api/settings/logo-library`
* **Description:** Uploads, lists, and selects institutional logos from local repository and Cloudinary.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Success Response (`200 OK`):** `{ "success": true, "url": "..." }`

---

### A.4.7. Module 7: User Management and Administrative Governance

#### 1. GET `/api/users`
* **Description:** Lists registered accounts with role-based and search filters.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Query Parameters:** `role` (string, optional: `judge`, `tabulator`, `admin`, `all`), `search` (string, optional).
* **Success Response (`200 OK`):** `{ "success": true, "users": [ ... ] }`

#### 2. POST `/api/users`
* **Description:** Creates a new user or dispatches an invitation link.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Request Body:** `email` (string, required), `username` (string), `role` (string, required), `full_name` (string), `password` (string), `send_invitation` (boolean), `admin_pin` (string).
* **Success Response (`201 Created`):** `{ "success": true, "message": "User created.", "user": { ... } }`

#### 3. PATCH `/api/users/:id/role`
* **Description:** Modifies an account's role or toggles account activation status (`is_active`).
* **Authentication:** Required (`requireRole(['admin'])`).
* **Request Body:** `role` (string), `is_active` (boolean).
* **Success Response (`200 OK`):** `{ "success": true, "message": "User updated." }`

#### 4. POST `/api/users/:id/reset-pin`
* **Description:** Overrides or sets an Administrator PIN.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Request Body:** `new_pin` (string, required: 4-6 numeric digits).
* **Success Response (`200 OK`):** `{ "success": true, "message": "Admin PIN updated." }`

#### 5. POST `/api/users/:id/revoke-sessions`
* **Description:** Forces immediate logout across all devices for the target user by incrementing `token_version`.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Success Response (`200 OK`):** `{ "success": true, "message": "User sessions revoked." }`

#### 6. DELETE `/api/users/:id`
* **Description:** Permanently deletes an account. Prevents an administrator from self-deletion.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Success Response (`200 OK`):** `{ "success": true, "message": "User account removed." }`

#### 7. GET `/api/users/preferences` & POST `/api/users/preferences`
* **Description:** Manages individual user UI preferences (theme: `light`/`dark`, navigation layout: `sidebar`/`top`, color rule: `normal`/`three-color`).
* **Authentication:** Required (All authenticated users).
* **Success Response (`200 OK`):** `{ "success": true, "preferences": { ... } }`

---

### A.4.8. Module 8: Notifications and Invitation Dispatch

#### 1. GET `/api/notifications`
* **Description:** Retrieves system notifications and competition invitations targeted to the authenticated user.
* **Authentication:** Required (`authenticateToken`).
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "notifications": [
      {
        "_id": "6735e444f456b789c012345f",
        "type": "event_invitation",
        "title": "Judging Assignment",
        "message": "You have been assigned to judge Mr. and Ms. BukSU 2026.",
        "event_id": "6735a987f456b789c012345b",
        "status": "pending",
        "is_read": false
      }
    ]
  }
  ```

#### 2. POST `/api/notifications` and POST `/api/notifications/respond`
* **Description:** Submits user response (`accept` or `decline`) to an event invitation.
* **Authentication:** Required (`authenticateToken`).
* **Request Body:** `notification_id` (string, required), `action` (string, required: `accept` or `decline`).
* **Success Response (`200 OK`):** `{ "success": true, "message": "Invitation response recorded." }`

#### 3. PATCH `/api/notifications/:id/read` & PATCH `/api/notifications/all/read`
* **Description:** Marks individual or all notifications as read.
* **Authentication:** Required (`authenticateToken`).
* **Success Response (`200 OK`):** `{ "success": true, "message": "Notification status updated." }`

---

### A.4.9. Module 9: System Audit Logging and Compliance Trails

#### 1. GET `/api/logs`
* **Description:** Retrieves paginated, filterable security and operational audit records.
* **Authentication:** Required (`authenticateToken`). Administrators view global logs; non-administrators view only their own records.
* **Query Parameters:** `page` (integer, default 1), `limit` (integer, default 50, max 200), `role`, `action`, `search`.
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "logs": [
      {
        "_id": "6735f555f456b789c0123460",
        "user_id": "6735a123f456b789c012345a",
        "username": "judge1",
        "role": "judge",
        "action": "SUBMIT_SCORE",
        "details": "Submitted score for Contestant #1 in Event: Mr. BukSU.",
        "ip_address": "127.0.0.1",
        "timestamp": "2026-11-18T10:30:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 120, "pages": 3 }
  }
  ```

#### 2. GET `/api/logs/export/csv`
* **Description:** Streams full audit trail in RFC 4180 compliant CSV format.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Success Response (`200 OK`):** CSV file stream (`Content-Type: text/csv`).

#### 3. GET `/api/logs/export/pdf`
* **Description:** Generates formatted administrative audit report in PDF format.
* **Authentication:** Required (`requireRole(['admin'])`).
* **Success Response (`200 OK`):** PDF binary stream (`Content-Type: application/pdf`).

---

## A.5. Concurrency Control, Real-Time Architecture, and State Machines

### A.5.1. Multi-Version Concurrency Control (MVCC) on Scores
To ensure that simultaneous submissions by multiple judges or concurrent edits do not result in lost updates, JudgeTab implements an explicit document versioning protocol:
1. Every score document in the `scores` collection carries a monotonic `version` integer (starting at `1`).
2. Prior to writing, client requests can submit their known `version`.
3. The server updates the document using MongoDB conditional filtering:
   ```javascript
   const result = await collections.scores.updateOne(
       { ...scoreQuery, version: currentVersion },
       { $set: updateFields, $inc: { version: 1 } }
   );
   ```
4. If `matchedCount === 0`, another client has updated the record concurrently. The API aborts the transaction and returns `409 Conflict`.
5. Upon every successful mutation, a full historical snapshot is written to `score_versions`, capturing the complete diff, modified fields, previous values, timestamp, and author identity.

### A.5.2. Competition Lifecycle State Machine
Competitions transition through strict lifecycle states:
$$\text{Upcoming} \longrightarrow \text{In Progress} \longrightarrow \text{Completed} \longrightarrow \text{Archived}$$

* **Setup Validation Gate:** Transitioning an event from `Upcoming` to `In Progress` requires:
  1. Minimum 1 contestant registered.
  2. Minimum 1 criterion defined with total weight summing to 100%.
  3. Minimum 1 assigned judge.
* **Read-Only Safeguards:** Once an event reaches `Completed` or `Finished`, controllers (`contestantController`, `criteriaController`, `scoreController`, `eventController`) automatically reject mutations with HTTP `400 Bad Request` ("Cannot modify an event that is marked as completed or finished").

### A.5.3. Real-Time WebSocket Synchronization (Pusher Channels)
The API layer publishes state transitions to Pusher Channels (`ap1` cluster) with TLS encryption. Connected frontend clients listen to specific event channels:

| Channel Identifier | Event Name | Payload Description | Triggering Controller Action |
| :--- | :--- | :--- | :--- |
| `event-{eventId}` | `score_updated` | Contestant ID, Judge ID, Total Score, Version | `scoreController.submitScore` |
| `event-{eventId}` | `score_locked` | Contestant ID, Judge ID, Lock Status | `scoreController.lockScore` |
| `event-{eventId}` | `score_unlocked` | Contestant ID, Judge ID, Unlock Reason | `scoreController.approveUnlock` |
| `event-{eventId}` | `score_verified` | Contestant ID, Judge ID, Verifier Name | `scoreController.verifyScore` |
| `event-{eventId}` | `judging_status_changed` | Event ID, Judging Status, Timestamp | `eventController.updateJudgingPeriod` |
| `admin-channel` | `audit_log_created` | Log action, user, severity | `utils/logger.logSystemAction` |
| `user-{userId}` | `invitation_received` | Event details, notification ID | `eventController.assignJudges` |

---
