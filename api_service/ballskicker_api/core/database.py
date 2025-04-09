import boto3

from ballskicker_api.config.settings import get_settings


def get_dynamodb_table(table_name: str):
    settings = get_settings()

    dynamodb = boto3.resource("dynamodb", region_name=settings.AWS_REGION)
    return dynamodb.Table(table_name)
