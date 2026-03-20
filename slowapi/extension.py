import inspect
import time
from collections import defaultdict, deque
from functools import wraps

from .errors import RateLimitExceeded


class _InMemoryStorage:
    def __init__(self) -> None:
        self._entries = defaultdict(deque)

    def hit(self, bucket: str, limit: int, window_seconds: int) -> bool:
        now = time.monotonic()
        window_start = now - window_seconds
        hits = self._entries[bucket]
        while hits and hits[0] <= window_start:
            hits.popleft()
        if len(hits) >= limit:
            return False
        hits.append(now)
        return True

    def reset(self) -> None:
        self._entries.clear()


class Limiter:
    def __init__(self, key_func):
        self.key_func = key_func
        self._storage = _InMemoryStorage()

    def limit(self, value: str):
        limit, window_seconds = self._parse_limit(value)

        def decorator(func):
            signature = inspect.signature(func)
            if "request" not in signature.parameters:
                raise ValueError("Rate-limited endpoints must accept a request parameter")

            @wraps(func)
            async def wrapper(*args, **kwargs):
                bound = signature.bind_partial(*args, **kwargs)
                request = bound.arguments["request"]
                key = self.key_func(request)
                bucket = f"{func.__module__}.{func.__name__}:{key}:{limit}/{window_seconds}"
                if not self._storage.hit(bucket, limit, window_seconds):
                    raise RateLimitExceeded()
                return await func(*args, **kwargs)

            return wrapper

        return decorator

    @staticmethod
    def _parse_limit(value: str) -> tuple[int, int]:
        count_text, unit = value.split("/", 1)
        count = int(count_text)
        normalized = unit.strip().lower()
        if normalized in {"second", "sec", "s"}:
            return count, 1
        if normalized in {"minute", "min", "m"}:
            return count, 60
        if normalized in {"hour", "h"}:
            return count, 3600
        raise ValueError(f"Unsupported rate limit window: {value}")
