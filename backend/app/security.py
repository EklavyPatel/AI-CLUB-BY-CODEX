import hashlib
import secrets
from datetime import timedelta
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pwdlib import PasswordHash
from sqlalchemy.orm import Session
from .db import get_db, now
from .models import User, AuthSession

passwords = PasswordHash.recommended()
dummy_hash = passwords.hash("nonexistent-account-password")
bearer = HTTPBearer(auto_error=False)


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def session_for(db, user):
    token = secrets.token_urlsafe(48)
    db.add(
        AuthSession(
            token_hash=digest(token),
            user_id=user.id,
            expires_at=now() + timedelta(hours=12),
        )
    )
    db.commit()
    return {"token": token, "user": public_user(user)}


def public_user(user):
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}


def current_user(
    auth: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
):
    if not auth:
        raise HTTPException(401, "Please log in")
    session = db.get(AuthSession, digest(auth.credentials))
    if not session or session.expires_at < now():
        raise HTTPException(401, "Session expired. Please log in again")
    return db.get(User, session.user_id)


def teacher(user: User = Depends(current_user)):
    if user.role != "teacher":
        raise HTTPException(403, "Teacher access required")
    return user
