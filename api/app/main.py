from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.health import router as health_router
from app.api.master_data import router as master_router
from app.api.money_out import router as money_out_router
from app.api.orders import router as orders_router
from app.api.profile import router as profile_router
from app.api.team_activity import router as team_router
from app.core.auth import AuthError
from app.repositories.master_data import DataError

app = FastAPI(title="Isna Finance API", version="0.5.0")
app.include_router(health_router, prefix="/api/v1")
app.include_router(profile_router, prefix="/api/v1")
app.include_router(master_router, prefix="/api/v1")
app.include_router(orders_router, prefix="/api/v1")
app.include_router(team_router, prefix="/api/v1")
app.include_router(money_out_router, prefix="/api/v1")


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


@app.exception_handler(DataError)
async def handle_data_error(request: Request, error: DataError):
    return JSONResponse(
        status_code=error.status,
        headers={"Cache-Control": "private, no-store"},
        content={"error": {"code": error.code, "message": error.message, "fields": error.fields}},
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, error: RequestValidationError):
    # Do not echo request input (which may contain private information).
    fields = {
        ".".join(str(part) for part in item["loc"]): "Invalid value" for item in error.errors()
    }
    return JSONResponse(
        status_code=422,
        headers={"Cache-Control": "private, no-store"},
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Check the input fields.",
                "fields": fields,
            }
        },
    )
