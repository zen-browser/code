#!/bin/bash

# Function to display usage
usage() {
	echo "Usage: $0 <language-code>"
	echo "Example: $0 en-US"
	exit 1
}

# Check if language code is provided
if [ -z "$1" ]; then
	usage
fi

LANGUAGE_CODE="$1"

# Execute the copy-language-pack script and capture output
echo "Copying language pack for: $LANGUAGE_CODE"

if sh ./scripts/copy-language-pack.sh "$LANGUAGE_CODE"; then
	echo "Successfully copied language pack for: $LANGUAGE_CODE"
else
	echo "Error: Failed to copy language pack for: $LANGUAGE_CODE" >&2
	exit 1
fi
