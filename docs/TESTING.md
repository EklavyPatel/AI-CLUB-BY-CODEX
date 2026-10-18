# Testing

## Unit, API and component checks

```bash
# From the repository root, with the virtual environment active:
(cd backend && python -m pytest -q)
npm test
npm run build
(cd backend && alembic check)
```

The API tests use isolated in-memory SQLite by default. For PostgreSQL, create a **disposable test database** and export `TEST_DATABASE_URL=postgresql+psycopg://...`. The test fixtures create/drop application tables. Never reuse a live database URL. Run the same backend command after setting the test URL.

Tests cover seeded riddles and practice schemas; all seven diagnostic outcomes; hints, text normalization and scoring; teacher-only routes; ownership and attempt privacy; role escalation rejection; hashed passwords/tokens and session revocation/expiry; auth limits; invalid answer/grade payloads; atomic imports; template protection; export; snapshots and archive; timer expiry; assignments and hidden-solution practice restrictions; progress and database persistence.

## Browser tests

Use a new local disposable database and random generated test teacher credentials. From `backend`, with your virtual environment active:

```bash
export DATABASE_URL=sqlite:////tmp/beyond-browser-tests.db
alembic upgrade head
E2E_DISPOSABLE_DB=yes PYTHONPATH=. python ../scripts/prepare_e2e.py
python -m uvicorn app.main:app --port 8000
```

In another terminal, root:

```bash
npm run dev
```

In a third terminal, root:

```bash
npx playwright install chromium
npm run test:e2e
```

For an existing system Chromium: `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`. Set `E2E_BASE_URL` / `E2E_API_URL` when ports differ. The prepare script writes random teacher credentials to `/tmp/beyond-e2e.json` with mode 0600; override via `E2E_CREDENTIALS_FILE`. Do not publish this file or the test database. Do not run prepare against production. Use a fresh disposable database between full test cycles when you want a clean institution.

The two projects run desktop Chromium and mobile Chromium with an iPhone-sized viewport. The mobile project is **not Safari/WebKit**. Browser checks register a real student, submit an automatically graded answer and teacher-reviewed reflection, save progress, grade as teacher, author/import questions, reject a malformed import, assign/start/submit a timed quiz, export CSV, inspect history/progress and switch themes. They check horizontal overflow and capture uncaught browser errors. Native Safari/Firefox, screen-reader sessions, real-device touch behavior and large-scale concurrency remain manual/future checks.

Screenshots and traces generated on failure can contain test responses and tokens; keep them local. CI does not upload credential-bearing traces. Screenshots used for visual review are local artifacts, not deployed previews.

## Database migration validation

Test upgrade on a new database, run `alembic check`, restart the API and make a functional submission. A database connection or zero-test run alone does not validate readiness. The GitHub workflow runs SQLite/PostgreSQL backend checks, frontend tests/build and browser workflows when executed by GitHub; local success does not claim remote CI execution.
