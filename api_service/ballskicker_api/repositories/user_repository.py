from datetime import datetime
from enum import StrEnum
from uuid import UUID

from aioboto3 import Session
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from pydantic import BaseModel, EmailStr

from ballskicker_api.core.database import get_dynamodb_table


class LoginType(StrEnum):
    GOOGLE = "google"
    APPLE = "apple"


class UserInfo(BaseModel):
    user_id: UUID
    display_name: str | None = None
    email: EmailStr
    created_at: datetime


class UserLoginInfo(BaseModel):
    user_id: UUID
    login_id: str
    login_type: LoginType
    login_user_id: str
    email: EmailStr
    created_at: datetime


class UserRepository:
    def __init__(self):
        self.users_table = get_dynamodb_table("users")
        self.login_table = get_dynamodb_table("users-login-info")

    async def __get_login_entry(self, cognito_username: str) -> UserLoginInfo | None:
        async with Session().resource("dynamodb") as dynamodb:
            login_table = await dynamodb.Table("users-login-info")
            response = await login_table.get_item(Key={"login_id": cognito_username})

        if "Item" in response:
            return UserLoginInfo.model_validate(response["Item"])

        return None

    async def get_by_cognito_username(self, cognito_username: str) -> UserInfo | None:
        try:
            user_login_info = await self.__get_login_entry(cognito_username)
            if not user_login_info:
                return None

            return await self.get_by_id(user_login_info.user_id)

        except ClientError as e:
            print(f"Error accessing DynamoDB: {e.response['Error']['Message']}")
            raise

    async def get_by_id(self, user_id: UUID) -> UserInfo | None:
        async with Session().resource("dynamodb") as dynamodb:
            users_table = await dynamodb.Table("users")
            response = await users_table.get_item(Key={"user_id": str(user_id)})

        if "Item" in response:
            return UserInfo.model_validate(response["Item"])

        return None

    async def get_by_email(self, email: EmailStr) -> UserInfo:
        response = self.users_table.query(IndexName="email-index", KeyConditionExpression=Key("email").eq(email))
        items = response.get("Items", [])
        return items[0] if items else None

    async def create_user(self, user_info: UserInfo, user_login_info: UserLoginInfo) -> None:
        async with Session().resource("dynamodb") as dynamodb:
            try:
                transact_items = [
                    {"Put": {"TableName": "users", "Item": user_info.model_dump(mode="json")}},
                    {"Put": {"TableName": "users-login-info", "Item": user_login_info.model_dump(mode="json")}},
                ]

                await dynamodb.meta.client.transact_write_items(TransactItems=transact_items)

            except Exception as e:
                print(f"Failed to write profile data: {e}")
                raise
