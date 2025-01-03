set -ex

CURRENT_DIR=$(pwd)

# Configure Git settings
git config --global init.defaultBranch main
git config --global fetch.prune true

# Clone the Firefox localization repository
cd "$CURRENT_DIR/l10n"
git clone https://github.com/mozilla-l10n/firefox-l10n

# Function to update language files
update_language() {
  langId=$1
  cd "$CURRENT_DIR/l10n/$langId"

  echo "Updating $langId"
  
  # Move the contents from ../firefox-l10n/$langId to ./l10n/$langId
  rsync -av --progress "../firefox-l10n/$langId/" . --exclude .git
}

# Set PATH for git-cinnabar
export PATH=~/tools/git-cinnabar:$PATH

# Update all supported languages
while read -r lang; do
  update_language "$lang"
done < ./l10n/supported-languages

# Move all the files to the correct location
sh scripts/copy-language-pack.sh en-US
while read -r lang; do
  sh scripts/copy-language-pack.sh "$lang"
done < ./l10n/supported-languages

wait

# Clean up temporary files
echo "Cleaning up"
rm -rf ~/tools
rm -rf ~/.git-cinnabar

# Remove files that do not start with "zen"
while read -r lang; do
  find "./l10n/$lang" -type f -not -name "zen*" -delete
done < ./l10n/supported-languages

# Remove the cloned repository
rm -rf ./l10n/firefox-l10n
