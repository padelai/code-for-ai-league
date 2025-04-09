import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException
from pydantic import BeforeValidator, EmailStr, Field

from ballskicker_api.common.utils import CamelModel
from ballskicker_api.models.user_profile import UserProfile
from ballskicker_api.repositories.user_repository import LoginType, UserInfo, UserLoginInfo, UserRepository

logger = logging.getLogger("UsersService")


class CognitoIdentity(CamelModel):
    user_id: str
    provider_name: str
    provider_type: str


class CognitoUserInfo(CamelModel):
    login_id: str = Field(alias="username")
    sub: str
    email: EmailStr
    name: str
    identities: Annotated[list[CognitoIdentity], BeforeValidator(lambda x: json.loads(x))]


class UsersService:
    def __init__(self, user_pool_id: str, user_repository: UserRepository):
        self.user_pool_id = user_pool_id
        self.repository = user_repository

    def __get_cognito_user_info(self, cognito_username: str) -> CognitoUserInfo:
        try:
            cognito = boto3.client("cognito-idp")

            response = cognito.admin_get_user(UserPoolId=self.user_pool_id, Username=cognito_username)

            # Just squashing top-level username and attributes together to simplify the model
            attributes = {attr["Name"]: attr["Value"] for attr in response["UserAttributes"]}
            attributes["username"] = response["Username"]

            cognito_user_info = CognitoUserInfo.model_validate(attributes)
            return cognito_user_info

        except ClientError as e:
            print(f"Cognito error: {e}")
            if e.response["Error"]["Code"] == "UserNotFoundException":
                return None
            raise

    async def __create_user(self, cognito_user_info: CognitoUserInfo) -> UserInfo:
        assert len(cognito_user_info.identities) == 1, "Only allow cognito grants with singular identity"

        user_id = uuid.uuid4()

        user_info = UserInfo(
            user_id=user_id,
            email=cognito_user_info.email,
            display_name=cognito_user_info.name,
            created_at=datetime.now(UTC),
        )

        login_info = UserLoginInfo(
            user_id=user_id,
            login_id=cognito_user_info.login_id,
            email=cognito_user_info.email,
            login_type=LoginType(cognito_user_info.identities[0].provider_name.lower()),
            login_user_id=cognito_user_info.identities[0].user_id,
            created_at=datetime.now(UTC),
        )

        await self.repository.create_user(user_info, login_info)

        return user_info

    async def get_user_by_cognito_username(self, cognito_username: str) -> UserInfo:
        try:
            logger.info(f"Getting profile by {cognito_username}")
            user_info = await self.repository.get_by_cognito_username(cognito_username)
            if user_info:
                logger.info("Found existing registration")
                return user_info

            logger.info("No profile found. Fetching user info from cognito")
            cognito_user_info = self.__get_cognito_user_info(cognito_username)

            logger.info("Looking for profiles with the same login")
            user_info = await self.repository.get_by_email(cognito_user_info.email)
            if user_info:
                raise AssertionError("This email is already used for another auth method")

            logger.info("Creating a new user")
            return await self.__create_user(cognito_user_info)

        except Exception as e:
            logger.warning(f"Failed to fetch user profile: {e}", exc_info=True)
            raise HTTPException(status_code=400, detail=str(e)) from e

    async def get_my_profile(self, user_id: UUID) -> UserProfile:
        user = await self.repository.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Profile not found")
        return UserProfile(**user)
