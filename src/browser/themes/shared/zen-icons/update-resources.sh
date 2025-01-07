# note: you need to be in the same directory as the script to run it

if [ $(basename $PWD) != "zen-icons" ]; then
  echo "You need to be in the zen-icons directory to run this script"
  exit 1
fi

echo "" > jar.inc.mn

for filename in *; do
  echo "Working on $filename"
  echo "  skin/classic/browser/zen-icons/$filename                      (../shared/zen-icons/$filename) " >> jar.inc.mn
done

echo "Done!"
