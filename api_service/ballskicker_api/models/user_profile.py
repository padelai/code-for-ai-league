from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserProfile(BaseModel):
    id: UUID
    email: EmailStr
    display_name: str | None = None
    username: str | None = None
    created_at: datetime
