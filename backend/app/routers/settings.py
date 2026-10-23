from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import require_auth, get_setting, set_setting
from ..db import get_db
from ..migrations import DEFAULT_DISPLAY_NAME

router = APIRouter(
    prefix="/api/settings", tags=["settings"], dependencies=[Depends(require_auth)]
)

DISPLAY_NAME_KEY = "display_name"


class DisplayNameUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=40)


class DisplayNameOut(BaseModel):
    display_name: str


@router.get("", response_model=DisplayNameOut)
def get_settings(db: Session = Depends(get_db)):
    return DisplayNameOut(
        display_name=get_setting(db, DISPLAY_NAME_KEY) or DEFAULT_DISPLAY_NAME
    )


@router.patch("", response_model=DisplayNameOut)
def update_settings(body: DisplayNameUpdate, db: Session = Depends(get_db)):
    name = body.display_name.strip()
    if not name:
        from fastapi import HTTPException

        raise HTTPException(status_code=422, detail="display_name must not be blank")
    set_setting(db, DISPLAY_NAME_KEY, name)
    return DisplayNameOut(display_name=name)
