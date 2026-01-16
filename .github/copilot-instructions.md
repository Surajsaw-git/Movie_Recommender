## Repo summary

This is a small Express + MySQL app with a single-page frontend in `public/index.html`.
Key pieces:
- `server.js` — main API server (routes under `/api/*`), session handling, OAuth (Google/GitHub), admin CRUD, watchlist, recommendations and an SQL runner endpoint.
- `db.js` — exports a `mysql2/promise` connection pool; edit DB credentials here for local dev (database: `online_movie`).
- `public/index.html` — frontend that calls the backend API at `http://localhost:3000/api` in dev or `/api` in production.
- `database_migration.sql` — small migration example (adds `trailerUrl` column).

## How to run (developer workflow)
- Install deps: `npm install` (project uses `mysql2`, `express`, `passport`, `express-session`, `express-mysql-session`, `cors`).
- Start server: `npm start` (runs `node server.js`).
- DB: update credentials in `db.js` and ensure a MySQL database named `online_movie` exists. `db.js` creates a connection pool used by the app.

Environment variables the server expects (set in your environment or host dashboard):
- `FRONTEND_ORIGIN` — URL allowed by CORS (default `http://localhost:5500`).
- `SESSION_SECRET` — required for session cookies (default `dev_secret_change_me` in dev only).
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — enable Google OAuth routes when set.
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — enable GitHub OAuth routes when set.

## Important architectural notes for an AI agent
- Server is stateful: sessions are stored in MySQL using `express-mysql-session` and the pool from `db.js` (session cookie name `mrsid`). Be careful when changing session logic.
- `ALLOWED_TABLES` (array in `server.js`) whitelists tables the Admin UI and table endpoints can access — changes here control which DB tables are manageable from the UI.
- The SQL Runner (`POST /api/run_query`) executes raw SQL from the frontend—it's intentionally dangerous and meant for dev/admin use only. Avoid enabling this in production or lock it behind auth.
- The app uses `mysql2/promise` pool and often calls `db.query(...)` with parameterized queries; maintain parameterized patterns to avoid SQL injection.

## Notable routes and patterns (examples)
- Fetch movies (dashboard): `GET /api/movies?search=...` — server builds JOINs and optional LIKE search across title, director, actor, genre.
- Movie details: `GET /api/movie/:id` and `GET /api/movie_details/:id`.
- Ratings upsert: `POST /api/rate_movie` — requires session/auth; server uses `ON DUPLICATE KEY UPDATE` to upsert ratings.
- Admin table list and CRUD: `GET /api/tables`, `GET /api/table/:tableName`, `POST /api/table/:tableName`, `PUT /api/table/:tableName`, `DELETE /api/table/:tableName`. These endpoints rely on inspecting information_schema for column metadata (see `getTableInfo` in `server.js`).
- Watchlist endpoints: `GET /api/watchlist/:userId`, `POST /api/watchlist/add`, `POST /api/watchlist/remove`.
- Recommendations: `GET /api/recommendations/:userId` and AI variant `GET /api/ai-recommendations/:userId` — use SQL queries to compute preferences and fallback logic for cold-start.

## Codebase conventions & gotchas
- Parameterized queries: the server uses `db.query(sql, params)` and sometimes `mysql.format` for logging. Preserve this to keep queries safe.
- When adding new columns, server code often attempts an insert that may fail if the column doesn't exist (see `add_movie` flow handling `trailerUrl`). Prefer safe migrations (see `database_migration.sql`).
- Session cookies: `sameSite: 'lax'` and `secure: false` in dev. When deploying behind an HTTPS host set `secure: true`.
- The frontend uses an API base detection: `API_BASE_URL = (location.hostname === 'localhost') ? 'http://localhost:3000/api' : '/api'`. If you change server port or proxying, update both server CORS `FRONTEND_ORIGIN` and frontend detection.

## Editing & testing guidance for AI edits
- Small behavior changes: update `server.js` and run `npm start` locally. Test via the SPA in `public/index.html` (open index in a browser) or curl fetches to the API endpoints.
- Database schema changes: prefer creating a migration SQL file (like `database_migration.sql`) and applying it manually to the `online_movie` DB. The server contains logic that tolerates missing `trailerUrl` but avoid making schema-dependent changes without migration.
- OAuth changes: ensure callback URLs remain `/api/auth/google/callback` and `/api/auth/github/callback`. Frontend triggers OAuth opens via `/auth/google` and `/auth/github`.

## Security & deployment notes
- Never enable the SQL Runner in production without strong admin auth. If you must keep it, gate it behind a hard check in `requireAuth` or an ENV flag.
- Sessions are persisted in the DB (MySQL store). When deploying to Render/Vercel set `SESSION_SECRET` and enable `secure` cookies behind HTTPS.

## Files to inspect for context
- `server.js` — main logic, whitelists, routes, and transaction examples.
- `db.js` — connection pool and local DB defaults (`online_movie`).
- `public/index.html` — frontend view and API usage patterns (e.g., how the client expects JSON shapes and endpoints).
- `database_migration.sql` — example migration for adding `trailerUrl`.

If any section is unclear or you want coverage for other files/automation (CI, Docker, tests), tell me which areas to expand and I will iterate.
