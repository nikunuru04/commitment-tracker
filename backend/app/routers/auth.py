from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import auth_enabled, change_password, login
from ..db import get_db
from ..schemas import AuthStatus, LoginRequest, LoginResponse

router = APIRouter(prefix="/api", tags=["auth"])


class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8)


@router.get("/auth/status", response_model=AuthStatus)
def status(db: Session = Depends(get_db)):
    return AuthStatus(auth_required=auth_enabled(db))


@router.post("/auth/login", response_model=LoginResponse)
def login_route(body: LoginRequest, db: Session = Depends(get_db)):
    return LoginResponse(token=login(body.password, db))


@router.patch("/settings/password", status_code=204)
def change_password_route(body: PasswordChange, db: Session = Depends(get_db)):
    change_password(body.old_password, body.new_password, db)
