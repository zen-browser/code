import os
import json
import argparse
import shutil

from check_rc_response import get_rc_response, rc_should_be_updated


def update_rc(last_version: str):
  rc_version = get_rc_response()
  if rc_should_be_updated(rc_version, last_version):
    print(f"New Firefox RC version is available: {rc_version}")
    print("Removing engine directory and updating surfer.json.")
    if os.path.exists("engine"):
      shutil.rmtree("engine")
    with open("surfer.json", "r") as f:
      data = json.load(f)
    with open("surfer.json", "w") as f:
      data["version"]["candidate"] = rc_version
      json.dump(data, f, indent=2)
    print("Download the new engine by running 'pnpm download'.")
    os.system("pnpm download")
  else:
    print("No new Firefox RC version available.")


def update_ff(is_rc: bool = False, last_version: str = ""):
  """Runs the npm command to update the 'ff' component."""
  if is_rc:
    return update_rc(last_version)
  result = os.system("pnpm update-ff:raw")
  if result != 0:
    raise RuntimeError("Failed to update 'ff' component.")


def get_version_from_file(filename, is_rc):
  """Retrieves the version from the specified JSON file."""
  try:
    with open(filename, "r") as f:
      data = json.load(f)
      return data["version"]["version"] if not is_rc else data["version"]["candidate"]
  except (FileNotFoundError, json.JSONDecodeError) as e:
    raise RuntimeError(f"Error reading version from {filename}: {e}")


def update_readme(last_version, new_version, is_rc=False):
  """Updates the README.md file to reflect the new version."""
  prefix = "RC " if is_rc else "`"
  try:
    with open("README.md", "r") as f:
      data = f.read()
      updated_data = data.replace(prefix + last_version, prefix + new_version)

    with open("README.md", "w") as f:
      f.write(updated_data)
  except FileNotFoundError as e:
    raise RuntimeError(f"README.md file not found: {e}")


def main():
  """Main function to update versions and README."""

  arg_parser = argparse.ArgumentParser()
  arg_parser.add_argument(
      "--rc", help="Indicates that this is a release candidate.", default=False, action="store_true")
  args = arg_parser.parse_args()

  try:
    last_version = get_version_from_file("surfer.json", args.rc)
    update_ff(args.rc, last_version)
    new_version = get_version_from_file("surfer.json", args.rc)
    update_readme(last_version, new_version, args.rc)
    print(
        f"Updated version from {last_version} to {new_version} in README.md.")
  except Exception as e:
    print(f"An error occurred: {e}")


if __name__ == "__main__":
  main()
