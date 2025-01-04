#!/bin/bash

set -euo pipefail  # Exit immediately if a command exits with a non-zero status, treat unset variables as errors, and fail on pipe errors.

CURRENT_DIR=$(pwd)

# Configure Git settings
git config --global init.defaultBranch main
git config --global fetch.prune true

# Clone the Firefox localization repository
L10N_DIR="$CURRENT_DIR/l10n"
FIREFOX_L10N_REPO="https://github.com/mozilla-l10n/firefox-l10n"

mkdir -p "$L10N_DIR"  # Ensure the l10n directory exists
cd "$L10N_DIR"

if [ ! -d "firefox-l10n" ]; then
  git clone "$FIREFOX_L10N_REPO"
else
  echo "The repository 'firefox-l10n' already exists. Pulling the latest changes."
  cd firefox-l10n
  git pull origin main
  cd ..
fi

# Function to update language files
update_language() {
  langId=$1
  LANG_DIR="$L10N_DIR/$langId"

  echo "Updating $langId..."

  # Check if the language directory exists
  if [ -d "../firefox-l10n/$langId" ]; then
    rsync -av --progress "../firefox-l10n/$langId/" "$LANG_DIR/" --exclude .git
  else
    echo "Warning: Language directory '$langId' does not exist in the repository."
  fi
}

# Set PATH for git-cinnabar
export PATH=~/tools/git-cinnabar:$PATH

# Update all supported languages
if [[ -f "$L10N_DIR/l10n/supported-languages" ]]; then
  while read -r lang; do
    update_language "$lang"
  done < "$L10N_DIR/l10n/supported-languages"
else
  echo "Error: 'supported-languages' file not found."
  exit 1
fi

# Move all the files to the correct location
sh scripts/copy-language-pack.sh en-US

while read -r lang; do
  sh scripts/copy-language-pack.sh "$lang"
done < "$L10N_DIR/l10n/supported-languages"
