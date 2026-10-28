# CivicTrack — Community Issue Reporting and Resolution Tracker

## 1. Overview
CivicTrack is a beginner-friendly full-stack web application for reporting and following community problems such as potholes, waste collection, water supply interruptions, broken streetlights, and damaged public spaces. Citizens submit a title, category, priority, location, and description. They can see reports and follow status changes. Administrators can update an issue to Reported, In progress, Resolved, or Rejected.

## 2. Problem statement
Community problems may go unreported or be difficult to follow up on. CivicTrack provides a central place to record an issue and make its current status visible.

## 3. Objectives
- Make community issue reporting simple.
- Keep issue records in a persistent PostgreSQL database.
- Allow citizens to create accounts and track reports.
- Let administrators update issue status.
- Provide search, status filters, and summary statistics.

## 4. Roles and features
- **Visitor:** browse public reports and search/filter them.
- **Citizen:** register/sign in, submit a report, and delete their own report while it is still in Reported status.
- **Administrator:** all citizen features plus change any report's status.
- **Not included in this MVP:** photo uploads, GPS maps, email/SMS notifications, comments, and automatic assignment to municipal departments.

## 5. Technology stack
HTML5, CSS3, Vanilla JavaScript, Node.js, Express.js, Supabase PostgreSQL and Supabase Auth, Git/GitHub. Required server packages are Express, Supabase JS, dotenv, Helmet, and express-rate-limit.

## 6. Folder structure
```text
community-issue-tracker/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── server.js
│   ├── supabase.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── issues.js
│   ├── middleware/
│   │   └── auth.js
│   ├── package.json
│   ├── .env
│   ├── .env.example
│   └── .gitignore
├── database/
│   └── schema.sql
├── .gitignore
└── README.md
```

## 7. Prerequisites
Install:
- Node.js LTS and npm: https://nodejs.org/
- Visual Studio Code: https://code.visualstudio.com/
- Git: https://git-scm.com/
- A free Supabase account: https://supabase.com/

Check installations in a new terminal:
```bash
node --version
npm --version
git --version
```

## 8. Supabase database setup
1. Sign in to Supabase and create a new project.
2. Open **SQL Editor** in the project dashboard.
3. Open `database/schema.sql`, copy all its SQL, paste it into the SQL Editor, and run it.
4. Open **Table Editor** and confirm `profiles` and `issues` exist.
5. In **Project Settings → API** (the labels may vary), copy the project URL and the server-side service-role/secret key. Keep the key private. Never put it in `frontend/app.js` or commit it to GitHub.
6. In **Authentication → Providers/Sign In** check the email confirmation setting. If confirmation is enabled, a new account must confirm its email before signing in.

The schema creates a profile automatically for each new Supabase Auth user. New users are citizens by default.

## 9. Environment configuration
Open `backend/.env` and replace the placeholders:
```env
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SECRET_KEY
```
Use the actual project URL and server-only key from your own Supabase project. The values in the included `.env` are placeholders and will not connect until replaced. `.env` is private and ignored by Git; `.env.example` documents variable names and is safe to commit. If your Supabase dashboard calls the privileged key a `secret` key instead of `service_role`, use the server-side key supported by your project. Never expose it in the browser.

## 10. Install and run (Windows)
1. Open the `community-issue-tracker` folder in VS Code.
2. Choose **Terminal → New Terminal**.
3. Move into the backend folder:
   ```bash
   cd backend
   ```
4. Install dependencies:
   ```bash
   npm install
   ```
5. Ensure `backend/.env` has your real values.
6. Start the server:
   ```bash
   npm start
   ```
   Expected terminal output: `CivicTrack running at http://localhost:3000`
7. Open `http://localhost:3000` in your browser. Do not open `index.html` directly from File Explorer; Express serves the frontend and API together.
8. To check the server and database, visit `http://localhost:3000/api/health`. A working setup returns `{"status":"ok","database":"connected"}`.

For development with Node.js watch mode, use `npm run dev` in `backend/`.

## 11. How the application works
1. The browser displays the HTML/CSS interface and uses `fetch()` to call Express.
2. Express validates incoming requests and uses the Supabase client to read/write PostgreSQL.
3. Supabase Auth handles password storage and issues access tokens.
4. The backend verifies bearer tokens with Supabase Auth and loads the user's role from `profiles`.
5. The backend enforces ownership and administrator permissions. The privileged Supabase key stays on the server.

## 12. API endpoints
All request bodies are JSON. Authenticated routes require `Authorization: Bearer <access_token>`.

| Method | Path | Purpose | Access |
|---|---|---|---|
| GET | `/api/health` | Check API and database | Public |
| POST | `/api/auth/register` | Create citizen account | Public, rate-limited |
| POST | `/api/auth/login` | Sign in | Public, rate-limited |
| GET | `/api/auth/me` | Get current profile | Signed in |
| GET | `/api/issues` | List latest 100 reports; optional `?status=resolved` | Public |
| POST | `/api/issues` | Create a report | Citizen/admin signed in |
| PATCH | `/api/issues/:id/status` | Change status | Admin only |
| DELETE | `/api/issues/:id` | Delete report | Owner if still reported, or admin |

Example report body:
```json
{
  "title": "Streetlight not working",
  "category": "Streetlights",
  "priority": "medium",
  "location": "Near the community park",
  "description": "The streetlight near the park entrance has not been working for three nights."
}
```
Possible errors include `400` invalid input, `401` missing/invalid session, `403` insufficient permission, `404` missing report or route, `409` deletion conflict, and `500` unexpected server error. The server logs technical error details locally but does not return database internals to the browser.

## 13. Make an administrator
Registration always creates a citizen profile. To promote your own account:
1. Register and sign in once so the profile exists.
2. In Supabase **Table Editor → profiles**, locate your profile by its ID/email-related account ID (you can also find the ID under Authentication → Users).
3. Change `role` from `citizen` to `admin`.
4. Sign out and sign back in so the app loads your updated role.
Only a trusted project owner should perform this database change. Never add an endpoint that lets users change their own role.

## 14. Testing checklist
- [ ] `/api/health` returns database connected.
- [ ] Visitor can browse reports and use search/status filters.
- [ ] Invalid/short report fields are rejected with a friendly message.
- [ ] Citizen can register/sign in and submit a valid issue.
- [ ] A created issue appears after refresh (proves persistence).
- [ ] Citizen can delete their own issue only while it is `reported`.
- [ ] Citizen cannot change a status through the admin endpoint (expect 403).
- [ ] Citizen cannot delete another user's issue (expect 403).
- [ ] Admin can change issue status; the updated status persists after refresh.
- [ ] Unknown issue ID returns 404.
- [ ] Empty database shows a helpful empty state.
- [ ] Search and filters work together.
- [ ] Layout is usable on phone, tablet, and desktop.
- [ ] Invalid or expired token is rejected.

## 15. Troubleshooting
- **`Missing SUPABASE_URL...`:** replace the placeholders in `backend/.env`, then restart the server.
- **Database unavailable / health returns 503:** confirm the project URL, server-only key, and that `database/schema.sql` ran successfully.
- **`relation ... does not exist`:** rerun the SQL schema in the correct Supabase project.
- **Registration says confirm your email:** check the inbox and confirm before signing in, or adjust email confirmation for a class demo in Supabase Auth settings.
- **Profile not found:** check that the `handle_new_user` trigger exists and the user has a row in `profiles`.
- **Port already in use:** set another `PORT` such as `3001` in `.env` and open that port in the browser.
- **Changes not visible:** refresh the page; restart the server after backend changes.
- **Admin controls missing:** change the profile role in Supabase Table Editor, then sign out and sign in again.
- **`npm` not recognized:** reinstall Node.js LTS and reopen the terminal.

## 16. Git and GitHub upload
From the project root, create a new empty repository on https://github.com/ and copy its HTTPS URL. Then run:
```bash
git init
git status
git add .
git status
git commit -m "Build community issue tracker"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```
Replace `YOUR_GITHUB_REPOSITORY_URL` with your own repository URL. Before committing, check that `backend/.env`, `node_modules/`, database exports, and private data are not staged. `backend/.env.example` should be included. `.gitignore` does not remove secrets that were already committed; if a key is exposed, rotate it immediately and clean the repository history.

## 17. Security notes and limitations
- Server-side validation, token verification, role checks, rate limiting, and security headers are included.
- The server uses a privileged Supabase key, so authorization checks in Express are critical. The browser never receives this key. PostgreSQL RLS is enabled with no direct browser policies because the browser does not connect to Supabase directly.
- This MVP uses a bearer token kept in `sessionStorage`, which clears when the browser tab/session ends but is still accessible to scripts running on the page. Do not reuse passwords from important accounts. A production deployment should consider stronger session handling, monitoring, backups, and a reviewed authorization policy.
- No official municipality integration is provided. A report in CivicTrack is not automatically sent to a government department or emergency service.

## 18. Future improvements
Photo attachments, department assignment, report comments, email notifications, map pins, duplicate-report detection, and admin activity history.
