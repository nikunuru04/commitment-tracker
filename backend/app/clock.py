"""Single source of truth for "today", in Asia/Kuala_Lumpur regardless of OS TZ."""
from datetime import datetime
from zoneinfo import ZoneInfo

_TZ = ZoneInfo("Asia/Kuala_Lumpur")


def today() -> "date":  # noqa: F821
    return datetime.now(_TZ).date()


def current_month() -> str:
    return today().strftime("%Y-%m")
