import json
from pathlib import Path
from datetime import timedelta
from sqlalchemy import select
from app.db import now
from app.models import Attempt, User, AuthSession


def create(c, t, q):
    r = c.post("/api/questions", headers=t, json=q)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def start(c, s, q):
    r = c.post(f"/api/practice/{q}", headers=s)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def submit(c, s, a, q, answer="yes", confidence="sure"):
    return c.post(
        f"/api/attempts/{a}/submit",
        headers=s,
        json={"answers": {str(q): {"answer": answer, "confidence": confidence}}},
    )


def test_auth_and_roles(setup):
    c, t, s, _ = setup
    assert c.get("/api/questions").status_code == 401
    assert c.get("/api/teacher/analytics", headers=s).status_code == 403
    assert (
        c.post(
            "/api/auth/register",
            json={
                "name": "Bad",
                "email": "bad@test.edu",
                "password": "1234567890",
                "role": "teacher",
            },
        ).status_code
        == 422
    )
    assert (
        c.post(
            "/api/auth/register",
            json={"name": "Bad", "email": "bad", "password": "short"},
        ).status_code
        == 422
    )
    assert (
        c.post(
            "/api/auth/login", json={"email": "student@test.edu", "password": "wrong"}
        ).status_code
        == 401
    )
    assert c.post("/api/auth/logout", headers=s).status_code == 204
    assert c.get("/api/auth/me", headers=s).status_code == 401


def test_password_storage_and_session_expiry(setup):
    c, t, s, factory = setup
    with factory() as db:
        u = db.scalar(select(User).where(User.role == "student"))
        assert u.password_hash.startswith("$argon2")
        row = db.scalar(select(AuthSession).where(AuthSession.user_id == u.id))
        assert s["Authorization"].split()[1] not in row.token_hash
        row.expires_at = now() - timedelta(seconds=1)
        db.commit()
    assert c.get("/api/auth/me", headers=s).status_code == 401


def test_rate_limit(setup):
    c, t, s, _ = setup
    for _ in range(13):
        assert (
            c.post(
                "/api/auth/login", json={"email": "blocked@test.edu", "password": "bad"}
            ).status_code
            == 401
        )
    # Includes the fixture teacher login on the same client IP.
    c.post("/api/auth/login", json={"email": "blocked@test.edu", "password": "bad"})
    assert (
        c.post(
            "/api/auth/login", json={"email": "blocked@test.edu", "password": "bad"}
        ).status_code
        == 429
    )


def test_question_security_and_ownership(setup, choice):
    c, t, s, _ = setup
    q = create(c, t, choice)
    public = c.get("/api/questions", headers=s).json()[0]
    assert (
        not {
            "accepted_answers",
            "explanation",
            "rubric",
            "probe",
            "misconceptions",
            "hint",
        }
        & public.keys()
    )
    assert c.post("/api/questions", headers=s, json=choice).status_code == 403
    token = c.post(
        "/api/auth/login",
        json={"email": "other@test.edu", "password": "SafePassword123"},
    ).json()["token"]
    assert (
        c.put(
            f"/api/questions/{q}",
            headers={"Authorization": "Bearer " + token},
            json=choice,
        ).status_code
        == 403
    )
    a = start(c, s, q)
    r = c.get(f"/api/attempts/{a}", headers=s).json()
    assert not r["results"] and "accepted_answers" not in r["items"][0]


def test_hint_score_tampering_and_idempotence(setup, choice):
    c, t, s, _ = setup
    q = create(c, t, choice)
    a = start(c, s, q)
    for _ in range(2):
        assert (
            c.post(f"/api/attempts/{a}/hints/{q}", headers=s).json()["deduction"] == 2
        )
    assert submit(c, s, a, q).json()["earned"] == 8
    assert submit(c, s, a, q, "no").json()["earned"] == 8
    assert (
        c.put(f"/api/attempts/{a}/draft", headers=s, json={"answers": {}}).status_code
        == 409
    )
    assert c.post(f"/api/attempts/{a}/hints/{q}", headers=s).status_code == 409
    b = start(c, s, q)
    assert (
        c.post(
            f"/api/attempts/{b}/submit", headers=s, json={"answers": {}, "marks": 100}
        ).status_code
        == 422
    )
    assert (
        c.post(
            f"/api/attempts/{b}/submit",
            headers=s,
            json={"answers": {"999": {"answer": "yes"}}},
        ).status_code
        == 422
    )
    assert submit(c, s, b, q, "not an option").status_code == 422


def test_probes(setup, choice):
    c, t, s, _ = setup
    q = create(c, t, choice)
    a = start(c, s, q)
    r = submit(c, s, a, q, "no").json()["results"][str(q)]
    assert (
        r["diagnostic"] == "needs more evidence"
        and "probe" in r
        and "accepted_answers" not in r
    )
    r = c.post(
        f"/api/attempts/{a}/probes/{q}", headers=s, json={"answer": "yes"}
    ).json()["results"][str(q)]
    assert (
        r["diagnostic"] == "possible execution slip"
        and r["marks"] == 0
        and r["accepted_answers"] == ["yes"]
    )
    assert (
        c.post(
            f"/api/attempts/{a}/probes/{q}", headers=s, json={"answer": "no"}
        ).status_code
        == 409
    )
    b = start(c, s, q)
    submit(c, s, b, q, "no")
    r = c.post(
        f"/api/attempts/{b}/probes/{q}", headers=s, json={"answer": "no"}
    ).json()["results"][str(q)]
    assert r["diagnostic"] == "possible misconception"


def test_manual_review(setup):
    c, t, s, _ = setup
    q = create(
        c,
        t,
        {
            "title": "Reflection",
            "stem": "Explain what grades hide.",
            "topic": "Learning",
            "rubric": "10 points for reasoned argument",
            "published": True,
        },
    )
    a = start(c, s, q)
    assert (
        submit(c, s, a, q, "A reasoned argument").json()["results"][str(q)]["status"]
        == "pending_review"
    )
    endpoint = f"/api/teacher/attempts/{a}/grade/{q}"
    assert (
        c.post(
            endpoint, headers=s, json={"marks": 8, "feedback": "Well reasoned"}
        ).status_code
        == 403
    )
    assert (
        c.post(
            endpoint, headers=t, json={"marks": 11, "feedback": "Too high"}
        ).status_code
        == 422
    )
    assert (
        c.post(
            endpoint, headers=t, json={"marks": 8, "feedback": "Well reasoned"}
        ).status_code
        == 200
    )
    r = c.get(f"/api/attempts/{a}", headers=s).json()["results"][str(q)]
    assert (
        r["marks"] == 8
        and r["feedback"] == "Well reasoned"
        and r["status"] == "reviewed"
    )
    assert c.get("/api/progress", headers=s).json()["accuracy"] is None


def test_import_atomicity_and_export(setup, choice):
    c, t, s, _ = setup
    r = c.post(
        "/api/questions/import",
        headers=t,
        files={"file": ("bank.json", json.dumps([choice, {"title": "bad"}]))},
    )
    assert r.status_code == 422 and "Row 2" in r.text
    assert c.get("/api/questions", headers=t).json() == []
    assert (
        c.post(
            "/api/questions/import", headers=s, files={"file": ("bank.json", "[]")}
        ).status_code
        == 403
    )
    assert (
        c.post(
            "/api/questions/import",
            headers=t,
            files={"file": ("bank.json", json.dumps([choice]))},
        ).json()["imported"]
        == 1
    )
    assert (
        c.post(
            "/api/questions/import",
            headers=t,
            files={"file": ("huge.json", b" " * 1048577)},
        ).status_code
        == 413
    )
    assert (
        c.post(
            "/api/questions/import", headers=t, files={"file": ("bad.exe", "xxx")}
        ).status_code
        == 422
    )
    q = c.get("/api/questions", headers=t).json()[0]["id"]
    a = start(c, s, q)
    submit(c, s, a, q)
    r = c.get("/api/teacher/export", headers=t)
    assert (
        r.status_code == 200
        and "student@test.edu" in r.text
        and "secure evidence" in r.text
    )


def test_csv_import(setup):
    c, t, s, _ = setup
    r = c.post(
        "/api/questions/import",
        headers=t,
        files={
            "file": (
                "bank.csv",
                (
                    Path(__file__).parents[2] / "docs/question-bank.example.csv"
                ).read_bytes(),
            )
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["imported"] == 3


def test_quiz_timer_and_hidden_answers(setup, choice):
    c, t, s, factory = setup
    q = create(c, t, choice)
    r = c.post(
        "/api/quizzes",
        headers=t,
        json={
            "title": "A quiz",
            "question_ids": [q],
            "time_limit": 60,
            "published": True,
            "reveal_answers": False,
        },
    )
    assert r.status_code == 201, r.text
    z = r.json()["id"]
    a = c.post(f"/api/quizzes/{z}/start", headers=s).json()["id"]
    assert c.post(f"/api/quizzes/{z}/start", headers=s).json()["id"] == a
    c.put(
        f"/api/attempts/{a}/draft",
        headers=s,
        json={"answers": {str(q): {"answer": "yes", "confidence": "unsure"}}},
    )
    with factory() as db:
        row = db.get(Attempt, a)
        row.started_at = now() - timedelta(seconds=61)
        row.deadline = now() - timedelta(seconds=1)
        db.commit()
    r = submit(c, s, a, q, "no").json()
    assert r["earned"] == 10 and "accepted_answers" not in r["results"][str(q)]
    assert c.get("/api/progress", headers=s).json()["time_seconds"] >= 59
    assert (
        c.put(
            f"/api/quizzes/{z}",
            headers=t,
            json={"title": "Private quiz", "question_ids": [q], "student_ids": [9999]},
        ).status_code
        == 422
    )


def test_privacy_and_snapshot(setup, choice):
    c, t, s, _ = setup
    q = create(c, t, choice)
    a = start(c, s, q)
    r = c.post(
        "/api/auth/register",
        json={
            "name": "Other",
            "email": "other-student@test.edu",
            "password": "SafePassword123",
        },
    )
    other = {"Authorization": "Bearer " + r.json()["token"]}
    assert c.get(f"/api/attempts/{a}", headers=other).status_code == 403
    assert submit(c, other, a, q).status_code == 403
    assert (
        c.put(
            f"/api/questions/{q}",
            headers=t,
            json=choice | {"accepted_answers": ["no"], "misconceptions": {}},
        ).status_code
        == 200
    )
    assert submit(c, s, a, q).json()["earned"] == 10
    assert c.delete(f"/api/questions/{q}", headers=t).status_code == 204
    assert c.get("/api/questions", headers=s).json() == []
    assert c.get(f"/api/attempts/{a}", headers=s).status_code == 200


def test_text_variants_and_progress(setup):
    c, t, s, _ = setup
    q = create(
        c,
        t,
        {
            "title": "Transfer",
            "stem": "Name applying an idea elsewhere.",
            "topic": "Learning",
            "kind": "text",
            "accepted_answers": ["transfer", "transfer of learning"],
            "marks": 5,
            "published": True,
        },
    )
    a = start(c, s, q)
    assert submit(c, s, a, q, " TRANSFER   OF LEARNING ").json()["earned"] == 5
    b = start(c, s, q)
    c.post(f"/api/attempts/{b}/submit", headers=s, json={"answers": {}})
    r = c.get("/api/progress", headers=s).json()
    assert (
        r["earned"],
        r["maximum"],
        r["correct"],
        r["unanswered"],
        r["accuracy"],
    ) == (5, 10, 1, 1, 100)
    assert r["completed_question_ids"] == [q]
    assert len(c.get("/api/teacher/analytics", headers=t).json()["students"]) == 1


def test_assignment_is_enforced_and_hidden_quiz_blocks_practice(setup, choice):
    c, t, s, _ = setup
    q = create(c, t, choice)
    student_id = c.get("/api/auth/me", headers=s).json()["id"]
    other = c.post(
        "/api/auth/register",
        json={
            "name": "Other",
            "email": "assign@test.edu",
            "password": "SafePassword123",
        },
    ).json()
    h = {"Authorization": "Bearer " + other["token"]}
    quiz = c.post(
        "/api/quizzes",
        headers=t,
        json={
            "title": "Assigned hidden quiz",
            "question_ids": [q],
            "student_ids": [student_id],
            "published": True,
            "reveal_answers": False,
        },
    ).json()
    assert c.get("/api/quizzes", headers=h).json() == []
    assert c.post(f"/api/quizzes/{quiz['id']}/start", headers=h).status_code == 403
    assert c.post(f"/api/practice/{q}", headers=s).status_code == 403
    assert c.post(f"/api/practice/{q}", headers=h).status_code == 201


def test_deadline_ignores_unsaved_late_answers_and_no_grade_before_submit(
    setup, choice
):
    c, t, s, factory = setup
    q = create(c, t, choice)
    quiz = c.post(
        "/api/quizzes",
        headers=t,
        json={
            "title": "Timed quiz",
            "question_ids": [q],
            "published": True,
            "time_limit": 60,
        },
    ).json()
    a = c.post(f"/api/quizzes/{quiz['id']}/start", headers=s).json()["id"]
    assert (
        c.post(
            f"/api/attempts/{a}/probes/{q}", headers=s, json={"answer": "yes"}
        ).status_code
        == 409
    )
    with factory() as db:
        row = db.get(Attempt, a)
        row.started_at = now() - timedelta(seconds=61)
        row.deadline = now() - timedelta(seconds=1)
        db.commit()
    r = submit(c, s, a, q).json()
    assert r["earned"] == 0 and r["results"][str(q)]["status"] == "unanswered"


def test_import_templates_are_teacher_only(setup):
    c, t, s, _ = setup
    assert c.get("/api/teacher/template/json", headers=s).status_code == 403
    assert c.get("/api/teacher/template/csv").status_code == 401
    assert len(c.get("/api/teacher/template/json", headers=t).json()) == 3
    assert "accepted_answers" in c.get("/api/teacher/template/csv", headers=t).text


import pytest


@pytest.mark.parametrize("index", [0, 1, 2, 3])
def test_each_original_riddle_enters_manual_review(setup, index):
    c, t, s, _ = setup
    row = json.loads(
        (Path(__file__).parents[1] / "app/seed_questions.json").read_text()
    )[index]
    q = create(c, t, row)
    a = start(c, s, q)
    r = submit(
        c, s, a, q, "An evidence-based argument with alternative interpretations."
    ).json()
    assert r["results"][str(q)]["status"] == "pending_review"
    assert "explanation" not in r["results"][str(q)]
    assert (
        c.post(
            f"/api/teacher/attempts/{a}/grade/{q}",
            headers=t,
            json={"marks": 10, "feedback": "Rubric criteria satisfied."},
        ).status_code
        == 200
    )
    r = c.get(f"/api/attempts/{a}", headers=s).json()
    assert (
        r["earned"] == 10 and r["results"][str(q)]["explanation"] == row["explanation"]
    )


def test_quiz_update_unpublish_and_unavailable_question(setup, choice):
    c, t, s, _ = setup
    q = create(c, t, choice)
    data = {
        "title": "A quiz",
        "question_ids": [q],
        "published": True,
        "reveal_answers": True,
    }
    z = c.post("/api/quizzes", headers=t, json=data).json()["id"]
    a = c.post(f"/api/quizzes/{z}/start", headers=s).json()["id"]
    assert (
        c.put(
            f"/api/quizzes/{z}", headers=t, json=data | {"reveal_answers": False}
        ).status_code
        == 200
    )
    r = submit(c, s, a, q).json()
    assert r["reveal_answers"] is True
    assert c.delete(f"/api/quizzes/{z}", headers=t).status_code == 204
    assert c.post(f"/api/quizzes/{z}/start", headers=s).status_code == 403
    c.put(f"/api/quizzes/{z}", headers=t, json=data)
    c.delete(f"/api/questions/{q}", headers=t)
    assert c.post(f"/api/quizzes/{z}/start", headers=s).status_code == 409
