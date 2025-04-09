import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from ballskicker_api.api.routes.file_upload import videos_router
from ballskicker_api.api.routes.profile import profile_router
from ballskicker_api.api.routes.recordings import recordings_router

logging.basicConfig(
    level=logging.INFO,  # Ensure INFO level logs are captured
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    handlers=[logging.StreamHandler()],
)


class MyHTTPSRedirectMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if "x-forwarded-proto" in request.headers:
            request.scope["scheme"] = request.headers["x-forwarded-proto"]
        return await call_next(request)


app = FastAPI()

app.add_middleware(MyHTTPSRedirectMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://padel.piar.ai", "http://localhost:8100"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(videos_router)
app.include_router(profile_router)
app.include_router(recordings_router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Hello World"}


@app.get("/_health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy"}
