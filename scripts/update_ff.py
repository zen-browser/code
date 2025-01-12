import os
import json


def update_ff():
  """Runs the npm command to update the 'ff' component."""
  result = os.system("npm run update-ff:raw")
  if result != 0:
    raise RuntimeError("Failed to update 'ff' component.")


def get_version_from_file(filename):
  """Retrieves the version from the specified JSON file."""
  try:
    with open(filename, "r") as f:
      data = json.load(f)
      return data["version"]["version"]
  except (FileNotFoundError, json.JSONDecodeError) as e:
    raise RuntimeError(f"Error reading version from {filename}: {e}")


def update_readme(last_version, new_version):
  """Updates the README.md file to reflect the new version."""
  try:
    with open("README.md", "r") as f:
      data = f.read()
      updated_data = data.replace(last_version, new_version)

    with open("README.md", "w") as f:
      f.write(updated_data)
  except FileNotFoundError as e:
    raise RuntimeError(f"README.md file not found: {e}")


def main():
  """Main function to update versions and README."""
  try:
    last_version = get_version_from_file("surfer.json")
    update_ff()
    new_version = get_version_from_file("surfer.json")
    update_readme(last_version, new_version)
    print(
        f"Updated version from {last_version} to {new_version} in README.md.")
  except Exception as e:
    print(f"An error occurred: {e}")


if __name__ == "__main__":
  main()
