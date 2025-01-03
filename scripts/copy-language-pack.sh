#!/bin/bash

# Constants
BROWSER_LOCALES="engine/browser/locales"
L10N_DIR="./l10n"
SUPPORTED_LANGS=("en-US" "fr" "de" "es") # Add any other supported languages

copy_browser_locales() {
  local langId="$1"
  mkdir -p "$BROWSER_LOCALES/$langId" || { echo "Error: Failed to create directory $BROWSER_LOCALES/$langId"; exit 1; }
  
  if [ "$langId" = "en-US" ]; then
    # Remove specific files for en-US
    find "$BROWSER_LOCALES/$langId" -type f -name "zen*" -delete || { echo "Error: Failed to delete zen files in $BROWSER_LOCALES/$langId"; exit 1; }
    rsync -av --exclude=.git "$L10N_DIR/en-US/browser/" "$BROWSER_LOCALES/$langId/" || { echo "Error: rsync failed for en-US"; exit 1; }
    return
  fi
  
  rm -rf "$BROWSER_LOCALES/$langId/" || { echo "Error: Failed to remove existing directory $BROWSER_LOCALES/$langId"; exit 1; }

  # Copy the rest of the l10n directories to their respective locations
  rsync -av --exclude=.git "$L10N_DIR/$langId/" "$BROWSER_LOCALES/$langId/" || { echo "Error: rsync failed for $langId"; exit 1; }
}

# Check if a language was specified
if [ -z "$1" ]; then
  echo "Error: No language specified."
  exit 1
fi

LANG="$1"

# Validate input language against supported languages
if [[ ! " ${SUPPORTED_LANGS[@]} " =~ " $LANG " ]]; then
  echo "Error: Unsupported language '$LANG'. Supported languages are: ${SUPPORTED_LANGS[*]}"
  exit 1
fi

echo "Copying language pack for $LANG"
copy_browser_locales "$LANG"
