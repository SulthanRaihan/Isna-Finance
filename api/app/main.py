from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.health import router as health_router
from app.api.profile import router as profile_router
from app.core.auth import AuthError

app = FastAPI(title="Isna Finance API", version="0.2.0")
app.include_router(health_router, prefix="/api/v1")
app.include_router(profile_router, prefix="/api/v1")


@app.exception_handler(AuthError)
async def handle_auth_error(request: Request, error: AuthError) -> JSONResponse:
    headers = {"Cache-Control": "private, no-store"}
    if error.status == 401:
        headers["WWW-Authenticate"] = "Bearer"
    return JSONResponse(
        status_code=error.status,
        content={"error": {"code": error.code, "message": error.message, "fields": {}}},
        headers=headers,
    )
