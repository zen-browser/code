#!/bin/bash
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.
#
# Runs codesign commands to codesign a Firefox .app bundle and enable macOS
# Hardened Runtime. Intended to be manually run by developers working on macOS
# 10.14+ who want to enable Hardened Runtime for manual testing. This is
# provided as a stop-gap until automated build tooling is available that signs
# binaries with a certificate generated during builds (bug 1522409). This
# script requires macOS 10.14 because Hardened Runtime is only available for
# applications running on 10.14 despite support for the codesign "-o runtime"
# option being available in 10.13.6 and newer.
#
# The script requires an identity string (-i option) from an Apple Developer
# ID certificate. This can be found in the macOS KeyChain after configuring an
# Apple Developer ID certificate.
#
# Example usage on macOS 10.14:
#
#   $ ./mach build
#   $ ./mach build package
#   $ open </PATH/TO/DMG/FILE.dmg>
#   <Drag Nightly.app to ~>
#   $ ./security/mac/hardenedruntime/codesign.bash \
#         -a ~/Nightly.app \
#         -i <MY-IDENTITY-STRING> \
#         -b security/mac/hardenedruntime/browser.developer.entitlements.xml
#         -p security/mac/hardenedruntime/plugin-container.developer.entitlements.xml
#   $ open ~/Nightly.app
#

usage ()
{
  echo  "Usage: $0 "
  echo  "    -a <PATH-TO-BROWSER.app>"
  echo  "    -i <IDENTITY>"
  echo  "    -b <ENTITLEMENTS-FILE>"
  echo  "    -p <CHILD-ENTITLEMENTS-FILE>"
  echo  "    [-o <OUTPUT-DMG-FILE>]"
  exit -1
}

# Make sure we are running on macOS with the sw_vers command available.
SWVERS=/usr/bin/sw_vers
if [ ! -x ${SWVERS} ]; then
    echo "ERROR: macOS 10.14 or later is required"
    exit -1
fi

# Require macOS 10.14 or newer.
#OSVERSION=`${SWVERS} -productVersion|sed -En 's/[0-9]+\.([0-9]+)\.[0-9]+/\1/p'`;
#if [ ${OSVERSION} \< 14 ]; then
#    echo "ERROR: macOS 10.14 or later is required"
#    exit -1
#fi

while getopts "a:i:b:o:p:" opt; do
  case ${opt} in
    a ) BUNDLE=$OPTARG ;;
    i ) IDENTITY=$OPTARG ;;
    b ) BROWSER_ENTITLEMENTS_FILE=$OPTARG ;;
    p ) PLUGINCONTAINER_ENTITLEMENTS_FILE=$OPTARG ;;
    o ) OUTPUT_DMG_FILE=$OPTARG ;;
    \? ) usage; exit -1 ;;
  esac
done

if [ -z "${BUNDLE}" ] ||
   [ -z "${IDENTITY}" ] ||
   [ -z "${PLUGINCONTAINER_ENTITLEMENTS_FILE}" ] ||
   [ -z "${BROWSER_ENTITLEMENTS_FILE}" ]; then
    usage
    exit -1
fi

if [ ! -d "${BUNDLE}" ]; then
  echo "Invalid bundle. Bundle should be a .app directory"
  usage
  exit -1
fi

if [ ! -e "${PLUGINCONTAINER_ENTITLEMENTS_FILE}" ]; then
  echo "Invalid entitlements file"
  usage
  exit -1
fi

if [ ! -e "${BROWSER_ENTITLEMENTS_FILE}" ]; then
  echo "Invalid entitlements file"
  usage
  exit -1
fi

# DMG file output flag is optional
if [ ! -z "${OUTPUT_DMG_FILE}" ] &&
   [ -e "${OUTPUT_DMG_FILE}" ]; then
  echo "Output dmg file ${OUTPUT_DMG_FILE} exists. Please delete it first."
  usage
  exit -1
fi

echo "-------------------------------------------------------------------------"
echo "bundle:                              $BUNDLE"
echo "identity:                            $IDENTITY"
echo "browser entitlements file:           $BROWSER_ENTITLEMENTS_FILE"
echo "plugin-container entitlements file:  $PLUGINCONTAINER_ENTITLEMENTS_FILE"
echo "output dmg file (optional):          $OUTPUT_DMG_FILE"
echo "-------------------------------------------------------------------------"

set -x

# move Zen_Browser.provisionprofile to the Contents directory
#cp Zen_Browser.provisionprofile "${BUNDLE}"/Contents/embedded.provisionprofile

# Clear extended attributes which cause codesign to fail
xattr -cr "${BUNDLE}"

# Sign these binaries first. Signing of some binaries has an ordering
# requirement where other binaries must be signed first.
codesign --force -o runtime --verbose --sign "$IDENTITY" \
"${BUNDLE}/Contents/Library/LaunchServices/org.mozilla.updater" \
"${BUNDLE}/Contents/MacOS/XUL" \
"${BUNDLE}"/Contents/embedded.provisionprofile \
"${BUNDLE}/Contents/MacOS/pingsender"

# Sign every ${BUNDLE}/Contents/MacOS/*.dylib
find "${BUNDLE}"/Contents/MacOS -type f -name "*.dylib" -exec \
codesign --force --verbose --sign "$IDENTITY" {} \;

find "${BUNDLE}"/Contents/MacOS -type f -name "*.dylib" -exec \
codesign -vvv --strict --deep --verbose {} \;

codesign --force -o runtime --verbose --sign "$IDENTITY" --deep \
"${BUNDLE}"/Contents/MacOS/updater.app

# Sign zen main executable
codesign --force -o runtime --verbose --sign "$IDENTITY" --deep \
--entitlements ${BROWSER_ENTITLEMENTS_FILE} \
"${BUNDLE}"/Contents/MacOS/zen

# Sign Library/LaunchServices
codesign --force -o runtime --verbose --sign "$IDENTITY" --deep \
"${BUNDLE}"/Contents/Library/LaunchServices/org.mozilla.updater

# Sign gmp-clearkey files
find "${BUNDLE}"/Contents/Resources/gmp-clearkey -type f -exec \
codesign --force -o runtime --verbose --sign "$IDENTITY" {} \;

# Sign the main bundle
codesign --force -o runtime --verbose --sign "$IDENTITY" \
--entitlements ${BROWSER_ENTITLEMENTS_FILE} "${BUNDLE}"

# Sign the plugin-container bundle with deep
codesign --force -o runtime --verbose --sign "$IDENTITY" --deep \
--entitlements ${PLUGINCONTAINER_ENTITLEMENTS_FILE} \
"${BUNDLE}"/Contents/MacOS/plugin-container.app

# Validate
codesign -vvv --deep --strict "${BUNDLE}"

# Create a DMG
if [ ! -z "${OUTPUT_DMG_FILE}" ]; then
  DISK_IMAGE_DIR=`mktemp -d`
  TEMP_FILE=`mktemp`
  TEMP_DMG=${TEMP_FILE}.dmg
  NAME=`basename "${BUNDLE}"`

  ditto "${BUNDLE}" "${DISK_IMAGE_DIR}/${NAME}"
  hdiutil create -size 400m -fs HFS+ \
    -volname Firefox -srcfolder "${DISK_IMAGE_DIR}" "${TEMP_DMG}"
  hdiutil convert -format UDZO \
    -o "${OUTPUT_DMG_FILE}" "${TEMP_DMG}"

  rm ${TEMP_FILE}
  rm ${TEMP_DMG}
  rm -rf "${DISK_IMAGE_DIR}"
fi
