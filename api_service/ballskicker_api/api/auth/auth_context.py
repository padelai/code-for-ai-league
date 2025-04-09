from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID

from ballskicker_api.repositories.user_repository import UserInfo


class AuthMethod(StrEnum):
    GOOGLE = "google"
    APPLE = "apple"


@dataclass
class AuthContext:
    user_id: UUID
    user_info: UserInfo
