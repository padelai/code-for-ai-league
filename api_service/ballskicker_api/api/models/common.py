from typing import Generic, TypeVar

from ballskicker_api.common.utils import CamelModel

T = TypeVar("T", bound=CamelModel)


class PaginatedResponse(CamelModel, Generic[T]):
    items: list[T]
