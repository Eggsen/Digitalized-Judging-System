# BukSU Digitalized Judging System (JudgeTab)

> A secure, real-time competition judging, tabulation, and event management platform engineered for institutional academic, cultural, and sports competitions at Bukidnon State University.

---

## 📌 Overview

The **BukSU Digitalized Judging System (DJS / JudgeTab)** modernizes institutional event judging and tabulation by replacing manual paper scorecards with an encrypted, synchronized, and automated digital platform. 

It provides dedicated, role-specific portals for **Administrators**, **Judges**, and **Tabulators**, featuring live score broadcasting, flexible scoring rubrics, mathematical tie-breaking protocols, and tamper-resistant audit trails.

---

## ✨ Key Features

### 1. Multi-Role Dashboard & Access Control
- **Administrator Portal:** Create competitions, manage criteria and sub-criteria, configure weights, register contestants, invite judges/tabulators, upload university logos, and view system audit logs.
- **Judge Portal:** Real-time scoring interface with automatic max-point calculations, criteria guidelines, and locked submit safeguards to prevent accidental re-submissions.
- **Tabulator Portal:** Live tabulation matrix, score verification/unverification tools, discrepancy flags, and official locked PDF report generation.

### 2. Tabulation & Judging Rules Engine
- **Scoring Modes:**
  - **Category / Criteria-Based:** Weighted criteria with optional sub-criteria breakdowns and automatic maximum score deduction.
  - **Ordinal Ranking:** Converts total point scores into discrete ordinal ranks (1st, 2nd, 3rd, etc.) per judge to eliminate scoring skew across evaluators.
- **Automated Tie-Breaking Protocols:**
  - `Highest Weight Criterion`: Evaluates scores on the highest-weighted rubric criterion.
  - `Judge Majority Vote`: Assigns higher placement based on head-to-head judge majorities.
  - `Split Award`: Retains mathematically tied ranks and splits honors evenly.
- **Blind Judging Mode:** Anonymizes contestant names and colleges on judge scorecards (e.g., *Contestant #1*), enforcing unbiased evaluation.
- **Role Permissions Enforcement:** Prevents unauthorized export or QR sharing by judges while granting complete auditing access to tabulators and admins.

### 3. Concurrency & Data Integrity
- **Multiversion Concurrency Control (MVCC):** Implements optimistic locking via document versioning (`$inc: { version: 1 }`). If a score is modified concurrently, version collision detection prevents race conditions and data overwrites.
- **Real-Time Synchronization:** Pusher WebSockets provide instant updates for score submissions, judge verification status, and event lifecycle changes, paired with an adaptive fallback polling mechanism.

### 4. Enterprise Security & Hardening
- **Authentication:** Stateless JSON Web Tokens (JWT) stored in secure, `HttpOnly`, `SameSite=Lax` cookies.
- **Brute-Force & Abuse Prevention:** Layered rate limiting via `express-rate-limit` (30 auth attempts/15 min, 300 API req/min), automated account lockout, and Google reCAPTCHA v2 verification.
- **2FA Admin Authorization:** Elevated operations (e.g., system configuration changes, API key updates) require secondary Admin Security PIN verification.
- **HTTP Security Headers:** `helmet` integration configured for cross-origin resource protection and clickjacking defense (`X-Frame-Options: SAMEORIGIN`).
- **Comprehensive Audit Trail:** Logs all critical system actions (logins, score submissions, score un-verifications, parameter changes) with IP addresses and sortable timestamps.

### 5. Media, QR & Reporting
- **PDF Report Generation:** Server-side PDF generation using `pdfmake` to export official tabulation sheets complete with digital signatures and matrix grids.
- **QR Code Deep Linking:** Instant event onboarding allowing judges and tabulators to accept invitations and jump straight to their assigned scoring rooms.
- **Branding & Logo Library:** University and sponsor asset management with Cloudinary cloud storage and local filesystem fallbacks.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Backend Runtime** | [Node.js](https://nodejs.org/) (v20+ LTS) |
| **Application Framework** | [Express.js](https://expressjs.com/) (v5) |
| **Database** | [MongoDB](https://www.mongodb.com/) (Native Driver v7+) |
| **Real-Time Engine** | [Pusher Channels](https://pusher.com/) |
| **Frontend & Templating** | [EJS](https://ejs.co/) (Modular Partials), Vanilla JavaScript (ES6+ Modules) |
| **Styling & Icons** | [Tailwind CSS v4](https://tailwindcss.com/), [FontAwesome 6](https://fontawesome.com/) |
| **Security & Auth** | JWT, bcryptjs, Helmet, Express-Rate-Limit, Google reCAPTCHA v2 |
| **Document Export** | [pdfmake](https://pdfmake.github.io/docs/) |

---

## 📂 Project Structure

```text
Digitalized-Judging-System/
├── assets/                  # Static assets (logos, university badges, backgrounds)
├── auth/                    # Static landing pages (login, password reset, invitations)
├── config/
│   └── db.js                # MongoDB connection pool and collection index management
├── controllers/             # Express controllers (auth, events, scores, criteria, logs)
│   ├── authController.js
│   ├── contestantController.js
│   ├── criteriaController.js
│   ├── eventController.js
│   ├── logController.js
│   ├── notificationController.js
│   ├── scoreController.js   # MVCC score updates, ranking, tie-breaking
│   ├── settingsController.js
│   └── userController.js
├── middleware/              # Auth verification, rate limiting, and reCAPTCHA hooks
├── routes/                  # Express RESTful route definitions
├── scripts/                 # Client-side JavaScript modules
│   ├── admin/               # Admin UI and API orchestration
│   ├── judge/               # Judge scoring UI and submission handlers
│   ├── tabulator/           # Tabulation matrix and live sync UI
│   └── utils/               # Toast notifications, modals, WebSocket handlers
├── utils/                   # Helpers (PDF generator, mailer, Pusher, logger)
├── views/                   # Modular EJS templates
│   ├── admin/               # Admin tabs (events, assignments, audit logs, settings)
│   ├── components/          # Reusable preference widgets
│   ├── judge/               # Scoring modal partials
│   ├── modals/              # Shared modals (QR codes, event details)
│   ├── partials/            # Header, sidebar, head, scripts, footer
│   ├── tabulator/           # Live tabulation matrix modals
│   ├── user/                # User assigned events and personal activity logs
│   └── dashboard.ejs        # Master dashboard shell
├── server.js                # Application entrypoint & HTTP server
├── package.json             # NPM dependencies and build scripts
└── Dockerfile               # Containerization specification
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **MongoDB**: Local instance running on `mongodb://127.0.0.1:27017` or a MongoDB Atlas URI

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Eggsen/Digitalized-Judging-System.git
   cd Digitalized-Judging-System
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   ALLOWED_ORIGINS=http://localhost:5000

   # Database
   MONGODB_URI=mongodb://127.0.0.1:27017
   DB_NAME=buksu_judging_system

   # Security
   JWT_SECRET=your_secure_random_jwt_secret_key_here
   ADMIN_DEFAULT_PIN=123456

   # Pusher (WebSocket Real-Time Sync)
   PUSHER_APP_ID=your_pusher_app_id
   PUSHER_KEY=your_pusher_key
   PUSHER_SECRET=your_pusher_secret
   PUSHER_CLUSTER=ap1

   # Cloudinary (Optional - Logo Library)
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret

   # SMTP / Email Notifications (Optional)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password
   ```

4. **Build Styles:**
   Compile the Tailwind CSS stylesheet:
   ```bash
   npm run build:css
   ```

5. **Start the Application:**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```
   Open [http://localhost:5000](http://localhost:5000) in your web browser.

---

## 🌿 Git & Branching Strategy

| Branch | Purpose |
|---|---|
| `main` | Production-ready stable releases. Directly deployable. |
| `INTEGRATION` | Primary staging branch where all peer features, security patches, and UI refactors are integrated and tested together. |
| `feature/*` | Individual feature branches (e.g., `securityMVCC`) branched off `INTEGRATION` and merged back via Pull Requests. |

---

## 📄 License

Developed for academic collaboration and institutional evaluation at **Bukidnon State University (BukSU)**. All rights reserved.

