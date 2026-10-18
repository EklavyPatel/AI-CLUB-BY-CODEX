"""Administrative commands: no public teacher registration or fixed passwords."""

import argparse
import getpass
import json
import os
from pathlib import Path
from sqlalchemy import select
from .db import SessionLocal
from .models import User, Question
from .schemas import Register, QuestionIn
from .security import passwords


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["teacher", "seed"])
    args = parser.parse_args()
    with SessionLocal() as db:
        email = (
            os.getenv("BOOTSTRAP_TEACHER_EMAIL") or input("Teacher email: ").strip()
        ).lower()
        user = db.scalar(select(User).where(User.email == email))
        if args.command == "teacher":
            if user:
                raise SystemExit(
                    "Account exists; no changes made. Use another email or manage roles administratively."
                )
            password = os.getenv("BOOTSTRAP_TEACHER_PASSWORD") or getpass.getpass(
                "Teacher password (10+ characters): "
            )
            data = Register(name="Teacher", email=email, password=password)
            user = User(
                name=data.name,
                email=data.email,
                password_hash=passwords.hash(data.password),
                role="teacher",
            )
            db.add(user)
            db.commit()
            print("Teacher account created.")
        else:
            if not user or user.role != "teacher":
                raise SystemExit("Create the teacher account first.")
            rows = json.loads(
                (Path(__file__).parent / "seed_questions.json").read_text()
            )
            existing = {
                q.content["title"]
                for q in db.scalars(
                    select(Question).where(Question.owner_id == user.id)
                )
            }
            count = 0
            for row in rows:
                data = QuestionIn.model_validate(row)
                if data.title not in existing:
                    db.add(
                        Question(
                            owner_id=user.id,
                            content=data.model_dump(exclude={"published"}),
                            published=True,
                        )
                    )
                    count += 1
            db.commit()
            print(f"Added {count} questions. Existing questions preserved.")


if __name__ == "__main__":
    main()
