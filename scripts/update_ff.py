import os
import json

last_version = "0.0.0"
new_version = "0.0.0"

def update_ff():
  """Runs the npm command to update the 'ff' component."""
  os.system("npm run update-ff:raw")

def get_version_from_file(filename):
  """Retrieves the version from the specified JSON file."""
  with open(filename, "r") as f:
    data = json.load(f)
    return data["version"]["version"]

def update_readme(last_version, new_version):
  """Updates the README.md file to reflect the new version."""
  with open("README.md", "r") as f:
    data = f.read()
    updated_data = data.replace(last_version, new_version)

  with open("README.md", "w") as f:
    f.write(updated_data)

if __name__ == "__main__":
  last_version = get_version_from_file("surfer.json")
  update_ff()
  new_version = get_version_from_file("surfer.json")
  update_readme(last_version, new_version)
