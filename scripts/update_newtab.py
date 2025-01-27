import os
import subprocess
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)

# Constants for paths
NEW_TAB_DIR = "./engine/browser/components/newtab"
ENGINE_DIR = "./engine"
NPM_INSTALL_COMMANDS = ["npm install", "npm install meow@9.0.0"]
BUNDLE_COMMAND = "npm run bundle --prefix=browser/components/newtab"


def install_dependencies():
  """Install necessary npm packages for the newtab component."""
  for command in NPM_INSTALL_COMMANDS:
    logging.info(f"Running command: {command} in {NEW_TAB_DIR}")
    subprocess.run(command.split(), cwd=NEW_TAB_DIR, check=True)


def bundle_newtab_components():
  """Bundle the newtab components."""
  logging.info(f"Bundling newtab components in {ENGINE_DIR}")
  subprocess.run(BUNDLE_COMMAND.split(), cwd=ENGINE_DIR, check=True)


def update_newtab(init: bool = True):
  """Update the newtab components, optionally initializing dependencies."""
  try:
    if init:
      install_dependencies()

    bundle_newtab_components()
  except subprocess.CalledProcessError as e:
    logging.error(f"An error occurred: {e}")
    raise


if __name__ == "__main__":
  update_newtab(init=False)
