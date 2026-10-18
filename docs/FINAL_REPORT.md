# Final implementation report

Validation date: 18 October 2026. This report distinguishes locally verified behavior from hosted deployment and empirical research claims.

## Objectives and original research

Deliver an approachable, full-stack riddle learning and assessment platform that keeps marks while exposing useful formative evidence. The provided report argues that a mark cannot identify the process behind an answer. The app implements confidence capture, misconception codes, reworded probes and contextual reports without claiming that those signals prove a learner’s cognitive state.

Both original PDFs are preserved in `docs/sources`. Four source photographs were transcribed by title. The provided solution PDF covers **The Same Number**; a separate explicit Riddle 2 solution was not present. The three remaining solutions were developed independently and assessed as reasoned arguments, not exact-answer puzzles. Bibliographic references and the paper’s simulation were not independently reproduced.

## Riddles and solutions

| Original title | Defensible solution | Assessment |
| --- | --- | --- |
| The Same Number | A score is many-to-one; collect confidence, reasoning and probe evidence to distinguish needs, without permanent labels | Teacher rubric / 10 |
| One Error, Several Stories | Maintain competing rule/condition/time hypotheses; gather observations with different predicted outcomes | Teacher rubric / 10 |
| The Question That Separates | Choose a minimally burdensome, learner-consented probe that separates live hypotheses; teacher and learner retain agency | Teacher rubric / 10 |
| Better Marks, Better Understanding? | Check novel transfer, unaided performance and delayed retention; adapt instruction when improvement is task-bound | Teacher rubric / 10 |

Full explanations, logical checks, ambiguity and per-point rubrics are in `RIDDLE_SOLUTIONS.md` and seed data. Three clearly labeled authored practice items demonstrate objective choice/text scoring and probes. No missing original riddle content has been invented.

## Implemented features

**Students:** registration/login/logout, searchable/filterable activities, choice/text/reflection responses, confidence tags, save/auto-save, hints and deductions, timed assigned quizzes, question navigation, confirmation, answer release policy, optional probes, prior-attempt review, provisional/final marks, accuracy and topic/difficulty evidence, elapsed time, next-step suggestions and report download.

**Teachers:** administrative teacher bootstrap; question create/edit/publish/archive; atomic CSV/JSON imports and protected templates; question topic/difficulty/marks/answer variants/misconceptions/probe/hint configuration; quiz create/edit/unpublish, assignment, timing, ordering and release controls; reflection partial grading with feedback; owned-question class/individual reports and CSV export.

**Platform:** responsive light/dark UI, keyboard-accessible form controls, semantic labels, loading/error/empty states, REST/OpenAPI, Argon2 passwords, revocable hashed-token sessions, explicit roles/ownership, database migrations, environment examples, GitHub CI workflow and deployment files.

## Technology and data design

React 19, Vite 7 and Tailwind 4 implement the requested frontend approach. FastAPI, SQLAlchemy 2, Alembic and psycopg provide validated APIs and PostgreSQL persistence. SQLite offers a no-service local path for beginners. Python 3.12.14, Node 24.19.0 and npm 11.9.0 were available in the cloud development instance. npm uses a committed lockfile and backend direct dependencies are pinned.

Tables store users, hashed sessions, teacher-owned question content, quiz assignments/policies, immutable attempt snapshots and authentication rate limits. See `ARCHITECTURE.md` and `API_DOCUMENTATION.md` for state transitions, endpoint schemas and security boundaries.

## Scoring and analysis

Objective answers are graded only on the backend using configured alternatives; text normalization handles Unicode width, case and whitespace. Confidence does not alter marks. Hints deduct once and cannot produce negative marks. Reflections remain pending until a teacher supplies a bounded partial grade and feedback.

Attempt totals and percentages include submitted work; pending reflections are provisional zero and clearly labeled. Objective accuracy excludes reflections and unanswered items. Repeated attempts are separate records, with history and topic/difficulty breakdowns. Server timestamps measure elapsed attempt duration, not active attention. Diagnostic states describe tentative response evidence, not personal traits or validated mastery. No AI classifier or calibration-based grade manipulation exists.

## Verification results

| Check | Actual outcome |
| --- | --- |
| Backend suite, isolated SQLite | **35 passed** |
| Same backend suite, PostgreSQL 17 | **35 passed** |
| React component tests | **4 passed** |
| Real end-to-end desktop Chromium workflow | **Passed** |
| Real end-to-end mobile Chromium workflow, iPhone-sized viewport | **Passed** |
| Frontend production build | **Passed**, approximately 280 KB JS / 86 KB gzip |
| npm audit, full installed dependency tree | **0 known vulnerabilities reported** at validation time |
| Fresh PostgreSQL Alembic upgrade, repeated upgrade and schema-drift check | **Passed** |
| SQLite schema-drift check | **Passed** |
| PostgreSQL administrative bootstrap/seed repeatability | **7 added**, then **0 added**, existing questions preserved |
| Live PostgreSQL-backed API health/auth/content/scoring | **Passed** |
| PostgreSQL attempt/session persistence after API restart | **Passed** |
| Clean npm lockfile installation | **Passed** |

The backend tests exercise all four source riddle review flows and all objective seed answer variants. They also cover role escalation, teacher permissions/ownership, student privacy, session hashing/revocation/expiry, rate limiting, hint deductions, idempotence, invalid submissions/grades, imports, exports, timers, assignments, solution-release restrictions, snapshots and progress calculations. Browser tests exercise real UI-to-API-to-database workflows rather than mock dashboards. Horizontal overflow checks and screenshot review were performed on desktop and mobile sizes, with no uncaught browser errors in the passing runs.

A Starlette test-client warning advises future migration from `httpx` to `httpx2`. Tests pass; this is a dependency deprecation notice, not a skipped or failing test. npm also reports a transitive development-only encoding-package deprecation. No tests were disabled to obtain these results. Earlier failing browser runs exposed ambiguous test selectors; the selectors were corrected and both full workflows were rerun successfully.

Screenshots in `docs/screenshots` use synthetic accounts. They are local visual-validation artifacts. Browser traces, random test credentials, databases and secrets are excluded from Git. CI configuration is committed; remote GitHub Actions results are not claimed by local validation.

## GitHub and deployment status

Repository: https://github.com/EklavyPatel/AI-CLUB-BY-CODEX . The existing repository was verified empty before development and reused; no existing project files or remote branches were overwritten. Delivery uses `main` and a normal non-force push. Remote-push confirmation is reported in the delivery response.

**Not deployed.** No live website URL exists from this work. `render.yaml`, `vercel.json`, a backend Dockerfile, `.env.example` files and deployment instructions are provided. Hosted frontend/backend integration, Render/Vercel provisioning, managed database backups and production TLS/ingress behavior remain unverified until provider authorization and configuration. The optional Dockerfile has not been built in this validation run; native Python/npm startup was used.

## Limitations and future work

- Open-ended riddles need teachers; no semantic auto-grader certifies philosophical answers.
- Rule-based diagnostic evidence is not a validated psychological/learning classifier. No real-student pilot, simulation reproduction or causal learning-gain result is claimed.
- No email verification, password reset delivery, account-deletion UI, institution SSO or cross-institution tenancy. A single institution shares the student roster; submissions are question-owner scoped.
- No high-stakes exam security/proctoring, retake limits or automated best/latest gradebook policy. Already released answers cannot be made unknown by editing release settings.
- Elapsed time is per attempt. No per-item baseline, attention inference or automatic delayed-retention scheduling.
- No trained ML classifier, LLM authoring, generative tutor, notifications, offline mode or external integrations.
- Large datasets need pagination and load testing. PostgreSQL row locks serialize attempt mutation, but high-volume auth counters/ingress and concurrent start behavior need further stress testing.
- Real Safari, Firefox, physical-device touch and screen-reader testing remain unrun; mobile browser validation used Chromium emulation. The custom confirmation dialog has semantic labeling but no dedicated accessibility audit.
- Institutional consent, retention, recovery, backup and incident procedures must be established before a real learner cohort.

Priorities after an authorized deployment: verify hosted flows; add account recovery and operational backups; pilot item/probe quality with teachers; conduct accessible-browser testing; then evaluate transfer/retention with the research protocol. Add ML only with a justified dataset, evaluation and human oversight.
