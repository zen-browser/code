import json
import sys
import os
import requests

RESPONSE = 'rc-response.json'
METADATA = 'surfer.json'

def get_current_version():
  with open(METADATA) as f:
    metadata = json.load(f)
    return metadata['version']['candidate']

def get_rc_response():
  with open(RESPONSE) as f:
    data = json.load(f)
    for tag_dict in data['tags']:
      tag = tag_dict['tag']
      is_valid_tag = (tag.startswith('FIREFOX') and tag.endswith('_BUILD1')
                        and not 'ESR' in tag and not 'b' in tag)
      if is_valid_tag:
        return tag.replace('FIREFOX_', '').replace('_BUILD1', '').replace('_', '.')
  return None

def get_pings():
  pings = ""
  for ping in os.getenv('DISCORD_PING_IDS').split(','):
    pings += "<@%s> " % ping
  return pings

def send_webhook(rc: str):
  text = "||%s|| New Firefox RC version is available: **%s**" % (get_pings(), rc)
  webhook_url = os.getenv('DISCORD_WEBHOOK_URL') #os.getenv('DISCORD_WEBHOOK_URL')
  message = {
    "content": text,
    "username": "Firefox RC Checker",
    "avatar_url": "https://avatars.githubusercontent.com/u/189789277?v=4",
  }
  response = requests.post(webhook_url, json=message)
  if response.status_code == 204:
      print("Message sent successfully!")
  else:
      print(f"Failed to send message: {response.status_code}")

def main():
  current = get_current_version()
  if not current:
    print('Could not find current version')
    return 1
  rc = get_rc_response()
  if not rc:
    print('Could not find RC version')
    return 1
  if current != rc:
    print('Current version is %s, but RC version is %s' % (current, rc))
    # Here, we should update the current version in surfer.json
    send_webhook(rc)
    return 0
  print('Current version is %s, and RC version is %s' % (current, rc))
  return 1

if __name__ == '__main__':
  sys.exit(main())
