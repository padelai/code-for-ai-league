from functools import lru_cache
from typing import Annotated

import boto3
from fastapi import Depends
from mypy_boto3_dynamodb.client import DynamoDBClient
from mypy_boto3_s3.client import S3Client

from ballskicker_api.config.settings import AppSettings, get_settings


class AWSService:
    def __init__(self, region: str):
        self.aws_region = region

    def get_s3_client(self) -> S3Client:
        return boto3.client("s3", region_name=self.aws_region)

    def get_dynamodb_client(self) -> DynamoDBClient:
        return boto3.client("dynamodb", region_name=self.aws_region)


@lru_cache
def get_aws_service(
    settings: Annotated[AppSettings, Depends(get_settings)],
) -> AWSService:
    return AWSService(region=settings.AWS_REGION)


@lru_cache
def get_s3_client(
    aws_client: Annotated[AWSService, Depends(get_aws_service)],
) -> S3Client:
    return aws_client.get_s3_client()


@lru_cache
def get_dynamodb_client(
    aws_client: Annotated[AWSService, Depends(get_aws_service)],
) -> DynamoDBClient:
    return aws_client.get_dynamodb_client()
