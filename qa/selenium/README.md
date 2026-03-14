# Selenium UI smoke tests

These tests validate real browser interactions against a running app:

- World map renders and accepts country clicks.
- Geography Games panel opens from map controls.
- Map Quiz flow can be started from the games hub.

## Run locally (Dockerized app + Selenium)

```bash
# 1) Start the app stack
docker compose up -d --build

# 2) Start Selenium standalone Chrome
docker run --rm -d --name world-tracker-selenium -p 4444:4444 -p 7900:7900 selenium/standalone-chrome:latest

# 3) Install test deps
python -m venv .venv-qa
source .venv-qa/bin/activate
pip install -r qa/selenium/requirements.txt

# 4) Run smoke tests
APP_URL=http://localhost:8088 SELENIUM_REMOTE_URL=http://localhost:4444/wd/hub pytest -q qa/selenium/test_ui_smoke.py
```

> Tip: open `http://localhost:7900` (password: `secret`) to watch browser sessions live.
