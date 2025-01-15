param(
    [ValidateNotNullOrEmpty()]
    [string][Parameter(Mandatory=$true)]$SignIdentity,
    
    [ValidateNotNullOrEmpty()]
    [string][Parameter(Mandatory=$true)]$GithubRunId
)

$ErrorActionPreference = "Stop"

function Download-Artifacts {
    param(
        [string]$Name,
        [string]$GithubRunId
    )
    gh run download $GithubRunId --name $Name -D (Join-Path $PWD 'windsign-temp\windows-x64-obj-' + $Name)
    Write-Verbose "Downloaded $Name artifacts"
}

function Sign-Files {
    param(
        [string]$Path
    )
    $files = Get-ChildItem -Path $Path -Recurse -Include *.exe, *.dll
    signtool.exe sign /n "$SignIdentity" /t http://time.certum.pl/ /fd sha256 /v $files
}

function Move-File {
    param(
        [string]$Source,
        [string]$Destination
    )
    if (Test-Path $Source) {
        Move-Item $Source -Destination $Destination -Force
        Write-Verbose "Moved $Source to $Destination"
    } else {
        Write-Warning "Source file $Source does not exist."
    }
}

function Create-Tar {
    param(
        [string]$Name
    )
    $tarPath = Join-Path $PWD "windsign-temp\windows-x64-signed-$Name"
    Remove-Item -Path $tarPath -Recurse -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $tarPath | Out-Null

    Move-File -Source ".\dist\output.mar" -Destination (Join-Path $tarPath ("windows-$Name.mar"))
    Move-File -Source ".\dist\zen.installer.exe" -Destination (Join-Path $tarPath ("zen.installer$($Name -eq 'arm64' ? '-arm64' : '') .exe"))
    Move-File -Source (Get-ChildItem ".\dist\*.en-US.win64$($Name -eq 'arm64' ? '-aarch64' : '') .zip" | Select-Object -First 1) -Destination (Join-Path $tarPath ("zen.win-$Name.zip"))
}

function SignAndPackage {
    param(
        [string]$Name
    )

    Write-Verbose "Executing on $Name"
    Remove-Item -Path ".\dist" -Recurse -ErrorAction SilentlyContinue
    Remove-Item -Path "engine\obj-x86_64-pc-windows-msvc\" -Recurse -ErrorAction SilentlyContinue
    Copy-Item -Path (Join-Path $PWD "windsign-temp\windows-x64-obj-$Name") -Destination "engine\obj-x86_64-pc-windows-msvc\" -Recurse
    Write-Verbose "Signing $Name"

    Sign-Files -Path "engine\obj-x86_64-pc-windows-msvc\"

    $env:SURFER_SIGNING_MODE = "sign"
    $env:MAR = (Join-Path $PWD "build\winsign\mar.exe")
    $env:SURFER_COMPAT = if ($Name -eq "arm64") { "aarch64" } else { "x86_64" }
    Write-Verbose "Compat Mode? $env:SURFER_COMPAT"

    pnpm surfer package --verbose

    Create-Tar -Name $Name

    # Extract and sign the contents of the zip
    Expand-Archive -Path (Join-Path $tarPath ("zen.win-$Name.zip")) -DestinationPath (Join-Path $tarPath ("zen.win-$Name"))
    Remove-Item -Path (Join-Path $tarPath ("zen.win-$Name.zip")) -ErrorAction SilentlyContinue

    Sign-Files -Path (Join-Path $tarPath ("zen.win-$Name"))
    Compress-Archive -Path (Join-Path $tarPath ("zen.win-$Name")) -DestinationPath (Join-Path $tarPath ("zen.win-$Name.zip"))
    Remove-Item -Path (Join-Path $tarPath ("zen.win-$Name")) -Recurse -ErrorAction SilentlyContinue

    Move-File -Source ".\dist\update\*" -Destination (Join-Path $tarPath "update_manifest")

    Write-Verbose "Finished $Name"
}

Write-Verbose "Preparing environment"
git pull --recurse-submodules
New-Item -ItemType Directory -Path "windsign-temp" -ErrorAction SilentlyContinue

Download-Artifacts -Name "windows-x64-obj-arm64" -GithubRunId $GithubRunId
Download-Artifacts -Name "windows-x64-obj-x86_64" -GithubRunId $GithubRunId

New-Item -ItemType Directory -Path "engine\obj-x86_64-pc-windows-msvc" -ErrorAction SilentlyContinue
pnpm surfer ci --brand release

SignAndPackage -Name "arm64"
SignAndPackage -Name "x86_64"

Write-Verbose "All artifacts signed and packaged, ready for release!"
Write-Verbose "Committing the changes to the repository"
cd (Join-Path $PWD "windsign-temp\windows-binaries")
git add .
git commit -m "Sign and package windows artifacts"
git push
cd - 

# Cleaning up
Write-Verbose "Cleaning up"
Remove-Item -Path "windsign-temp\windows-x64-obj-x86_64" -Recurse -ErrorAction SilentlyContinue
Remove-Item -Path "windsign-temp\windows-x64-obj-arm64" -Recurse -ErrorAction SilentlyContinue

Write-Verbose "Opening Visual Studio Code"
code .
Write-Host "All done! Press Enter to continue."
Read-Host

