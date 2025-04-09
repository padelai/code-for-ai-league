import logging
from uuid import UUID

import httpx
from fastapi import HTTPException
from jose import JWTError, jwt
from pydantic import BaseModel, Field

logger = logging.getLogger("CognitoAuth")


class TokenClaims(BaseModel):
    token_use: str
    sub: UUID
    username: str
    cognito_groups: list[str] = Field(alias="cognito:groups")


class CognitoAuth:
    def __init__(self, region: str, user_pool_id: str, client_id: str):
        self.region = region
        self.user_pool_id = user_pool_id
        self.client_id = client_id
        self.jwks = None
        self.jwks_url = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}/.well-known/jwks.json"

    async def get_jwks(self):
        if not self.jwks:
            response = httpx.get(self.jwks_url)
            self.jwks = response.json()
        return self.jwks

    async def get_public_key(self, kid: str):
        jwks = await self.get_jwks()
        key_index = -1
        for i in range(len(jwks["keys"])):
            if kid == jwks["keys"][i]["kid"]:
                key_index = i
                break
        if key_index == -1:
            raise Exception("Public key not found in jwks.json")
        return jwks["keys"][key_index]

    async def verify_token(self, token: str) -> TokenClaims:
        try:
            # Get the header from the token
            headers = jwt.get_unverified_headers(token)
            kid = headers["kid"]

            # Get the public key
            public_key = await self.get_public_key(kid)

            # Get the last two sections of the token,
            # message and signature (encoded in base64)
            message, encoded_signature = str(token).rsplit(".", 1)

            # Decode the signature
            # decoded_signature = base64url_decode(encoded_signature.encode("utf-8"))

            # Verify the signature
            claims = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                audience=self.client_id,
                options={
                    "verify_exp": True,
                    "verify_aud": True,
                    "verify_iss": True,
                },
            )

            token_content = TokenClaims.model_validate(claims)

            if token_content.token_use != "access":
                raise JWTError("Invalid token use") from None

            return token_content

        except JWTError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}") from None
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}") from None
