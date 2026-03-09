import logging
from logging.handlers import RotatingFileHandler
from flask import request
import os

# === 1. FORCE ABSOLUTE PATH ===
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILENAME = os.path.join(BASE_DIR, 'server_traffic.log')

print("--------------------------------------------------")
print(f"[LOGGER] Saving log file to: {LOG_FILENAME}")
print("--------------------------------------------------")

# === 2. Configure Logger ===
logger = logging.getLogger('TrafficLogger')
logger.setLevel(logging.INFO)

handler = RotatingFileHandler(LOG_FILENAME, maxBytes=100_000_000, backupCount=5)

formatter = logging.Formatter('%(created)f,%(message)s')
handler.setFormatter(formatter)

if not logger.handlers:
    logger.addHandler(handler)


def get_client_ip():
    """
    Extract the real client IP (works with ngrok, proxies, IPv6).
    """

    ip = request.headers.get("X-Forwarded-For")

    if ip:
        ip = ip.split(",")[0].strip()
    else:
        ip = request.remote_addr

    # Convert IPv6 mapped IPv4
    if ip and ip.startswith("::ffff:"):
        ip = ip.replace("::ffff:", "")

    return ip


def log_request_info(response):
    """
    Logs request details using rotating file handler.
    """

    try:

        ip = get_client_ip()

        endpoint = request.path
        method = request.method
        status_code = response.status_code
        content_length = response.content_length if response.content_length else 0

        log_message = f"{ip},{endpoint},{method},{status_code},{content_length}"

        logger.info(log_message)

    except Exception as e:
        print(f"[LOGGER ERROR] {e}")

    return response