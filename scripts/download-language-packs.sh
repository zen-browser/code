#!/bin/bash
set -ex

# Define constants
CURRENT_DIR=$(pwd)
L10N_DIR="$CURRENT_DIR/l10n"
FIREFOX_L10N_REPO="https://github.com/mozilla-l10n/firefox-l10n"
LANGUAGES_FILE="$L10N_DIR/supported-languages"
TOOLS_DIR=~/tools
GIT_CINNABAR_DIR="$TOOLS_DIR/git-cinnabar"

# Configure git
git config --global init.defaultBranch main
git config --global fetch.prune true

# Clone the repository
mkdir -p "$L10N_DIR"
git clone "$FIREFOX_L10N_REPO" "$L10N_DIR/firefox-l10n"

update_language() {
  local langId=$1
  echo "Updating $langId"
  
  # Use rsync to move the contents, excluding the .git directory
  rsync -av --progress "$L10N_DIR/firefox-l10n/$langId/" "$L10N_DIR/$langId/" --exclude .git
}

# Ensure git-cinnabar is in the PATH
export PATH="$GIT_CINNABAR_DIR:$PATH"

# Update each language
while IFS= read -r lang; do
  update_language "$lang"
done < "$LANGUAGES_FILE"

# Move all the files to the correct location
for lang in $(cat "$LANGUAGES_FILE"); do
  sh scripts/copy-language-pack.sh "$lang"
done

wait

# Clean up
echo "Cleaning up"
rm -rf "$TOOLS_DIR"
rm -rf ~/.git-cinnabar

# Remove files that do not start with "zen"
while IFS= read -r lang; do
  find "$L10N_DIR/$lang" -type f -not -name "zen*" -delete
done < "$LANGUAGES_FILE"

rm -rf "$L10N_DIR/firefox-l10n"
