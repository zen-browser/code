#!/bin/bash

printSeparationLine() {
    str=${1:=}
    num=${2:-80}
    counter=1
    output=""
    while [ $counter -le "$num" ]; do
        output="${output}${str}"
        counter=$((counter+1))
    done
    echo "${output}"
}

getAvailableSpace() { 
    echo $(df -a $1 | awk 'NR > 1 {avail+=$4} END {print avail}') 
}

formatByteCount() { 
    echo $(numfmt --to=iec-i --suffix=B --padding=7 $1'000') 
}

printSavedSpace() {
    saved=${1}
    title=${2:-}

    echo ""
    printSeparationLine '*' 80
    if [ -n "${title}" ]; then
        echo "=> ${title}: Saved $(formatByteCount "$saved")"
    else
        echo "=> Saved $(formatByteCount "$saved")"
    fi
    printSeparationLine '*' 80
    echo ""
}

printDH() {
    caption=${1:-}

    printSeparationLine '=' 80
    echo "${caption}"
    echo ""
    echo "$ df -h /"
    echo ""
    df -h /
    echo "$ df -a /"
    echo ""
    df -a /
    echo "$ df -a"
    echo ""
    df -a
    printSeparationLine '=' 80
}

AVAILABLE_INITIAL=$(getAvailableSpace)
AVAILABLE_ROOT_INITIAL=$(getAvailableSpace '/')

printDH "Before clean-up:"
echo ""

BEFORE=$(getAvailableSpace)

sudo rm -rf "$AGENT_TOOLSDIRECTORY" || true

AFTER=$(getAvailableSpace)
SAVED=$((AFTER-BEFORE))
printSavedSpace $SAVED "Agent tools"

BEFORE=$(getAvailableSpace)
sudo rm -rf /usr/local/share/powershell || true
AFTER=$(getAvailableSpace)
SAVED=$((AFTER-BEFORE))
printSavedSpace $SAVED "Powershell"

BEFORE=$(getAvailableSpace)
sudo rm -rf /usr/local/share/chromium || true
AFTER=$(getAvailableSpace)
SAVED=$((AFTER-BEFORE))
printSavedSpace $SAVED "Chromium"

BEFORE=$(getAvailableSpace)
sudo rm -rf /usr/local/lib/node_modules || true
AFTER=$(getAvailableSpace)
SAVED=$((AFTER-BEFORE))
printSavedSpace $SAVED "Node modules"

BEFORE=$(getAvailableSpace)
sudo rm -rf /usr/share/swift || true
AFTER=$(getAvailableSpace)
SAVED=$((AFTER-BEFORE))
printSavedSpace $SAVED "Swift"

BEFORE=$(getAvailableSpace)
sudo rm -rf /usr/local/lib/android || true
AFTER=$(getAvailableSpace)
SAVED=$((AFTER-BEFORE))
printSavedSpace $SAVED "Android library"

BEFORE=$(getAvailableSpace)
sudo rm -rf /usr/share/dotnet || true
AFTER=$(getAvailableSpace)
SAVED=$((AFTER-BEFORE))
printSavedSpace $SAVED ".NET runtime"

BEFORE=$(getAvailableSpace)
sudo rm -rf /opt/ghc || true
sudo rm -rf /usr/local/.ghcup || true
AFTER=$(getAvailableSpace)
SAVED=$((AFTER-BEFORE))
printSavedSpace $SAVED "Haskell runtime"

BEFORE=$(getAvailableSpace)

sudo apt-get remove -y '^aspnetcore-.*' || echo "::warning::The command [sudo apt-get remove -y '^aspnetcore-.*'] failed."
sudo apt-get remove -y '^dotnet-.*' --fix-missing || echo "::warning::The command [sudo apt-get remove -y '^dotnet-.*' --fix-missing] failed."
sudo apt-get remove -y '^llvm-.*' --fix-missing || echo "::warning::The command [sudo apt-get remove -y '^llvm-.*' --fix-missing] failed."
sudo apt-get remove -y 'php.*' --fix-missing || echo "::warning::The command [sudo apt-get remove -y 'php.*' --fix-missing] failed."
sudo apt-get remove -y '^mongodb-.*' --fix-missing || echo "::warning::The command [sudo apt-get remove -y '^mongodb-.*' --fix-missing] failed."
sudo apt-get remove -y '^mysql-.*' --fix-missing || echo "::warning::The command [sudo apt-get remove -y '^mysql-.*' --fix-missing] failed."
sudo apt-get remove -y azure-cli --fix-missing || echo "::warning::The command [sudo apt-get remove -y azure-cli --fix-missing] failed."
sudo apt-get remove -y google-cloud-sdk --fix-missing || echo "::warning::The command [sudo apt-get remove -y google-chrome-stable --fix-missing] failed."
sudo apt-get remove -y firefox --fix-missing || echo "::warning::The command [sudo apt-get remove -y firefox --fix-missing] failed."
sudo apt-get remove -y powershell --fix-missing || echo "::warning::The command [sudo apt-get remove -y powershell --fix-missing] failed."
sudo apt-get remove -y mono-devel --fix-missing || echo "::warning::The command [sudo apt-get remove -y mono-devel --fix-missing] failed."
sudo apt-get remove -y libgl1-mesa-dri --fix-missing || echo "::warning::The command [sudo apt-get remove -y libgl1-mesa-dri --fix-missing] failed."
sudo apt-get remove -y google-cloud-sdk --fix-missing || echo "::debug::The command [sudo apt-get remove -y google-cloud-sdk --fix-missing] failed."
sudo apt-get remove -y google-cloud-cli --fix-missing || echo "::debug::The command [sudo apt-get remove -y google-cloud-cli --fix-missing] failed."
sudo apt-get remove -y microsoft-edge-stable --fix-missing || echo "::debug::The command [sudo apt-get remove -y microsoft-edge-stable --fix-missing] failed."
sudo apt-get remove -y snapd --fix-missing || echo "::debug::The command [sudo apt-get remove -y snapd --fix-missing] failed."
sudo apt-get autoremove -y || echo "::warning::The command [sudo apt-get autoremove -y] failed."
sudo apt-get clean || echo "::warning::The command [sudo apt-get clean] failed."

AFTER=$(getAvailableSpace)
SAVED=$((AFTER-BEFORE))
printSavedSpace $SAVED "Large misc. packages"

BEFORE=$(getAvailableSpace)
sudo docker image prune --all --force || true
AFTER=$(getAvailableSpace)
SAVED=$((AFTER-BEFORE))
printSavedSpace $SAVED "Docker images"

BEFORE=$(getAvailableSpace)
sudo rm -rf "$AGENT_TOOLSDIRECTORY" || true
AFTER=$(getAvailableSpace)
SAVED=$((AFTER-BEFORE))
printSavedSpace $SAVED "Tool cache"

BEFORE=$(getAvailableSpace)
sudo swapoff -a || true
sudo rm -rf /mnt/swapfile || true
free -h
AFTER=$(getAvailableSpace)
SAVED=$((AFTER-BEFORE))
printSavedSpace $SAVED "Swap storage"

AVAILABLE_END=$(getAvailableSpace)
AVAILABLE_ROOT_END=$(getAvailableSpace '/')

echo ""
printDH "After clean-up:"

echo ""
echo "/dev/root:"
printSavedSpace $((AVAILABLE_ROOT_END - AVAILABLE_ROOT_INITIAL))
echo "Overall:"
printSavedSpace $((AVAILABLE_END - AVAILABLE_INITIAL))
