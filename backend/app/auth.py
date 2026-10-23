import hashlib
import hmac
import secrets

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import Setting

TOKEN_KEY = "auth_token"
PASSWORD_HASH_KEY = "auth_password_hash"
PBKDF2_ITERATIONS = 200000


def get_setting(db: Session, key: str) -> str | None:
    row = db.get(Setting, key)
    return row.value if row else None


def set_setting(db: Session, key: str, value: str) -> None:
    row = db.get(Setting, key)
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))
    db.commit()


def delete_setting(db: Session, key: str) -> None:
    row = db.get(Setting, key)
    if row:
        db.delete(row)
        db.commit()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_hash(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt_hex, hash_hex = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations)
        )
        return hmac.compare_digest(digest.hex(), hash_hex)
    except (ValueError, TypeError):
        return False


def effective_password(db: Session) -> str | None:
    """Stored hash wins over APP_PASSWORD env; env is the fallback."""
    stored = get_setting(db, PASSWORD_HASH_KEY)
    if stored is not None:
        return stored
    return settings.APP_PASSWORD or None


def is_hash(stored: str | None) -> bool:
    return bool(stored) and stored.startswith("pbkdf2_sha256$")


def auth_enabled(db: Session | None = None) -> bool:
    if db is not None:
        return effective_password(db) is not None
    return bool(settings.APP_PASSWORD)


def check_password(password: str, db: Session) -> bool:
    effective = effective_password(db)
    if effective is None:
        return False
    if is_hash(effective):
        return verify_hash(password, effective)
    return hmac.compare_digest(password, effective)


def login(password: str, db: Session) -> str:
    if not auth_enabled(db):
        raise HTTPException(status_code=400, detail="Auth is disabled")
    if not check_password(password, db):
        raise HTTPException(status_code=401, detail="Invalid password")
    effective = effective_password(db)
    # Bootstrap: persist a hash once when logging in against env-only password.
    if not is_hash(effective):
        set_setting(db, PASSWORD_HASH_KEY, hash_password(effective))
    token = get_setting(db, TOKEN_KEY)
    if token is None:
        token = secrets.token_hex(32)
        set_setting(db, TOKEN_KEY, token)
    return token


def change_password(old: str, new: str, db: Session) -> None:
    if not auth_enabled(db):
        raise HTTPException(status_code=400, detail="Auth is disabled")
    if not check_password(old, db):
        raise HTTPException(status_code=401, detail="Invalid password")
    if len(new) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    set_setting(db, PASSWORD_HASH_KEY, hash_password(new))
    delete_setting(db, TOKEN_KEY)


def require_auth(request: Request, db: Session = Depends(get_db)) -> None:
    if not auth_enabled(db):
        return
    header = request.headers.get("Authorization", "")
    token = get_setting(db, TOKEN_KEY)
    expected = f"Bearer {token if token else ''}"
    if not token or not hmac.compare_digest(header, expected):
        raise HTTPException(status_code=401, detail="Not authenticated")
