from fastapi.responses import JSONResponse


def _rate_limit_exceeded_handler(request, exc):
    return JSONResponse(status_code=429, content={"detail": getattr(exc, "detail", "Rate limit exceeded")})
