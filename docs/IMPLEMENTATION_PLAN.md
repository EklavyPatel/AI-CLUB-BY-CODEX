# Implementation plan and delivered scope

1. Read both PDFs and four prompt photographs; preserve originals and identify ambiguity. Completed: title-based mapping, one supplied solution and three independent reasoned solutions.
2. Model four subjective riddles with rubrics and separately labeled objective practice. Completed.
3. Build React/Vite/Tailwind frontend, FastAPI APIs and SQLAlchemy/Alembic persistence. Use SQLite for a beginner-friendly local path and PostgreSQL for hosted deployment. Completed.
4. Add Argon2 auth, fixed student registration, administrative teachers, opaque sessions and role/ownership checks. Completed.
5. Build assessments: immutable snapshots, server deadlines/scoring, hints, confidence, draft saving, post-submission probes and teacher review. Completed.
6. Build teacher bank management, validated JSON/CSV import, quiz assignment, reports and exports. Completed.
7. Test pure rules, APIs, database variants, components and full browser flows. Recorded outcomes are in FINAL_REPORT.md.
8. Package production build, migrations, deployment configurations and Ubuntu instructions; commit and push without overwriting remote work. Deployment requires external credentials/authorization; no external service is provisioned by this repository.

Optional work intentionally outside the core: LLM authoring, trained classifiers, automatic delayed-retention scheduling, institutional SSO, email/password-reset delivery, cross-institution tenancy and high-stakes proctoring. Those require additional operational choices or evidence.
