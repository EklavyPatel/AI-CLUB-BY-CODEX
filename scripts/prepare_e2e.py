"""Run from backend with PYTHONPATH=. against a DISPOSABLE database only.
Generates random test credentials outside the repository. Never use real learner data.
"""

import json
import os
from pathlib import Path
import secrets
from app.db import SessionLocal
from app.models import User, Question
from app.security import passwords
from app.schemas import QuestionIn


def main():
    if os.getenv("E2E_DISPOSABLE_DB") != "yes":
        raise SystemExit("Set E2E_DISPOSABLE_DB=yes and use a disposable DATABASE_URL.")
    password = secrets.token_urlsafe(24)
    suffix = secrets.token_hex(5)
    credentials = {"teacher": f"teacher-{suffix}@test.invalid", "password": password}
    with SessionLocal() as db:
        u = User(
            name="Test Teacher",
            email=credentials["teacher"],
            password_hash=passwords.hash(password),
            role="teacher",
        )
        db.add(u)
        db.flush()
        rows = json.loads(
            (
                Path(__file__).resolve().parents[1] / "backend/app/seed_questions.json"
            ).read_text()
        )
        for row in rows:
            q = QuestionIn.model_validate(row)
            db.add(
                Question(
                    owner_id=u.id,
                    content=q.model_dump(exclude={"published"}),
                    published=True,
                )
            )
        db.commit()
    path = Path(os.getenv("E2E_CREDENTIALS_FILE", "/tmp/beyond-e2e.json"))
    path.write_text(json.dumps(credentials))
    path.chmod(0o600)
    print(
        "Created isolated test teacher and sample question bank. Credentials saved to the configured local file."
    )


if __name__ == "__main__":
    main()
