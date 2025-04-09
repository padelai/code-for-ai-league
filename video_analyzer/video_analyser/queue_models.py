from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, BeforeValidator, Field
from pydantic_core import from_json


class MediaDescriptor(BaseModel):
    media_id: UUID
    media_key: str


class ResponseMetadata(BaseModel):
    request_id: Annotated[str, Field(alias="RequestId")]
    status_code: Annotated[int, Field(alias="HTTPStatusCode")]


class MessageBody(BaseModel):
    records: Annotated[list[MediaDescriptor], Field(alias="Records", default_factory=list)]


class Message(BaseModel):
    receipt_handle: Annotated[str, Field(alias="ReceiptHandle")]
    body: Annotated[MediaDescriptor, Field(alias="Body"), BeforeValidator(from_json)]


class QueueResponse(BaseModel):
    metadata: Annotated[ResponseMetadata, Field(alias="ResponseMetadata")]
    messages: Annotated[list[Message], Field(alias="Messages", default_factory=list)]
