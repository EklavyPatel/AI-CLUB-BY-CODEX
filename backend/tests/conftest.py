import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db import Base, get_db
from app.models import User
from app.main import app
from app.security import passwords


@pytest.fixture()
def setup():
    url = os.getenv("TEST_DATABASE_URL", "sqlite://")
    engine = create_engine(
        url,
        **(
            {"connect_args": {"check_same_thread": False}, "poolclass": StaticPool}
            if url == "sqlite://"
            else {}
        ),
    )
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    with factory() as db:
        db.add_all(
            [
                User(
                    name="Teacher",
                    email="teacher@test.edu",
                    password_hash=passwords.hash("SafePassword123"),
                    role="teacher",
                ),
                User(
                    name="Other teacher",
                    email="other@test.edu",
                    password_hash=passwords.hash("SafePassword123"),
                    role="teacher",
                ),
            ]
        )
        db.commit()

    def override():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        t = {
            "Authorization": "Bearer "
            + c.post(
                "/api/auth/login",
                json={"email": "teacher@test.edu", "password": "SafePassword123"},
            ).json()["token"]
        }
        s = {
            "Authorization": "Bearer "
            + c.post(
                "/api/auth/register",
                json={
                    "name": "Student",
                    "email": "student@test.edu",
                    "password": "SafePassword123",
                },
            ).json()["token"]
        }
        yield c, t, s, factory
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def choice():
    return {
        "title": "A sample question",
        "stem": "Which answer is correct?",
        "topic": "Evidence",
        "kind": "choice",
        "marks": 10,
        "options": ["yes", "no"],
        "accepted_answers": ["yes"],
        "published": True,
        "hint": "Consider yes",
        "hint_cost": 2,
        "explanation": "Yes is correct",
        "misconceptions": {"no": "not-yes"},
        "probe": {
            "stem": "Reworded: choose yes.",
            "options": ["yes", "no"],
            "answer": "yes",
        },
    }
