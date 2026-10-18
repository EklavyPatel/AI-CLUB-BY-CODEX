# API guide

Run the backend and open `/docs` for interactive Swagger UI or `/openapi.json` for the full schema. All paths below start with `/api`. JSON is the default request/response format. Requests with unknown fields are rejected.

## Authentication

`POST /auth/register` accepts `{ "name": "Asha", "email": "asha@example.edu", "password": "YOUR_NEW_PASSWORD" }`. Passwords need at least ten characters. Registration always creates a student; a `role` field is rejected. `POST /auth/login` accepts email/password. Both return `{ "token": "...", "user": { "id": 1, "name": "Asha", "email": "...", "role": "student" } }`.

Send the returned token as `Authorization: Bearer TOKEN` on later requests. `GET /auth/me` returns the current account. `POST /auth/logout` revokes the token and returns 204. Sessions expire after twelve hours. Never store tokens in Git, URLs or logs. The UI keeps them in sessionStorage.

## Endpoints

| Method/path | Access | Function |
| --- | --- | --- |
| GET /health | Public | Database connectivity check |
| GET /questions | Signed in | Students: public fields of published active questions; teachers: owned content |
| POST /questions | Teacher | Create a validated question |
| PUT /questions/{id} | Owning teacher | Replace editable question fields |
| DELETE /questions/{id} | Owning teacher | Archive, preserving history |
| POST /questions/import | Teacher | Multipart `file`, UTF-8 JSON/CSV, atomic validation |
| GET /teacher/template/{json\|csv} | Teacher | Download a validated question-bank example |
| GET /quizzes | Signed in | Owned quizzes or published quizzes assigned to current student |
| POST /quizzes | Teacher | Create quiz |
| PUT /quizzes/{id} | Owning teacher | Update content/assignments/release policy for future starts |
| DELETE /quizzes/{id} | Owning teacher | Unpublish; history is preserved |
| POST /quizzes/{id}/start | Assigned student | Start timed attempt or resume an open attempt |
| POST /practice/{question_id} | Student | Start untimed practice; hidden assigned quiz questions are restricted |
| GET /attempts | Student | Own attempts, newest first; reconcile expired timers |
| GET /attempts/{id} | Owning student | Own saved responses, permitted feedback and pending probes |
| PUT /attempts/{id}/draft | Owning student | Save current responses before submission/deadline |
| POST /attempts/{id}/submit | Owning student | Submit once; repeated requests return recorded results |
| POST /attempts/{id}/hints/{question_id} | Owning student | Reveal configured hint and register deduction once |
| POST /attempts/{id}/probes/{question_id} | Owning student | Optional one-shot probe after incorrect objective response |
| GET /progress | Student | Own performance and completed question IDs |
| GET /teacher/students | Teacher | Institution student roster for quiz assignment |
| GET /teacher/submissions | Teacher | Submitted work on owned questions, with rubrics |
| POST /teacher/attempts/{id}/grade/{question_id} | Owning teacher | Bounded partial grade and feedback on a reflection |
| GET /teacher/analytics | Teacher | Owned-question class and individual aggregates |
| GET /teacher/export | Teacher | CSV of submitted results, with spreadsheet formula escaping |

### Question example

```json
{
  "title": "A transfer check",
  "stem": "What term describes applying learning to another context?",
  "topic": "Transfer",
  "difficulty": "easy",
  "kind": "text",
  "marks": 5,
  "accepted_answers": ["transfer", "transfer of learning"],
  "explanation": "Transfer applies an idea beyond its original situation.",
  "hint": "It begins with trans.",
  "hint_cost": 1,
  "published": true
}
```

`kind` is `choice`, `text` or `reflection`. Choices require at least two distinct `options` and accepted answers drawn from those options. Reflections require a nonempty `rubric` and are manually graded. All answers are single responses; multiple accepted answers mean alternatives, not a multiple-select UI. Marks are 1–100 and hint deduction cannot exceed marks. Limits and full optional fields are in OpenAPI.

For choices, `misconceptions` maps **incorrect option text** to a diagnostic code. An optional `probe` contains `stem`, two or more unique `options`, and one `answer` exactly matching an option. Students never receive the probe answer or misconception mapping. Teachers should pilot matched probes before interpreting their results.

### Quiz example

```json
{
  "title": "Evidence and understanding",
  "question_ids": [1, 2],
  "student_ids": [3],
  "time_limit": 1800,
  "published": true,
  "reveal_answers": false,
  "randomize": true
}
```

Time is in seconds (60–14,400). Empty `student_ids` means all registered students. Published quizzes must reference published active questions owned by their teacher. Question IDs must be unique. Retakes are allowed and counted separately.

### Save or submit an attempt

```json
{
  "answers": {
    "1": {"answer": "A reasoned reflection...", "confidence": "sure"},
    "2": {"answer": "transfer", "confidence": "unsure"}
  }
}
```

This is a complete draft snapshot; omitted answers are unanswered. Confidence values are `sure`, `unsure`, `guessing`. On expiry, the server uses the last saved draft and ignores late answers. Clients cannot set start times, deductions, correctness or grades. Reflection results have `marks: null, status: "pending_review"` until graded. Probe submission is `{ "answer": "an exact probe option" }` and never alters marks.

### Manual grade

```json
{"marks": 8.5, "feedback": "Strong alternatives. Add a prediction for the untimed probe."}
```

Marks are **before** the recorded hint deduction. They must be between zero and the snapshot maximum. Reflection grades are partial marks, not binary correct/incorrect, and are excluded from objective accuracy.

## Imports

Use a JSON array with 1–100 question objects, or a CSV with named fields from the same schema. The file must be UTF-8 and under 1 MB. JSON is easiest for complex probes.

For CSV, `options`, `accepted_answers`, `misconceptions` and `probe` cells contain valid JSON. `published` must be `true` or `false`. Standard CSV quoting is required around JSON strings containing quotes/commas. Download a template from the teacher dashboard or see `question-bank.example.csv/json` in this directory. Invalid files produce a row-specific 422 error and no partial import. Reimporting intentionally creates new questions; only the administrative seed operation deduplicates by title.

## Errors

- 401: missing/expired/invalid session or wrong credentials.
- 403: role, ownership, assignment or hidden-solution restriction.
- 404: missing/unavailable resource.
- 409: already closed operation, unavailable quiz item or duplicate email.
- 413: oversized import.
- 422: malformed fields, invalid choices/grades or unsupported file format.
- 429: authentication rate limit; retry after the 15-minute window.

A provider-level outage or unavailable database can return 500; inspect server logs and health checks rather than treating it as a valid assessment result.
