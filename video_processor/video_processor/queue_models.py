from typing import Annotated

from pydantic import AliasPath, BaseModel, BeforeValidator, Field
from pydantic_core import from_json


class ResponseMetadata(BaseModel):
    request_id: Annotated[str, Field(alias="RequestId")]
    status_code: Annotated[int, Field(alias="HTTPStatusCode")]


class S3Record(BaseModel):
    bucket: Annotated[str, Field(alias=AliasPath("s3", "bucket", "name"))]
    key: Annotated[str, Field(alias=AliasPath("s3", "object", "key"))]


class MessageBody(BaseModel):
    records: Annotated[list[S3Record], Field(alias="Records", default_factory=list)]


class Message(BaseModel):
    receipt_handle: Annotated[str, Field(alias="ReceiptHandle")]
    body: Annotated[MessageBody, Field(alias="Body"), BeforeValidator(from_json)]


class QueueResponse(BaseModel):
    metadata: Annotated[ResponseMetadata, Field(alias="ResponseMetadata")]
    messages: Annotated[list[Message], Field(alias="Messages", default_factory=list)]
