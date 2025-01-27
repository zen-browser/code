set -ex

CURRENT_DIR=$(pwd)

git config --global init.defaultBranch main
git config --global fetch.prune true

cd $CURRENT_DIR

cd ./l10n
git clone https://github.com/mozilla-l10n/firefox-l10n
cd $CURRENT_DIR

update_language() {
  langId=$1
  cd ./l10n
  cd $langId

  echo "Updating $langId"
  # move the contents from ../firefox-l10n/$langId to ./l10n/$langId
  rsync -av --progress ../firefox-l10n/$langId/ . --exclude .git

  cd $CURRENT_DIR
}

export PATH=~/tools/git-cinnabar:$PATH
for lang in $(cat ./l10n/supported-languages); do
  update_language $lang
done
cd $CURRENT_DIR

# Move all the files to the correct location

python3 scripts/copy_language_pack.py en-US
for lang in $(cat ./l10n/supported-languages); do
  python3 scripts/copy_language_pack.py $lang
done

wait

echo "Cleaning up"
rm -rf ~/tools
rm -rf ~/.git-cinnabar

for lang in $(cat ./l10n/supported-languages); do
  # remove every file except if it starts with "zen"
  find ./l10n/$lang -type f -not -name "zen*" -delete
done

rm -rf ./l10n/firefox-l10n
