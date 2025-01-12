browser_locales=engine/browser/locales

copy_browser_locales() {
  langId=$1
  mkdir -p $browser_locales/$langId
  if [ "$langId" = "en-US" ]; then
    find $browser_locales/$langId -type f -name "zen*" -delete
    rsync -av --exclude=.git ./l10n/en-US/browser/ $browser_locales/$langId/
    return
  fi
  rm -rf $browser_locales/$langId/
  # TODO: Copy the rest of the l10n directories to their respective locations
  rsync -av --exclude=.git ./l10n/$langId/ $browser_locales/$langId/
}

LANG=$1
echo "Copying language pack for $LANG"
copy_browser_locales $LANG
