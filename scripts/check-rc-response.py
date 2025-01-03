import json
import sys
import os
import requests

RESPONSE = 'rc-response.json'
METADATA = 'surfer.json'

def get_current_version():
    try:
        with open(METADATA) as f:
            metadata = json.load(f)
            return metadata['version']['candidate']
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error reading {METADATA}: {e}")
        return None

def get_rc_response():
    try:
        with open(RESPONSE) as f:
            data = json.load(f)
            for tag_dict in data['tags']:
                tag = tag_dict['tag']
                is_valid_tag = (
                    tag.startswith('FIREFOX') and 
                    tag.endswith('_BUILD1') and 
                    'ESR' not in tag and 
                    'b' not in tag
                )
                if is_valid_tag:
                    return tag.replace('FIREFOX_', '').replace('_BUILD1', '').replace('_', '.')
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error reading {RESPONSE}: {e}")
    return None

def get_pings():
    pings = ""
    ping_ids = os.getenv('DISCORD_PING_IDS')
    if ping_ids:
        for ping in ping_ids.split(','):
            pings += f"<@{ping}> "
    return pings.strip()

def send_webhook(rc: str):
    text = f"||{get_pings()}|| New Firefox RC version is available: **{rc}**"
    webhook_url = os.getenv('DISCORD_WEBHOOK_URL')
    
    if not webhook_url:
        print("DISCORD_WEBHOOK_URL environment variable is not set.")
        return

    message = {
        "content": text,
        "username": "Firefox RC Checker",
        "avatar_url": "https://avatars.githubusercontent.com/u/189789277?v=4",
    }
    
    try:
        response = requests.post(webhook_url, json=message)
        if response.status_code == 204:
            print("Message sent successfully!")
        else:
            print(f"Failed to send message: {response.status_code}")
    except requests.RequestException as e:
        print(f"Error sending webhook: {e}")

def update_current_version(new_version):
    try:
        with open(METADATA, 'r+') as f:
            metadata = json.load(f)
            metadata['version']['candidate'] = new_version
            f.seek(0)
            json.dump(metadata, f, indent=2)
            f.truncate()
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error updating {METADATA}: {e}")

def main():
    current = get_current_version()
    if current is None:
        print('Could not find current version')
        return 1

    rc = get_rc_response()
    if rc is None:
        print('Could not find RC version')
        return 1

    if current != rc:
        print(f'Current version is {current}, but RC version is {rc}')
        update_current_version(rc)  # Update the current version
        send_webhook(rc)
        return 0

    print(f'Current version is {current}, and RC version is {rc}')
    return 1

if __name__ == '__main__':
    sys.exit(main())
