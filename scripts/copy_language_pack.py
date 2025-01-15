import os
import shutil
import sys

# Define the path for browser locales
BROWSER_LOCALES = "engine/browser/locales"


def copy_browser_locales(lang_id: str):
  """
  Copies language pack files to the specified browser locale directory.

  :param lang_id: Language identifier (e.g., 'en-US', 'fr', etc.)
  """
  lang_path = os.path.join(BROWSER_LOCALES, lang_id)

  # Create the directory for the language pack if it doesn't exist
  os.makedirs(lang_path, exist_ok=True)
  print(f"Creating directory: {lang_path}")

  # If the language is 'en-US', handle special processing
  if lang_id == "en-US":
    # Remove files starting with "zen" in the 'en-US' directory
    for root, _, files in os.walk(lang_path):
      for file in files:
        if file.startswith("zen"):
          os.remove(os.path.join(root, file))

    # Copy files from the source directory
    source_path = "./l10n/en-US/browser/"
    copy_files(source_path, lang_path)
    return

  # For other languages, delete the existing directory and copy files anew
  if os.path.exists(lang_path):
    shutil.rmtree(lang_path)  # Remove existing directory

  source_path = f"./l10n/{lang_id}/"
  copy_files(source_path, lang_path)


def copy_files(source: str, destination: str):
  """
  Copies files and directories from the source to the destination.

  :param source: Source directory path
  :param destination: Destination directory path
  """
  if not os.path.exists(source):
    raise FileNotFoundError(f"Source path '{source}' does not exist.")

  # Recursively copy all files and directories
  for root, dirs, files in os.walk(source):
    # Determine relative path to preserve directory structure
    relative_path = os.path.relpath(root, source)
    destination_root = os.path.join(destination, relative_path)
    os.makedirs(destination_root, exist_ok=True)

    # Copy files
    for file in files:
      src_file = os.path.join(root, file)
      dest_file = os.path.join(destination_root, file)
      print(f"\tCopying {src_file} to {dest_file}")
      shutil.copy2(src_file, dest_file)  # Copy file with metadata


if __name__ == "__main__":
  if len(sys.argv) != 2:
    print("Usage: python script.py <LANG>")
    sys.exit(1)

  lang = sys.argv[1]
  print(f"Copying language pack for {lang}")
  try:
    copy_browser_locales(lang)
  except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
