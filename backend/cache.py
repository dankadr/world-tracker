# backend/cache.py
# Redis/Memcached integration for backend caching

import os
from fastapi import Depends

try:
    import redis
except ImportError:
    redis = None

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

class Cache:
    def __init__(self):
        if redis:
            self.client = redis.Redis.from_url(REDIS_URL)
        else:
            self.client = None

    def get(self, key):
        if self.client:
            val = self.client.get(key)
            if val:
                return val.decode()
        return None

    def set(self, key, value, ex=3600):
        if self.client:
            self.client.set(key, value, ex=ex)

cache = Cache()

def get_cache():
    return cache
