# Appendix B: External Application Programming Interface (API) Documentation

## B.1. Architectural Overview of External Services and Cloud Subsystems

The Digitalized Judging and Tabulation System (**BukSU DigiTab** / **JudgeTab**) integrates multiple external Cloud Application Programming Interfaces (APIs), Software Development Kits (SDKs), and specialized third-party services. These integrations augment the core Node.js / Express backend with cloud-scale identity federation, automated anti-automation defenses, distributed media storage, transactional notifications, real-time WebSocket state broadcasting, and multi-format document rendering.

To guarantee high availability, system resilience, and compliance with information assurance standards (IT135), every external integration is decoupled through dedicated service adapters (`utils/`), guarded by administrative toggles in **System Settings > Security & Infrastructure**, and engineered with graceful local fallbacks.

### B.1.1. Master Integration Matrix

| Integration Domain | Third-Party Provider / Technology | Integration Method / SDK | Specific Functional Role in BukSU DigiTab |
| :--- | :--- | :--- | :--- |
| **Federated Identity** | Google Identity Platform | REST API via `axios` (`oauth2.googleapis.com`) | Institutional Google Single Sign-On (SSO) and automated administrator account bootstrapping. |
| **Bot & Sybil Defense** | Google reCAPTCHA v2 / v3 | REST API via `axios` (`google.com/recaptcha`) | Cryptographic bot challenge validation on public sign-in and password reset forms. |
| **Cloud Media Storage** | Cloudinary Media API | Official Node.js SDK (`cloudinary` v2) | Cloud-hosted storage, optimization, and transformation for contestant portraits and institution logos. |
| **Email Messaging** | Gmail SMTP / Nodemailer | `nodemailer` (SMTP transport) | Transactional delivery of judge invitations, password reset links, and administrative security OTPs. |
| **Real-Time WebSockets**| Pusher Channels | Official Node.js SDK (`pusher`) & `pusher-js` | Sub-second real-time broadcasting of score changes, locking states, unlock requests, and status sync. |
| **QR Code Engine** | node-qrcode (`qrcode`) | Node.js library (`qrcode` v1.5.4) | On-the-fly generation of high-resolution Data URI QR codes for quick mobile judging terminal access. |
| **Document Rendering** | pdfmake Engine | `pdfmake` (Node.js & browser bundle) | Dynamic compilation of official scoring sheets, certified executive summaries, and audit trail reports. |
| **Cloud Persistence** | MongoDB Atlas | Official Node.js Driver (`mongodb` v7.8) | Cloud-native multi-collection persistence, index management, and atomic transaction coordination. |

---

## B.2. Google OAuth 2.0 Identity Platform

### B.2.1. Service Overview & Purpose
* **Provider:** Google Identity Services (Google LLC).
* **Integration Method:** Server-to-server HTTP REST protocol executed via `axios` (`controllers/authController.js`).
* **Functional Role:** Provides Single Sign-On (SSO) authentication using verified Google accounts. In addition, an automated administrative bootstrapping mechanism checks incoming emails against `ADMIN_CREATOR_EMAILS`; if authorized, it automatically provisions the user as a System Administrator with an initial 2FA PIN.

### B.2.2. Authentication & Configuration
* **Environment Variables:**
  * `GOOGLE_CLIENT_ID`: Public OAuth 2.0 Client Identifier generated in Google Cloud Console.
  * `GOOGLE_CLIENT_SECRET`: Cryptographic shared secret for server-side token exchange.
  * `GOOGLE_REDIRECT_URI`: Registered authorization callback URL (e.g., `http://localhost:8000/backend/auth/google_callback.php` or `https://<domain>/api/auth/google/callback`).
  * `ADMIN_CREATOR_EMAILS`: Comma-separated list of institutional email addresses permitted to auto-provision administrative accounts.
* **OAuth 2.0 Scopes:** `openid email profile`
* **Dashboard Toggle:** Enabled by default; toggled via **System Settings > Security & Infrastructure** (`googleAuthEnabled`).

### B.2.3. Integration Workflow & Endpoints Used
1. **Authorization Initiation:** The client browser requests `GET /api/auth/google` (aliased as `/backend/auth/google_redirect.php`). The server generates a cryptographic 16-byte random hex string (`oauth_state`), saves it into an HTTP-only cookie (`oauth_state`, TTL 10 minutes), and redirects the browser:
   * **Endpoint:** `https://accounts.google.com/o/oauth2/v2/auth`
   * **Query Parameters:** `client_id`, `redirect_uri`, `response_type=code`, `scope=email profile openid`, `state=<state_hex>`, `prompt=select_account`.
2. **Token Exchange:** Google redirects back to `GET /api/auth/google/callback` with `code` and `state`. The server validates `state` against `req.cookies.oauth_state` to prevent CSRF, then executes a server-to-server POST request:
   * **Endpoint:** `https://oauth2.googleapis.com/token`
   * **Headers:** `Content-Type: application/json`
   * **Payload:**
     ```json
     {
       "code": "4/0AX4XfWh...",
       "client_id": "<GOOGLE_CLIENT_ID>",
       "client_secret": "<GOOGLE_CLIENT_SECRET>",
       "redirect_uri": "<GOOGLE_REDIRECT_URI>",
       "grant_type": "authorization_code"
     }
     ```
   * **Response:** `{ "access_token": "ya29...", "id_token": "eyJ...", "expires_in": 3599, "token_type": "Bearer" }`
3. **Profile Ingestion:** The server queries the userinfo endpoint using the retrieved access token:
   * **Endpoint:** `https://www.googleapis.com/oauth2/v3/userinfo`
   * **Headers:** `Authorization: Bearer <access_token>`
   * **Response:**
     ```json
     {
       "sub": "110293847562839102938",
       "name": "Czarissa Louise Navidad",
       "given_name": "Czarissa Louise",
       "family_name": "Navidad",
       "picture": "https://lh3.googleusercontent.com/a/...",
       "email": "czarissa@buksu.edu.ph",
       "email_verified": true
     }
     ```
4. **Session Finalization & 2FA:** If the resolved account possesses the `admin` role, the server generates a short-lived (5-minute) `admin_login_challenge` JWT and prompts for the 2FA Admin PIN. For regular judges and tabulators, `token_version` is bumped (MVCC), standard JWT session cookies (`djs_token`, `jwt_token`) are set, and the user is redirected to their respective dashboard.

### B.2.4. Error Handling & Fallback Behavior
* **OAuth Rejection / User Cancellation:** Redirects to `/auth/login?error=oauth_denied`.
* **Unverified Email:** If `email_verified` is false, authentication is aborted with `/auth/login?error=unverified_email`.
* **Missing Account:** If the email does not exist in the database and is not authorized in `ADMIN_CREATOR_EMAILS`, redirects to `/auth/login?error=no_account&email=<email>`.
* **Service Disconnection:** If Google servers are unreachable or credentials are unconfigured, standard email/password authentication remains active and unaffected as a fallback.

---

## B.3. Google reCAPTCHA v2 / v3 Bot Protection API

### B.3.1. Service Overview & Purpose
* **Provider:** Google reCAPTCHA (Google LLC).
* **Integration Method:** Express middleware (`middleware/recaptcha.js`) issuing HTTP POST requests via `axios`.
* **Functional Role:** Protects public access portals (`POST /api/auth/login` and `POST /api/auth/request-reset`) against automated credential stuffing, brute-force dictionary attacks, and denial-of-service spamming.

### B.3.2. Authentication & Configuration
* **Environment Variables:**
  * `RECAPTCHA_SITE_KEY`: Public site key injected into frontend HTML/EJS templates to render the client challenge widget.
  * `RECAPTCHA_SECRET_KEY`: Private key held strictly on the server to verify user response tokens.
* **Dashboard Toggle:** Managed via **System Settings > Security & Infrastructure** (`recaptchaEnabled`).

### B.3.3. Integration Workflow & Endpoints Used
1. **Client Submission:** The frontend renders the reCAPTCHA widget (`<div class="g-recaptcha" data-sitekey="...">`). Upon completion, the user submits `g-recaptcha-response` alongside form data.
2. **Server-Side Verification:** Prior to executing authentication controllers, `middleware/recaptcha.js` captures `recaptcha_token` and executes an outbound verification request:
   * **Endpoint:** `https://www.google.com/recaptcha/api/siteverify`
   * **Method:** `POST`
   * **URL-Encoded Parameters:** `secret=<RECAPTCHA_SECRET_KEY>&response=<USER_RESPONSE_TOKEN>`
   * **Response:**
     ```json
     {
       "success": true,
       "challenge_ts": "2026-11-19T14:00:00Z",
       "hostname": "buksu-judgetab.edu.ph"
     }
     ```
3. **Evaluation:** If `success === true`, the request proceeds to the route controller. If `success === false`, the server responds with HTTP `400 Bad Request` (`"reCAPTCHA verification failed. Please try again."`).

### B.3.4. Error Handling & Fallback Behavior
* **Administrative Bypass:** If `recaptchaEnabled === false` in `system_settings`, verification is bypassed immediately.
* **Unconfigured Secret:** If `RECAPTCHA_SECRET_KEY` is empty, middleware fails open gracefully to prevent locking administrators out of the system.
* **Network Timeout / Service Outage:** If the Google siteverify endpoint times out (`ETIMEDOUT`, `ENOTFOUND`, or connection refused), the middleware logs an error and executes `next()` to maintain application accessibility during external network disruptions.
* **Development Sandbox Bypass:** In non-production environments (`NODE_ENV !== 'production'`), a test token (`test_bypass`) permits automated testing without human interaction.

---

## B.4. Cloudinary Media Storage and Asset Management API

### B.4.1. Service Overview & Purpose
* **Provider:** Cloudinary Ltd.
* **Integration Method:** Official Node.js SDK (`cloudinary` v2) encapsulated in `utils/cloudinary.js`.
* **Functional Role:** Provides persistent cloud-based storage, on-the-fly optimization, automatic format delivery (WebP/AVIF), and CDN caching for candidate photographs and university institution logos.

### B.4.2. Authentication & Configuration
* **Environment Variables:**
  * `CLOUDINARY_CLOUD_NAME`: Unique Cloudinary account namespace.
  * `CLOUDINARY_API_KEY`: Account API key for request authentication.
  * `CLOUDINARY_API_SECRET`: Cryptographic secret signature key.
  * `CLOUDINARY_FOLDER`: Root asset folder name (default: `djs_system_assets`).
* **Dashboard Toggle:** Managed via **System Settings > Security & Infrastructure** (`cloudinaryEnabled`).

### B.4.3. Integration Workflow & Endpoints Used
1. **Asset Submission:** Administrators upload images as Base64 Data URIs (`data:image/png;base64,...`) or binary file buffers via `/api/settings/upload-logo` or `/api/contestants`.
2. **SDK Initialization & Dispatch:** `utils/cloudinary.js` initializes the Cloudinary singleton (`cloudinary.config({ cloud_name, api_key, api_secret, secure: true })`) and invokes the upload pipeline:
   * **Method:** `cloudinary.uploader.upload(fileData, { folder: 'djs_system_assets', resource_type: 'auto' })`
   * **Response:**
     ```json
     {
       "public_id": "djs_system_assets/logo_6735a123",
       "version": 1732000000,
       "format": "png",
       "width": 800,
       "height": 800,
       "secure_url": "https://res.cloudinary.com/<cloud_name>/image/upload/v1732000000/djs_system_assets/logo_6735a123.png"
     }
     ```
3. **Database Reference:** The immutable `secure_url` is stored in MongoDB (`settings.branding.logoUrl` or `contestants.photo_url`).

### B.4.4. Error Handling & Fallback Behavior
* **Local Filesystem Fallback:** When Cloudinary credentials are missing or `cloudinaryEnabled === false`, uploads are automatically routed to the server's local disk under `/uploads/` using unique filenames (`/uploads/logo-1732000000.png`), served statically via Express.
* **Base64 Inline Fallback:** For small institution logos or emergency scenarios, the system preserves and renders the raw Base64 data URI directly within EJS templates and generated PDF documents.
* **Diagnostic Verification:** The diagnostic endpoint `POST /api/settings/validate-api-token` tests Cloudinary connectivity using `cloudinary.api.ping({ timeout: 6000 })`, safely catching network isolation errors without halting the server.

---

## B.5. Simple Mail Transfer Protocol (SMTP) Email Service (Nodemailer / Gmail)

### B.5.1. Service Overview & Purpose
* **Provider:** SMTP Transport (Google Workspace / Gmail SMTP or Custom Academic Relay).
* **Integration Method:** `nodemailer` (v10.3) module implemented in `utils/mailer.js`.
* **Functional Role:** Dispatches mission-critical transactional emails, including official event judging assignments, invitation tokens for judges/tabulators, password reset links, and sensitive 2FA/Security OTP verification codes.

### B.5.2. Authentication & Configuration
* **Environment Variables:**
  * `SMTP_HOST`: Mail server hostname (default: `smtp.gmail.com`).
  * `SMTP_PORT`: Mail server port (default: `587` for STARTTLS, `465` for SSL).
  * `SMTP_SECURE`: Encryption protocol (`tls` or `ssl`).
  * `SMTP_USERNAME`: SMTP user account email address.
  * `SMTP_PASSWORD`: 16-character Google App Password or SMTP relay password.
  * `SMTP_FROM_EMAIL`: Authorized sender address.
  * `SMTP_FROM_NAME`: Human-readable sender title (default: `"Digitalized Judging System"`).
* **Dashboard Toggle:** Managed via **System Settings > Security & Infrastructure** (`emailServiceEnabled`).

### B.5.3. Integration Workflow & Endpoints Used
1. **Transporter Creation:** `createTransporter()` creates a Nodemailer transport instance with explicit TLS rejection controls:
   ```javascript
   nodemailer.createTransport({
       host: process.env.SMTP_HOST,
       port: parseInt(process.env.SMTP_PORT, 10),
       secure: process.env.SMTP_PORT === '465',
       auth: { user: process.env.SMTP_USERNAME, pass: process.env.SMTP_PASSWORD },
       tls: { rejectUnauthorized: false }
   });
   ```
2. **Message Dispatch:** `sendSystemEmail(to, subject, htmlContent, forceSend)` compiles responsive HTML email templates and transmits the message over the verified socket:
   * **Method:** `transporter.sendMail({ from, to, subject, html })`
   * **Success Output:** `{ "success": true, "messageId": "<6735a123-456b-789c@smtp.gmail.com>" }`
3. **Security Bypass (`forceSend`):** When critical security operations execute (such as administrative password resets or Security Controls OTP generation), `forceSend: true` bypasses any administrative email disabling toggle.

### B.5.4. Error Handling & Fallback Behavior
* **In-App Notification Fallback:** When invitations are dispatched to judges or tabulators and email delivery fails or is unconfigured, the system automatically writes internal notification records to the `notifications` MongoDB collection. Users can accept assignments directly via `/api/notifications/respond`.
* **Console Logging Simulation:** If SMTP credentials are empty in development mode, the outgoing message details and security tokens are logged to `stdout`, preventing development bottlenecks.
* **On-Demand Transport Verification:** Administrators can test SMTP connectivity via `POST /api/settings/validate-api-token` using `transporter.verify()`.

---

## B.6. Real-Time WebSocket Infrastructure (Pusher Channels API)

### B.6.1. Service Overview & Purpose
* **Provider:** Pusher Channels (Pusher Ltd. / Soketi self-hosted compatibility).
* **Integration Method:** Server-side `pusher` (v5.3) Node.js library (`utils/pusher.js`) and client-side `pusher-js` browser subscriber (`scripts/utils/websocket.js`).
* **Functional Role:** Enables sub-second distributed synchronization across judge scoring pads, tabulator review matrices, administrative dashboards, and live public display screens. Broadcasts score submissions, score locks, unlock requests, verification stamps, and judging status changes.

### B.6.2. Authentication & Configuration
* **Environment Variables:**
  * `PUSHER_APP_ID`: Application identifier within the Pusher dashboard.
  * `PUSHER_KEY`: Public application key distributed to browser clients.
  * `PUSHER_SECRET`: Server secret key used for HMAC request signing.
  * `PUSHER_CLUSTER`: Geographic datacenter cluster (default: `ap1` - Asia Pacific / Singapore).
* **Dashboard Toggle:** Managed via **System Settings > Security & Infrastructure** (`websocketEnabled`).
* **Public Client Route:** `GET /api/settings/websocket-config` exposes `{ enabled, is_configured, key, cluster }`.

### B.6.3. Integration Workflow & Endpoints Used
1. **Server Initialization:** The server creates a singleton Pusher client with enforced TLS:
   ```javascript
   new Pusher({ appId, key, secret, cluster, useTLS: true });
   ```
2. **Event Triggering:** When state changes occur in `scoreController` or `eventController`, `triggerPusherEvent(channel, event, payload)` publishes the change:
   * **SDK Method:** `pusher.trigger(channel, event, data)`
   * **Outbound HTTPS Endpoint:** `https://api-<cluster>.pusher.com/apps/<app_id>/events`
   * **Sample Broadcast Payload:**
     ```json
     {
       "channel": "event-6735a987f456b789c012345b",
       "event": "score_updated",
       "data": {
         "contestant_id": "6735b111f456b789c012345c",
         "judge_id": "6735a123f456b789c012345a",
         "total_score": 92.5,
         "version": 3,
         "is_locked": false,
         "is_verified": false
       }
     }
     ```
3. **Client Ingestion:** Client browsers subscribe via Pusher JS:
   ```javascript
   const pusher = new Pusher(config.key, { cluster: config.cluster });
   const channel = pusher.subscribe(`event-${eventId}`);
   channel.bind('score_updated', (data) => updateTabulationMatrix(data));
   ```

### B.6.4. Error Handling & Fallback Behavior
* **HTTP Polling Fallback:** If Pusher credentials are not provided or WebSocket connections drop, client dashboard scripts automatically engage exponential backoff HTTP polling against `GET /api/scores/matrix?event_id=...`.
* **Silent Error Suppression:** Trigger failures in `utils/pusher.js` catch errors and return `{ success: false, error }` without blocking database write transactions.
* **On-Demand Health Diagnostics:** Administrators can verify real-time connectivity through `POST /api/settings/validate-api-token` via `pusher.get({ path: '/channels' })`.

---

## B.7. Quick Response (QR) Code Generation Engine (`qrcode`)

### B.7.1. Service Overview & Purpose
* **Provider:** node-qrcode (`qrcode` npm ecosystem).
* **Integration Method:** Server-side utility library (`utils/qrcode.js`).
* **Functional Role:** Generates scannable 2D barcodes encoding secure competition URLs, enabling officials, judges, and authorized spectators to access specific judging dashboards instantly from mobile smartphones and tablets.

### B.7.2. Authentication & Configuration
* **Dependencies:** Packaged locally as `qrcode` (v1.5.4); requires no external network credentials.
* **Styling Parameters:** Configured with BukSU institutional branding palette:
  * `color.dark`: `#0F2C59` (BukSU Navy Blue).
  * `color.light`: `#FFFFFF` (High-contrast pure white).
  * `errorCorrectionLevel`: `'M'` (Standard 15% error recovery).
  * `margin`: `2` quiet zone modules.
  * `width`: `300` pixels.

### B.7.3. Integration Workflow & Endpoints Used
1. **API Invocations:** Administrators or tabulators request `GET /api/events/:id/qr` or `GET /api/events/qr?event_id=...`.
2. **Barcode Rendering:** `generateQRCodeDataURL(targetUrl, options)` encodes the target address:
   * **Method:** `QRCode.toDataURL(text, qrOptions)`
   * **Method Variant:** `QRCode.toString(text, { type: 'svg' })` (for scalable vector displays).
3. **Response Schema (`200 OK`):**
   ```json
   {
     "success": true,
     "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...",
     "qr_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...",
     "event_id": "6735a987f456b789c012345b",
     "url": "https://judgetab.buksu.edu.ph/dashboard?event=6735a987f456b789c012345b"
   }
   ```

### B.7.4. Error Handling & Fallback Behavior
* **Plain Text URL Fallback:** If canvas or image conversion fails, the API responds with the raw canonical event URL, allowing clients to present a clickable hyperlink or copy-to-clipboard action.
* **SVG Vector Fallback:** If PNG rendering encounters memory or font constraints, `generateQRCodeSVG()` generates lightweight inline SVG markup.

---

## B.8. Portable Document Format (PDF) Generation Architecture (`pdfmake`)

### B.8.1. Service Overview & Purpose
* **Provider:** pdfmake Engine (Open Source).
* **Integration Method:** Dual-mode integration: Server-side Node.js rendering (`pdfmake` v0.3.14) and client-side browser generation via `/vendor/pdfmake` static distribution (`views/partials/head.ejs`).
* **Functional Role:** Compiles and streams official, tamper-evident scoring sheets, certified executive competition summaries with signatory panels, and administrative audit trails.

### B.8.2. Authentication & Configuration
* **Dependencies:** Server package `pdfmake` and font bundle `pdfmake/fonts/Roboto`. Client files served via Express: `app.use('/vendor/pdfmake', express.static(...))`.
* **Security & Access Policies:**
  ```javascript
  pdfmake.setFonts(require('pdfmake/fonts/Roboto'));
  pdfmake.setUrlAccessPolicy(() => true);
  pdfmake.setLocalAccessPolicy(() => true);
  ```

### B.8.3. Integration Workflow & Endpoints Used
1. **Document Definition (`docDefinition`):** Specialized generator utilities (`tabulationPdfGenerator.js`, `executiveSummaryPdfGenerator.js`, `auditLogPdfGenerator.js`) construct structured JSON definitions describing page layout (landscape/portrait), headers, data tables, institution logos, computed averages, and signatory lines.
2. **Buffer Compilation:**
   * **Method:** `const pdfDoc = pdfmake.createPdf(docDefinition);` followed by `pdfDoc.getBuffer((buffer) => { ... });`
3. **Binary Streaming:** The server sets HTTP headers and streams binary data:
   * **Headers:** `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="Official_Tabulation_<Event>.pdf"`
4. **Triggering Routes:**
   * `GET /api/scores/export-pdf?event_id=...`
   * `GET /api/events/:id/executive-summary`
   * `GET /api/logs/export/pdf`

### B.8.4. Error Handling & Fallback Behavior
* **Client-Side Fallback:** If a server-side PDF route encounters network errors or timeouts during heavy load, `tabulatorUI.js` intercepts the error and executes client-side compilation via browser `pdfmake.min.js`:
  ```javascript
  console.warn('[PDF Export] Server route unavailable. Falling back to client-side pdfmake.');
  pdfmake.createPdf(docDefinition).download(`Tabulation_${eventId}.pdf`);
  ```
* **Image Sanitization:** Image Data URIs embedded into PDFs are pre-validated to ensure valid PNG/JPEG headers, preventing "Unknown image format" compilation crashes.
* **CSV Export Fallback:** For tabular datasets (e.g., system audit logs), `GET /api/logs/export/csv` provides an alternative plain-text export format.

---

## B.9. MongoDB Atlas Cloud Database Driver (`mongodb`)

### B.9.1. Service Overview & Purpose
* **Provider:** MongoDB Atlas (MongoDB Inc.).
* **Integration Method:** Official MongoDB Node.js Native Driver (`mongodb` v7.8) initialized in `config/db.js`.
* **Functional Role:** Provides distributed, cloud-hosted document persistence across ten application collections: `users`, `events`, `contestants`, `criteria`, `scores`, `score_versions`, `settings`, `logs`, `notifications`, and `logo_library`.

### B.9.2. Authentication & Configuration
* **Environment Variables:**
  * `MONGODB_URI`: High-security MongoDB connection string utilizing the DNS Seed List (`mongodb+srv://<username>:<password>@cluster0.mongodb.net/djs_db?retryWrites=true&w=majority`).
  * `DB_NAME`: Database name (default: `djs_database`).
* **Connection Pooling:** Configured with persistent connection reuse across all Express controller invocations.
* **Dynamic Configuration Sync:** System settings and external integration keys stored in collection `settings` (`_id: "system_settings"`) are read on startup and dynamically synchronized into `process.env`.

### B.9.3. Integration Workflow & Endpoints Used
1. **Connection Lifecycle:** `server.js` calls `connectDB()` during startup. The client connects over TLS, asserts collection indexes (unique username, email, event-contestant-judge compound indexes), and seeds the system settings document if absent.
2. **Collection Operations:** Controllers perform atomic operations (`findOne`, `insertOne`, `updateOne`, `deleteMany`) through the exported `collections` dictionary.
3. **Atomic Score Versioning:** Every score write executes a conditional atomic update on `scores` and records an immutable differential entry in `score_versions`.

### B.9.4. Error Handling & Fallback Behavior
* **Startup Gate:** If MongoDB Atlas is unreachable during boot, `connectDB()` catches the exception, logs a fatal error to `stderr`, and terminates the process with `process.exit(1)`, preventing corruption or unauthenticated states.
* **Network Interruption Resilience:** The native driver's automated retry logic (`retryWrites=true`) transparently absorbs transient network blips and replica set primary elections without failing in-flight client requests.

---
