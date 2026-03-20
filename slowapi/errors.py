class RateLimitExceeded(Exception):
    def __init__(self, detail: str = "Rate limit exceeded") -> None:
        super().__init__(detail)
        self.detail = detail
