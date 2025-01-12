#!/bin/bash
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.
#
# This script signs a Firefox .app bundle and enables the macOS
# Hardened Runtime. It's designed for developers on macOS 10.14+ 
# who want to test Hardened Runtime manually. This is a temporary 
# solution until automated build tooling is available that signs 
# binaries with a certificate generated during builds (see bug 1522409).
#
# Note: Hardened Runtime is only available for applications running 
# on macOS 10.14 or later.


usage() {
  echo "Usage: $0 "
  echo "    -a <PATH-TO-BROWSER.app>"
  echo "    -i <IDENTITY>"
  echo "    -b <ENTITLEMENTS-FILE>"
  echo "    -p <CHILD-ENTITLEMENTS-FILE>"
  echo "    [-o <OUTPUT-DMG-FILE>]"
  exit 1
}


# Check for macOS version
SWVERS=/usr/bin/sw_vers
if [ ! -x "${SWVERS}" ]; then
    echo "ERROR: macOS 10.14 or later is required"
    exit 1
fi


# Ensure we are on macOS 10.14 or newer
OSVERSION=$(${SWVERS} -productVersion | awk -F '.' '{print $2}')
if [ "$OSVERSION" -lt 14 ]; then
    echo "ERROR: macOS 10.14 or later is required"
    exit 1
fi


# Parse command line arguments
while getopts "a:i:b:o:p:" opt; do
  case ${opt} in
    a ) BUNDLE=$OPTARG ;;
    i ) IDENTITY=$OPTARG ;;
    b ) BROWSER_ENTITLEMENTS_FILE=$OPTARG ;;
    p ) PLUGINCONTAINER_ENTITLEMENTS_FILE=$OPTARG ;;
    o ) OUTPUT_DMG_FILE=$OPTARG ;;
    \? ) usage ;;
  esac
done


# Validate required arguments
if [ -z "${BUNDLE}" ] || [ -z "${IDENTITY}" ] || 
   [ -z "${PLUGINCONTAINER_ENTITLEMENTS_FILE}" ] || 
   [ -z "${BROWSER_ENTITLEMENTS_FILE}" ]; then
    echo "ERROR: Mandatory arguments are missing."
    usage
fi


# Validate bundle and entitlements files
if [ ! -d "${BUNDLE}" ]; then
  echo "ERROR: Invalid bundle. Bundle should be a .app directory."
  exit 1
fi


if [ ! -e "${PLUGINCONTAINER_ENTITLEMENTS_FILE}" ] || 
   [ ! -e "${BROWSER_ENTITLEMENTS_FILE}" ]; then
  echo "ERROR: One or more entitlements files are invalid."
  exit 1
fi


# Check if output DMG file already exists
if [ -n "${OUTPUT_DMG_FILE}" ] && [ -e "${OUTPUT_DMG_FILE}" ]; then
  echo "ERROR: Output DMG file ${OUTPUT_DMG_FILE} already exists. Please delete it first."
  exit 1
fi


echo "-------------------------------------------------------------------------"
echo "Bundle:                              $BUNDLE"
echo "Identity:                            $IDENTITY"
echo "Browser Entitlements File:           $BROWSER_ENTITLEMENTS_FILE"
echo "Plugin-container Entitlements File:  $PLUGINCONTAINER_ENTITLEMENTS_FILE"
echo "Output DMG File (optional):          $OUTPUT_DMG_FILE"
echo "-------------------------------------------------------------------------"


set -x


# Clear extended attributes that can cause codesign to fail
xattr -cr "${BUNDLE}"


# Sign required binaries in specific order
codesign --force -o runtime --verbose --sign "$IDENTITY" \
"${BUNDLE}/Contents/Library/LaunchServices/org.mozilla.updater" \
"${BUNDLE}/Contents/MacOS/XUL" \
"${BUNDLE}/Contents/embedded.provisionprofile" \
"${BUNDLE}/Contents/MacOS/pingsender"


# Sign all dynamic libraries
find "${BUNDLE}/Contents/MacOS" -type f -name "*.dylib" -exec \
codesign --force --verbose --sign "$IDENTITY" {} \;


# Validate signed libraries
find "${BUNDLE}/Contents/MacOS" -type f -name "*.dylib" -exec \
codesign -vvv --strict --deep --verbose {} \;


# Sign the updater application
codesign --force -o runtime --verbose --sign "$IDENTITY" --deep \
"${BUNDLE}/Contents/MacOS/updater.app"


# Sign the main Zen executable
codesign --force -o runtime --verbose --sign "$IDENTITY" --deep \
--entitlements "${BROWSER_ENTITLEMENTS_FILE}" \
"${BUNDLE}/Contents/MacOS/zen"


# Sign the Library/LaunchServices
codesign --force -o runtime --verbose --sign "$IDENTITY" --deep \
"${BUNDLE}/Contents/Library/LaunchServices/org.mozilla.updater"


# Sign gmp-clearkey files
find "${BUNDLE}/Contents/Resources/gmp-clearkey" -type f -exec \
codesign --force -o runtime --verbose --sign "$IDENTITY" {} \;


# Sign the main bundle
codesign --force -o runtime --verbose --sign "$IDENTITY" \
--entitlements "${BROWSER_ENTITLEMENTS_FILE}" "${BUNDLE}"


# Sign the plugin-container bundle with deep signing
codesign --force -o runtime --verbose --sign "$IDENTITY" --deep \
--entitlements "${PLUGINCONTAINER_ENTITLEMENTS_FILE}" \
"${BUNDLE}/Contents/MacOS/plugin-container.app"


# Validate the final signing
codesign -vvv --deep --strict "${BUNDLE}"


# Create a DMG if requested
if [ -n "${OUTPUT_DMG_FILE}" ]; then
  DISK_IMAGE_DIR=$(mktemp -d)
  TEMP_FILE=$(mktemp)
  TEMP_DMG="${TEMP_FILE}.dmg"
  NAME=$(basename "${BUNDLE}")


  ditto "${BUNDLE}" "${DISK_IMAGE_DIR}/${NAME}"
  hdiutil create -size 400m -fs HFS+ \
    -volname Firefox -srcfolder "${DISK_IMAGE_DIR}" "${TEMP_DMG}"
  hdiutil convert -format UDZO \
    -o "${OUTPUT_DMG_FILE}" "${TEMP_DMG}"


  # Clean up temporary files
  rm -f "${TEMP_FILE}" "${TEMP_DMG}"
  rm -rf "${DISK_IMAGE_DIR}"
fi

