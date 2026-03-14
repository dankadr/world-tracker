import os
import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

APP_URL = os.getenv('APP_URL', 'http://localhost:8088')
SELENIUM_REMOTE_URL = os.getenv('SELENIUM_REMOTE_URL', 'http://localhost:4444/wd/hub')


@pytest.fixture
def driver():
    options = Options()
    options.add_argument('--headless=new')
    options.add_argument('--window-size=1600,1000')

    driver = webdriver.Remote(
        command_executor=SELENIUM_REMOTE_URL,
        options=options,
    )
    driver.implicitly_wait(2)
    yield driver
    driver.quit()


def wait_for_app_shell(driver):
    wait = WebDriverWait(driver, 25)
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="world-map-container"]')))


def test_world_map_country_click_and_games_entry(driver):
    driver.get(APP_URL)
    wait_for_app_shell(driver)
    wait = WebDriverWait(driver, 20)

    # Click first country path rendered by Leaflet GeoJSON.
    country_paths = wait.until(
        EC.presence_of_all_elements_located((By.CSS_SELECTOR, '.leaflet-interactive'))
    )
    assert country_paths, 'Expected at least one map polygon path to be rendered.'
    driver.execute_script('arguments[0].click();', country_paths[0])

    # Open games panel from the map action button.
    wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-testid="open-geography-games"]'))).click()
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-testid="games-panel"]')))


def test_map_quiz_start_flow(driver):
    driver.get(APP_URL)
    wait_for_app_shell(driver)
    wait = WebDriverWait(driver, 20)

    wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-testid="open-geography-games"]'))).click()
    wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-testid="play-map-quiz"]'))).click()
    wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-testid="map-config-start"]'))).click()

    # Map quiz overlay contains "Find:" prompt once quiz starts.
    wait.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'Find:')]")))
