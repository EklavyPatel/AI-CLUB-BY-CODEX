# Deployment guide: Vercel + Render + PostgreSQL

No external deployment has been performed. The configuration files are prepared and local build/API/database checks are recorded separately. Creating hosting resources may incur charges and requires your explicit provider authorization. Review current provider documentation and pricing during provisioning.

## 1. Before deploying

Push the repository to GitHub. Run backend tests, `npm test`, and `npm run build`. Choose a data region appropriate for your learners. Decide who administers teacher accounts, how data will be backed up, and how learners recover accounts. The current app has no password-reset email service.

Use PostgreSQL for production. SQLite on an ephemeral hosting disk will lose data and is not a multiworker production database. Never run automated tests against the production database: their fixtures drop tables.

## 2. Backend and database on Render

1. Connect Render to the repository with your own account authorization.
2. Review `render.yaml`. It defines a PostgreSQL database and a Python web service rooted in `backend`. Select a suitable plan/region before provisioning; no free-tier or price guarantee is made.
3. Set `ALLOWED_ORIGINS` to the exact frontend HTTPS origin, for example `https://your-project.vercel.app`. Comma-separate additional trusted origins; do not use `*` for a deployed authenticated application.
4. Render supplies `DATABASE_URL` through the database binding. Standard `postgres://` and `postgresql://` URLs are converted to SQLAlchemy’s psycopg driver internally. Use the provider’s supported TLS settings; for external connections require its documented TLS mode (commonly `sslmode=require`) and certificate configuration. Do not disable TLS verification to bypass errors.
5. Build: `pip install -r requirements.txt`.
6. Pre-deploy: `alembic upgrade head`. If your service plan does not support pre-deploy commands, run this once from the provider shell before releasing traffic. Do not run migrations from multiple replicas simultaneously.
7. Start: `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1`.
8. Verify `/api/health` returns `{"status":"ok"}`. The health endpoint checks database connectivity, but a full readiness check also needs migrations and functional requests.

`PYTHON_VERSION` in the example is a 3.12 patch release; use a current supported 3.12 security patch when provisioning. The cloud development validation used Python 3.12.14.

## 3. Create a teacher and seed the original materials

In the backend’s provider shell, with its database environment active:

```bash
python -m app.cli teacher
python -m app.cli seed
```

These prompt for email/password and email respectively. No fixed credentials are shipped. For noninteractive administration, provide `BOOTSTRAP_TEACHER_EMAIL` / `BOOTSTRAP_TEACHER_PASSWORD` securely in the provider environment only while running `teacher`. Do not put their values in a shell script, Git commit or chat. Remove bootstrap variables after use. Seed preserves existing questions and does not create fake student history.

## 4. Frontend on Vercel

1. Import the GitHub repository. Keep the project root at the repository root, not `frontend`, because npm workspaces and `package-lock.json` are at root.
2. Build command: `npm run build`; output directory: `frontend/dist`; Node: 24 (or a compatible maintained version).
3. Set `VITE_API_URL` to the backend HTTPS origin without a trailing slash, e.g. `https://your-api.onrender.com`. This is a public URL, not a secret. Vite embeds `VITE_*` variables in frontend code; never put credentials there.
4. Review `vercel.json` headers. Its CSP allows HTTPS connections to `*.onrender.com`. If you use a different backend/custom domain, add that exact origin to `connect-src`, then rebuild/redeploy. CORS must also trust the deployed frontend origin on the backend.
5. Deploy and verify registration, login, a practice submission, teacher review and a quiz through the deployed frontend. Rebuild after changing `VITE_API_URL`.

There are no deep client-side routes to rewrite: navigation is internal React state. API calls go to the configured FastAPI origin. GitHub Pages alone cannot host the backend/database.

## 5. Docker alternative

Build the backend from its directory:

```bash
docker build -t beyond-api backend
```

Provide a securely configured PostgreSQL `DATABASE_URL` and explicit `ALLOWED_ORIGINS` through your container platform’s secret/environment settings. Expose port 8000, or set `PORT`. The container runs migrations then starts one worker as a non-root user. For multiple replicas, move migration execution to a single release job. Frontend static files still need a static host/reverse proxy and a build-time `VITE_API_URL`.

The Dockerfile is provided as an alternative; the verified native Python/npm path does not establish that every hosting provider or Docker image build has been tested.

## 6. Migration, rollback and operations

- Before upgrades, take a database backup and check restoration in a separate database. `alembic current` inspects the schema revision; `alembic upgrade head` applies migrations; `alembic check` detects model/schema drift.
- The initial migration includes a destructive downgrade. Do not use `alembic downgrade base` on real data as an application rollback strategy. Prefer restoring a tested backup or a forward corrective migration.
- Back up the PostgreSQL database, not the frontend deployment. Enable provider storage backups and choose a retention policy before a pilot.
- Use HTTPS for both origins. Limit request size/rate at ingress, trust forwarded headers only from the provider’s proxy, and monitor `/api/health` and errors. The app logs method/path/status/duration, never passwords or request bodies.
- Expired auth sessions and old rate-limit rows are not automatically pruned. An administrator can remove expired session rows and obsolete rate-limit rows during maintenance; define data retention separately for assessment evidence.
- All teachers share one institution roster, but submissions/questions are owner-scoped. Separate institutions should use separate deployments/databases until tenancy is implemented.

## Final hosted verification

Record the actual frontend/backend URLs, deployed Git commit, database revision and date. Test student/teacher permissions, hidden answers, grading and persistence after a service restart. Test small-screen layouts in real browsers. Do not publish sensitive sample records or substitute local health checks for this deployment verification.
