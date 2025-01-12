import json
import os
import sys
import requests
from typing import Optional

RESPONSE_FILENAME = "rc-response.json"
METADATA_FILENAME = "surfer.json"


def get_current_version() -> Optional[str]:
  """Retrieve the current version from the metadata file."""
  try:
    with open(METADATA_FILENAME) as f:
      metadata = json.load(f)
      return metadata["version"]["candidate"]
  except (FileNotFoundError, json.JSONDecodeError) as e:
    print(f"Error reading current version: {e}")
    return None


def get_rc_response() -> Optional[str]:
  """Get the release candidate response from the response file."""
  try:
    with open(RESPONSE_FILENAME) as f:
      data = json.load(f)
      for tag_dict in data["tags"]:
        tag = tag_dict["tag"]
        if (tag.startswith("FIREFOX") and tag.endswith("_BUILD1")
                and "ESR" not in tag and "b" not in tag):
          return (tag.replace("FIREFOX_", "").replace("_BUILD1",
                                                      "").replace("_", "."))
  except (FileNotFoundError, json.JSONDecodeError) as e:
    print(f"Error reading RC response: {e}")
  return None


def get_pings() -> str:
  """Build a string of Discord user IDs for mentions."""
  ping_ids = os.getenv("DISCORD_PING_IDS", "")
  return " ".join(f"<@{ping.strip()}>" for ping in ping_ids.split(",")
                  if ping.strip())


def send_webhook(rc: str) -> None:
  """Send a message to the Discord webhook."""
  text = f"||{get_pings()}|| New Firefox RC version is available: **{rc}**"
  webhook_url = os.getenv("DISCORD_WEBHOOK_URL")

  if webhook_url:
    message = {
        "content": text,
        "username": "Firefox RC Checker",
    }
    try:
      response = requests.post(webhook_url, json=message)
      response.raise_for_status()  # Raise an error for bad responses
    except requests.RequestException as e:
      print(f"Error sending webhook: {e}")
  else:
    print("Webhook URL not set.")


def main() -> int:
  current_version = get_current_version()
  rc_response = get_rc_response()

  if rc_response and rc_response != current_version:
    send_webhook(rc_response)
    return 0

  print(f"Current version: {current_version}, RC version: {rc_response}")
  return 1


if __name__ == "__main__":
  sys.exit(main())
