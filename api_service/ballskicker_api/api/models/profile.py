from uuid import UUID

from pydantic import EmailStr

from ballskicker_api.common.utils import CamelModel


class Profile(CamelModel):
    user_id: UUID
    email: EmailStr
    display_name: str
