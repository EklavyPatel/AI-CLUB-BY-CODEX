import csv
import hashlib
import io
import json
import logging
import os
import random
import time
from pathlib import Path
from datetime import timedelta
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Request,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import select, text, delete
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from .db import get_db, now
from .models import User, AuthSession, Question, Quiz, Attempt, LoginLimit
from .schemas import Register, Login, QuestionIn, QuizIn, Answers, Grade, ProbeAnswer
from .security import (
    passwords,
    dummy_hash,
    public_user,
    session_for,
    current_user,
    teacher,
    bearer,
    digest,
)
from .assessment import score, diagnostic, summarize

app = FastAPI(
    title="Beyond the Number API",
    version="1.0.0",
    description="Formative riddle learning and teacher-reviewed assessment.",
)
origins = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("beyond")


@app.middleware("http")
async def headers(request, call_next):
    started = time.monotonic()
    response = await call_next(request)
    logger.info(
        "%s %s %s %.1fms",
        request.method,
        request.url.path,
        response.status_code,
        (time.monotonic() - started) * 1000,
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    return response


def get_or_404(db, model, id):
    obj = db.get(model, id)
    if not obj:
        raise HTTPException(404, "Not found")
    return obj


def owned(db, model, id, user):
    obj = get_or_404(db, model, id)
    if obj.owner_id != user.id:
        raise HTTPException(403, "This resource belongs to another teacher")
    return obj


def clean_question(q):
    # Deliberate allowlist: solutions, rubrics, probes and misconception keys stay server-side.
    fields = [
        "id",
        "title",
        "stem",
        "topic",
        "difficulty",
        "kind",
        "marks",
        "options",
        "hint_cost",
    ]
    return {k: q[k] for k in fields} | {"has_hint": bool(q.get("hint"))}


def snapshot(q):
    return q.content | {"id": q.id}


def quiz_view(q):
    return {
        k: getattr(q, k)
        for k in [
            "id",
            "title",
            "question_ids",
            "student_ids",
            "time_limit",
            "published",
            "reveal_answers",
            "randomize",
        ]
    }


def available(quiz, user):
    return quiz.published and (not quiz.student_ids or user.id in quiz.student_ids)


def get_attempt(db, id, user):
    a = get_or_404(db, Attempt, id)
    if a.student_id != user.id:
        raise HTTPException(403, "This attempt belongs to another student")
    return a


def locked_attempt(db, id, user):
    # Serialize writes per attempt on PostgreSQL; SQLite local development is single-process.
    a = db.scalar(select(Attempt).where(Attempt.id == id).with_for_update())
    if not a:
        raise HTTPException(404, "Not found")
    if a.student_id != user.id:
        raise HTTPException(403, "This attempt belongs to another student")
    return a


def finish(a):
    a.results = {
        str(i["id"]): score(i, a.answers.get(str(i["id"]), {}), i["id"] in a.hints)
        for i in a.items
    }
    a.submitted_at = min(now(), a.deadline) if a.deadline else now()


def expire(db, a):
    if not a.submitted_at and a.deadline and now() >= a.deadline:
        finish(a)
        db.commit()


def attempt_view(a):
    pending_probes = any(
        i.get("probe")
        and a.results.get(str(i["id"]), {}).get("correct") is False
        and a.results[str(i["id"])]["status"] != "unanswered"
        and "probe_correct" not in a.results[str(i["id"])]
        for i in a.items
    )
    results = {}
    if a.submitted_at:
        for i in a.items:
            k = str(i["id"])
            r = dict(a.results[k])
            r["diagnostic"] = diagnostic(i, a.answers.get(k, {}), r)
            if (
                i.get("probe")
                and r["correct"] is False
                and r["status"] != "unanswered"
                and "probe_correct" not in r
            ):
                r["probe"] = {k: v for k, v in i["probe"].items() if k != "answer"}
            if (
                a.reveal_answers
                and not pending_probes
                and r["status"] != "pending_review"
            ):
                r["explanation"] = i.get("explanation", "")
                r["accepted_answers"] = i.get("accepted_answers", [])
                r["rubric"] = i.get("rubric", "")
            results[k] = r
    return {
        "id": a.id,
        "quiz_id": a.quiz_id,
        "items": [clean_question(i) for i in a.items],
        "answers": a.answers,
        "results": results,
        "hints": a.hints,
        "started_at": a.started_at.isoformat() + "Z",
        "submitted_at": a.submitted_at.isoformat() + "Z" if a.submitted_at else None,
        "deadline": a.deadline.isoformat() + "Z" if a.deadline else None,
        "reveal_answers": a.reveal_answers,
        "earned": sum(r.get("marks") or 0 for r in a.results.values()),
        "maximum": sum(i["marks"] for i in a.items),
    }


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}


def rate_limit(db, key):
    key = hashlib.sha256(key.encode()).hexdigest()
    row = db.get(LoginLimit, key)
    if not row:
        row = LoginLimit(key=key, count=0)
        db.add(row)
    if row.window_start and now() - row.window_start > timedelta(minutes=15):
        row.count = 0
        row.window_start = now()
    if row.count >= 15:
        raise HTTPException(
            429, "Too many authentication requests. Try again in 15 minutes."
        )
    row.count += 1
    db.commit()


@app.post("/api/auth/register", status_code=201)
def register(data: Register, request: Request, db: Session = Depends(get_db)):
    rate_limit(db, "register:" + request.client.host)
    user = User(
        name=data.name,
        email=data.email,
        password_hash=passwords.hash(data.password),
        role="student",
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists")
    return session_for(db, user)


@app.post("/api/auth/login")
def login(data: Login, request: Request, db: Session = Depends(get_db)):
    # Per-account and per-source limits avoid relying on client-supplied forwarded headers.
    rate_limit(db, "login-account:" + data.email.lower())
    rate_limit(db, "login-ip:" + request.client.host)
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    valid = passwords.verify(data.password, user.password_hash if user else dummy_hash)
    if not user or not valid:
        raise HTTPException(401, "Incorrect email or password")
    return session_for(db, user)


@app.get("/api/auth/me")
def me(user: User = Depends(current_user)):
    return public_user(user)


@app.post("/api/auth/logout", status_code=204)
def logout(
    user: User = Depends(current_user),
    auth=Depends(bearer),
    db: Session = Depends(get_db),
):
    db.execute(
        delete(AuthSession).where(AuthSession.token_hash == digest(auth.credentials))
    )
    db.commit()


@app.get("/api/questions")
def questions(user: User = Depends(current_user), db: Session = Depends(get_db)):
    qs = db.scalars(
        select(Question).where(Question.archived == False).order_by(Question.id)
    ).all()
    return [
        snapshot(q) | {"published": q.published}
        if user.role == "teacher"
        else clean_question(snapshot(q))
        for q in qs
        if (q.owner_id == user.id if user.role == "teacher" else q.published)
    ]


@app.post("/api/questions", status_code=201)
def create_question(
    data: QuestionIn, user: User = Depends(teacher), db: Session = Depends(get_db)
):
    q = Question(
        owner_id=user.id,
        content=data.model_dump(exclude={"published"}),
        published=data.published,
    )
    db.add(q)
    db.commit()
    return snapshot(q) | {"published": q.published}


@app.put("/api/questions/{id}")
def update_question(
    id: int,
    data: QuestionIn,
    user: User = Depends(teacher),
    db: Session = Depends(get_db),
):
    q = owned(db, Question, id, user)
    q.content = data.model_dump(exclude={"published"})
    q.published = data.published
    db.commit()
    return snapshot(q) | {"published": q.published}


@app.delete("/api/questions/{id}", status_code=204)
def delete_question(
    id: int, user: User = Depends(teacher), db: Session = Depends(get_db)
):
    q = owned(db, Question, id, user)
    q.archived = True
    q.published = False
    db.commit()


@app.post("/api/questions/import", status_code=201)
async def import_questions(
    file: UploadFile = File(...),
    user: User = Depends(teacher),
    db: Session = Depends(get_db),
):
    raw = await file.read(1024 * 1024 + 1)
    if len(raw) > 1024 * 1024:
        raise HTTPException(413, "File must be under 1 MB")
    try:
        content = raw.decode("utf-8-sig")
        if file.filename.lower().endswith(".json"):
            rows = json.loads(content)
        elif file.filename.lower().endswith(".csv"):
            rows = list(csv.DictReader(io.StringIO(content)))
            for row in rows:
                for key in ["options", "accepted_answers", "misconceptions", "probe"]:
                    if key in row:
                        if row[key]:
                            row[key] = json.loads(row[key])
                        else:
                            del row[key]
                if "published" in row:
                    if row["published"].lower() not in ["true", "false"]:
                        raise ValueError("published must be true or false")
                    row["published"] = row["published"].lower() == "true"
        else:
            raise ValueError("Use a .json or .csv file")
        if not isinstance(rows, list) or not 1 <= len(rows) <= 100:
            raise ValueError("Upload an array of 1–100 questions")
        validated = []
        for n, row in enumerate(rows, 1):
            try:
                validated.append(QuestionIn.model_validate(row))
            except Exception as e:
                raise ValueError(f"Row {n}: {e}") from e
    except (ValueError, UnicodeError, TypeError, AttributeError) as e:
        raise HTTPException(422, str(e))
    for data in validated:
        db.add(
            Question(
                owner_id=user.id,
                content=data.model_dump(exclude={"published"}),
                published=data.published,
            )
        )
    db.commit()
    return {"imported": len(validated)}


@app.get("/api/quizzes")
def quizzes(user: User = Depends(current_user), db: Session = Depends(get_db)):
    qs = db.scalars(select(Quiz).order_by(Quiz.id)).all()
    if user.role == "teacher":
        return [quiz_view(q) for q in qs if q.owner_id == user.id]
    return [
        {k: v for k, v in quiz_view(q).items() if k != "student_ids"}
        for q in qs
        if available(q, user)
    ]


def check_quiz(db, data, user):
    for id in data.question_ids:
        q = owned(db, Question, id, user)
        if q.archived or (data.published and not q.published):
            raise HTTPException(
                422, "Published quizzes must use published, active questions"
            )
    for id in data.student_ids:
        u = db.get(User, id)
        if not u or u.role != "student":
            raise HTTPException(422, f"Unknown student ID: {id}")


@app.post("/api/quizzes", status_code=201)
def create_quiz(
    data: QuizIn, user: User = Depends(teacher), db: Session = Depends(get_db)
):
    check_quiz(db, data, user)
    q = Quiz(owner_id=user.id, **data.model_dump())
    db.add(q)
    db.commit()
    return quiz_view(q)


@app.put("/api/quizzes/{id}")
def update_quiz(
    id: int, data: QuizIn, user: User = Depends(teacher), db: Session = Depends(get_db)
):
    q = owned(db, Quiz, id, user)
    check_quiz(db, data, user)
    for k, v in data.model_dump().items():
        setattr(q, k, v)
    db.commit()
    return quiz_view(q)


@app.delete("/api/quizzes/{id}", status_code=204)
def unpublish_quiz(
    id: int, user: User = Depends(teacher), db: Session = Depends(get_db)
):
    q = owned(db, Quiz, id, user)
    q.published = False
    db.commit()


@app.post("/api/practice/{id}", status_code=201)
def practice(
    id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    if user.role != "student":
        raise HTTPException(403, "Use a student account to practice")
    q = get_or_404(db, Question, id)
    if not q.published or q.archived:
        raise HTTPException(404, "Question unavailable")
    # Prevent practice from bypassing an assigned quiz’s solution-release policy.
    hidden = db.scalars(
        select(Quiz).where(Quiz.published == True, Quiz.reveal_answers == False)
    ).all()
    if any(id in z.question_ids and available(z, user) for z in hidden):
        raise HTTPException(
            403, "This question is reserved for a quiz with hidden solutions"
        )
    a = Attempt(
        student_id=user.id, items=[snapshot(q)], answers={}, results={}, hints=[]
    )
    db.add(a)
    db.commit()
    return attempt_view(a)


@app.post("/api/quizzes/{id}/start", status_code=201)
def start_quiz(
    id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    q = get_or_404(db, Quiz, id)
    if user.role != "student" or not available(q, user):
        raise HTTPException(403, "Quiz unavailable")
    existing = db.scalar(
        select(Attempt).where(
            Attempt.quiz_id == id,
            Attempt.student_id == user.id,
            Attempt.submitted_at == None,
        )
    )
    if existing:
        expire(db, existing)
        return attempt_view(existing)
    items = []
    for question_id in q.question_ids:
        item = db.get(Question, question_id)
        if not item or item.archived or not item.published:
            raise HTTPException(
                409, "A quiz question is unavailable. Contact your teacher."
            )
        items.append(snapshot(item))
    if q.randomize:
        random.SystemRandom().shuffle(items)
    a = Attempt(
        student_id=user.id,
        quiz_id=id,
        items=items,
        answers={},
        results={},
        hints=[],
        deadline=now() + timedelta(seconds=q.time_limit),
        reveal_answers=q.reveal_answers,
    )
    db.add(a)
    db.commit()
    return attempt_view(a)


@app.get("/api/attempts")
def attempts(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Attempt).where(Attempt.student_id == user.id).order_by(Attempt.id.desc())
    ).all()
    for a in rows:
        expire(db, a)
    return [attempt_view(a) for a in rows]


@app.get("/api/attempts/{id}")
def attempt(id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = get_attempt(db, id, user)
    expire(db, a)
    return attempt_view(a)


def validate_answers(a, data):
    ids = {str(i["id"]): i for i in a.items}
    for key, value in data.answers.items():
        if key not in ids:
            raise HTTPException(422, "Answer contains an unknown question ID")
        if (
            ids[key]["kind"] == "choice"
            and value.answer
            and value.answer not in ids[key]["options"]
        ):
            raise HTTPException(422, "Choose one of the provided options")


@app.put("/api/attempts/{id}/draft")
def save_draft(
    id: int,
    data: Answers,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    a = locked_attempt(db, id, user)
    expire(db, a)
    if a.submitted_at:
        raise HTTPException(409, "Attempt already submitted or time expired")
    validate_answers(a, data)
    a.answers = {k: v.model_dump() for k, v in data.answers.items()}
    db.commit()
    return attempt_view(a)


@app.post("/api/attempts/{id}/submit")
def submit(
    id: int,
    data: Answers,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    a = locked_attempt(db, id, user)
    expire(db, a)
    if a.submitted_at:
        return attempt_view(a)
    validate_answers(a, data)
    a.answers = {k: v.model_dump() for k, v in data.answers.items()}
    finish(a)
    db.commit()
    return attempt_view(a)


@app.post("/api/attempts/{id}/hints/{question_id}")
def hint(
    id: int,
    question_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    a = locked_attempt(db, id, user)
    expire(db, a)
    if a.submitted_at:
        raise HTTPException(409, "Attempt is closed")
    item = next((i for i in a.items if i["id"] == question_id), None)
    if not item or not item.get("hint"):
        raise HTTPException(404, "Hint unavailable")
    if question_id not in a.hints:
        a.hints = a.hints + [question_id]
        db.commit()
    return {"hint": item["hint"], "deduction": item["hint_cost"]}


@app.post("/api/attempts/{id}/probes/{question_id}")
def probe(
    id: int,
    question_id: int,
    data: ProbeAnswer,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    a = locked_attempt(db, id, user)
    if not a.submitted_at:
        raise HTTPException(409, "Submit the primary attempt first")
    item = next((i for i in a.items if i["id"] == question_id), None)
    r = a.results.get(str(question_id))
    if (
        not item
        or not item.get("probe")
        or not r
        or r["correct"] is not False
        or r["status"] == "unanswered"
    ):
        raise HTTPException(422, "No probe is available")
    if "probe_correct" in r:
        raise HTTPException(409, "Probe already answered")
    if data.answer not in item["probe"]["options"]:
        raise HTTPException(422, "Choose a probe option")
    a.results = a.results | {
        str(question_id): r
        | {
            "probe_correct": data.answer == item["probe"]["answer"],
            "probe_answer": data.answer,
        }
    }
    db.commit()
    return attempt_view(a)


@app.get("/api/progress")
def progress(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Attempt).where(Attempt.student_id == user.id).order_by(Attempt.id)
    ).all()
    for a in rows:
        expire(db, a)
    report = summarize(rows)
    report["completed_question_ids"] = sorted(
        {
            i["id"]
            for a in rows
            if a.submitted_at
            for i in a.items
            if a.answers.get(str(i["id"]), {}).get("answer")
        }
    )
    return report


@app.get("/api/teacher/students")
def students(user: User = Depends(teacher), db: Session = Depends(get_db)):
    return [
        public_user(u)
        for u in db.scalars(
            select(User).where(User.role == "student").order_by(User.name)
        ).all()
    ]


def teacher_rows(db, user):
    questions = set(
        db.scalars(select(Question.id).where(Question.owner_id == user.id)).all()
    )
    rows = db.scalars(select(Attempt).order_by(Attempt.id)).all()
    # In this single-institution app, teachers only see submissions to their own questions.
    visible = []
    for a in rows:
        if all(i["id"] in questions for i in a.items):
            expire(db, a)
            if a.submitted_at:
                visible.append(a)
    return visible


@app.get("/api/teacher/submissions")
def submissions(user: User = Depends(teacher), db: Session = Depends(get_db)):
    return [
        attempt_view(a)
        | {
            "student": public_user(db.get(User, a.student_id)),
            "rubrics": {str(i["id"]): i.get("rubric", "") for i in a.items},
        }
        for a in reversed(teacher_rows(db, user))
    ]


@app.post("/api/teacher/attempts/{id}/grade/{question_id}")
def grade(
    id: int,
    question_id: int,
    data: Grade,
    user: User = Depends(teacher),
    db: Session = Depends(get_db),
):
    a = db.scalar(select(Attempt).where(Attempt.id == id).with_for_update())
    if not a:
        raise HTTPException(404, "Attempt not found")
    i = next((i for i in a.items if i["id"] == question_id), None)
    if not i:
        raise HTTPException(404, "Question not found")
    owned(db, Question, question_id, user)
    if (
        not a.submitted_at
        or i["kind"] != "reflection"
        or a.results[str(question_id)]["status"] == "unanswered"
    ):
        raise HTTPException(
            422, "Only submitted reflections with answers can be manually graded"
        )
    if data.marks > i["marks"]:
        raise HTTPException(422, "Grade exceeds question maximum")
    r = a.results[str(question_id)]
    a.results = a.results | {
        str(question_id): r
        | {
            "marks": max(0, data.marks - r["deduction"]),
            "correct": None,
            "status": "reviewed",
            "feedback": data.feedback,
        }
    }
    db.commit()
    return {"status": "graded"}


@app.get("/api/teacher/analytics")
def analytics(user: User = Depends(teacher), db: Session = Depends(get_db)):
    rows = teacher_rows(db, user)
    report = summarize(rows)
    report["students"] = [
        public_user(db.get(User, sid))
        | {"report": summarize([a for a in rows if a.student_id == sid])}
        for sid in sorted({a.student_id for a in rows})
    ]
    return report


@app.get("/api/teacher/export")
def export(user: User = Depends(teacher), db: Session = Depends(get_db)):
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(
        [
            "attempt_id",
            "student_email",
            "question",
            "status",
            "marks",
            "maximum",
            "confidence",
            "diagnostic",
        ]
    )

    def safe(value):
        s = str(value)
        return "'" + s if s.lstrip().startswith(("=", "+", "-", "@", "\t", "\r")) else s

    for a in teacher_rows(db, user):
        for i in a.items:
            r = a.results[str(i["id"])]
            answer = a.answers.get(str(i["id"]), {})
            writer.writerow(
                [
                    a.id,
                    safe(db.get(User, a.student_id).email),
                    safe(i["title"]),
                    r["status"],
                    r["marks"],
                    i["marks"],
                    answer.get("confidence", ""),
                    diagnostic(i, answer, r),
                ]
            )
    return StreamingResponse(
        iter([out.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="results.csv"'},
    )


@app.get("/api/teacher/template/{format}")
def import_template(format: str, user: User = Depends(teacher)):
    rows = json.loads((Path(__file__).parent / "seed_questions.json").read_text())[-3:]
    if format == "json":
        data = json.dumps(rows, indent=2, ensure_ascii=False)
        media = "application/json"
    elif format == "csv":
        out = io.StringIO()
        writer = csv.DictWriter(
            out, fieldnames=list(dict.fromkeys(k for row in rows for k in row))
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    k: json.dumps(v, ensure_ascii=False)
                    if isinstance(v, (list, dict))
                    else str(v).lower()
                    if isinstance(v, bool)
                    else v
                    for k, v in row.items()
                }
            )
        data = out.getvalue()
        media = "text/csv"
    else:
        raise HTTPException(422, "Choose json or csv")
    return StreamingResponse(
        iter([data]),
        media_type=media,
        headers={
            "Content-Disposition": f'attachment; filename="question-bank.example.{format}"'
        },
    )
