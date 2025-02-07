#!/bin/bash
set -euo pipefail

isX86() {
    local arch
    arch=$(uname -m)
    if [ "$arch" = "x86_64" ]; then
        return 0
    else
        return 1
    fi
}

printSeparationLine() {
    for ((i = 0; i < 80; i++)); do
        printf "%s" "$1"
    done
    printf "\n"
}

getAvailableSpace() {
    df -a | awk 'NR > 1 {avail+=$4} END {print avail}'
}

formatByteCount() {
    numfmt --to=iec-i --suffix=B --padding=7 "$1"'000'
}

printSavedSpace() {
    local before=${1}
    local title=${2:-}

    local after
    after=$(getAvailableSpace)
    local saved=$((after - before))

    echo ""
    printSeparationLine "*"
    if [ -n "${title}" ]; then
        echo "=> ${title}: Saved $(formatByteCount "$saved")"
    else
        echo "=> Saved $(formatByteCount "$saved")"
    fi
    printSeparationLine "*"
    echo ""
}

printDF() {
    local caption=${1}

    printSeparationLine "="
    echo "${caption}"
    echo ""
    echo "$ df -h"
    echo ""
    df -h
    printSeparationLine "="
}

removeDir() {
    dir=${1}

    local before
    if [ ! -d "$dir" ]; then
        echo "::warning::Directory $dir does not exist, skipping."
    else
        before=$(getAvailableSpace)
        sudo rm -rf "$dir"
        printSavedSpace "$before" "Removed $dir"
    fi
}

removeUnusedDirectories() {
    local dirs_to_remove=(
        "/usr/local/lib/android"
        "/usr/share/dotnet"
        "/usr/local/.ghcup"
    )

    for dir in "${dirs_to_remove[@]}"; do
        removeDir "$dir"
    done
}

execAndMeasureSpaceChange() {
    local operation=${1} 
    local title=${2}

    local before
    before=$(getAvailableSpace)
    $operation

    printSavedSpace "$before" "$title"
}

cleanPackages() {
    local packages=(
        '^aspnetcore-.*'
        '^dotnet-.*'
        '^llvm-.*'
        '^mongodb-.*'
        '^mysql-.*'
        'azure-cli'
        'firefox'
        'libgl1-mesa-dri'
        'mono-devel'
        'php.*'
    )

    if isX86; then
        packages+=(
            'google-chrome-stable'
            'google-cloud-cli'
            'google-cloud-sdk'
            'powershell'
        )
    fi

    sudo apt-get -qq remove -y --fix-missing "${packages[@]}"
    sudo apt-get autoremove -y || echo "::warning::The command [sudo apt-get autoremove -y] failed"
    sudo apt-get clean || echo "::warning::The command [sudo apt-get clean] failed"
}

cleanDocker() {
    echo "=> Removing the following Docker images:"
    sudo docker image ls
    echo "=> Removing Docker images..."
    sudo docker image prune --all --force || true
}

cleanSwap() {
    sudo swapoff -a || true
    sudo rm -rf /mnt/swapfile || true
    free -h
}

AVAILABLE_INITIAL=$(getAvailableSpace)

printDF "BEFORE CLEAN-UP:"
echo ""

execAndMeasureSpaceChange cleanPackages "Unused packages"
execAndMeasureSpaceChange cleanDocker "Docker images"
execAndMeasureSpaceChange cleanSwap "Swap storage"

removeUnusedDirectories

echo ""
printDF "After clean-up:"

echo ""
printSavedSpace "$AVAILABLE_INITIAL" "Total saved"
