<#
.SYNOPSIS
Windows artifact signing and packaging pipeline with enhanced security and reliability

.DESCRIPTION
Automates the signing and packaging process for Windows binaries with:
- Parallel artifact downloading
- Digital signature verification
- Transactional file operations
- Comprehensive logging
- Automatic cleanup

.PARAMETER SignIdentity
Certificate subject name for code signing (Must match installed certificate)

.PARAMETER GithubRunId
GitHub Actions run ID containing the artifacts

.EXAMPLE
./sign-package.ps1 -SignIdentity "CN=Your Signing Certificate" -GithubRunId 123456789
#>

param(
    [string][Parameter(Mandatory=$true)]
    [ValidatePattern('^CN=[\w\s-,]+$')]
    $SignIdentity,

    [string][Parameter(Mandatory=$true)]
    $GithubRunId
)

#region Initialization
$ErrorActionPreference = "Stop"
$WarningPreference = "Continue"
$DebugPreference = "Continue"

# Configure logging
$logFile = "windsign-$((Get-Date).ToString('yyyyMMdd-HHmmss')).log"
Start-Transcript -Path $logFile -Append
#endregion

#region Helper Functions
function SafeRemove($path) {
    if (Test-Path $path) {
        Remove-Item $path -Recurse -Force -ErrorAction Continue
        Write-Debug "Removed: $path"
    }
}

function EnsureDirectory($path) {
    if (-not (Test-Path $path)) {
        New-Item $path -ItemType Directory -ErrorAction Stop | Out-Null
        Write-Debug "Created directory: $path"
    }
}

function Retry-Command {
    param(
        [Parameter(Mandatory)]
        [scriptblock]$ScriptBlock,
        [int]$MaxRetries = 3,
        [int]$DelaySeconds = 5
    )
    
    $attempt = 1
    do {
        try {
            return & $ScriptBlock
        }
        catch {
            if ($attempt -ge $MaxRetries) {
                throw "Command failed after $MaxRetries attempts: $_"
            }
            Write-Warning "Attempt $attempt failed: $_"
            Start-Sleep -Seconds $DelaySeconds
            $attempt++
        }
    } while ($true)
}

function SignFiles($files) {
    if (-not $files) {
        Write-Warning "No files to sign"
        return
    }

    Write-Progress -Activity "Signing" -Status "Processing $($files.Count) files"
    
    # Sign files
    $signResult = Retry-Command -ScriptBlock {
        signtool.exe sign /n "$SignIdentity" /t http://time.certum.pl/ /fd sha256 /v $files 2>&1
    } -MaxRetries 3

    if ($LASTEXITCODE -ne 0) {
        throw "Signing failed: $signResult"
    }

    # Verify signatures
    $verifyResult = Retry-Command -ScriptBlock {
        signtool.exe verify /pa /v $files 2>&1
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Verification failed: $verifyResult"
    }
}
#endregion

try {
    #region Environment Setup
    Write-Host "🚀 Initializing signing pipeline" -ForegroundColor Cyan
    EnsureDirectory "windsign-temp"
    
    Write-Progress -Activity "Setup" -Status "Updating repositories"
    Retry-Command -ScriptBlock {
        git pull --recurse-submodules
    }
    #endregion

    #region Parallel Artifact Download
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    Write-Host "📥 Downloading artifacts..." -ForegroundColor Blue

    $downloadJobs = @(
        @{Name = "arm64"; Path = "windsign-temp\windows-x64-obj-arm64"},
        @{Name = "x86_64"; Path = "windsign-temp\windows-x64-obj-x86_64"}
    ) | ForEach-Object {
        Start-ThreadJob -Name $_.Name -ScriptBlock {
            param($RunId, $Path)
            Retry-Command -ScriptBlock {
                gh run download $RunId --name "windows-x64-obj-$($args[0])" -D $args[1]
            } -MaxRetries 5
        } -ArgumentList $GithubRunId, $_.Path
    }

    # Monitor downloads with timeout
    while ($downloadJobs.State -contains 'Running' -and $timer.Elapsed.TotalMinutes -lt 15) {
        $completed = ($downloadJobs | Where-Object State -eq 'Completed').Count
        Write-Progress -Activity "Downloading" -Status "$completed/2 completed" `
            -PercentComplete ($completed / 2 * 100)
        Start-Sleep -Seconds 5
    }

    # Validate downloads
    foreach ($job in $downloadJobs) {
        if ($job.State -ne 'Completed') {
            throw "Download failed for $($job.Name)"
        }
        Receive-Job $job | ForEach-Object { Write-Debug $_ }
    }
    #endregion

    #region Signing & Packaging
    function SignAndPackage($name) {
        try {
            Write-Host "🔏 Processing $name architecture" -ForegroundColor Magenta
            $timer.Restart()

            # Clean working directories
            SafeRemove ".\dist"
            SafeRemove "engine\obj-x86_64-pc-windows-msvc\"

            # Validate artifact source
            $sourceDir = "windsign-temp\windows-x64-obj-$name"
            if (-not (Test-Path $sourceDir)) {
                throw "Missing artifact directory: $sourceDir"
            }

            # Prepare build environment
            EnsureDirectory "engine\obj-x86_64-pc-windows-msvc"
            Copy-Item $sourceDir\* "engine\obj-x86_64-pc-windows-msvc\" -Recurse -Force

            # Sign binaries
            Write-Progress -Activity "Signing" -Status "Collecting files"
            $files = @(
                Get-ChildItem "engine\obj-x86_64-pc-windows-msvc\" -Recurse -Include *.exe, *.dll
            )
            SignFiles $files

            # Package artifacts
            Write-Progress -Activity "Packaging" -Status "Building packages"
            $env:SURFER_SIGNING_MODE = "sign"
            $env:MAR = "$PWD\build\winsign\mar.exe"
            $env:SURFER_COMPAT = if ($name -eq "arm64") { "aarch64" } else { "x86_64" }

            Retry-Command -ScriptBlock {
                pnpm surfer package --verbose
            }

            # Prepare release bundle
            $targetDir = "windsign-temp\windows-x64-signed-$name"
            SafeRemove $targetDir
            EnsureDirectory $targetDir

            # Move and rename artifacts
            $artifactOperations = @(
                @{ Source = "dist\output.mar"; Dest = "windows$(if($name -eq 'arm64'){'-arm64'}).mar" }
                @{ Source = "dist\zen.installer.exe"; Dest = "zen.installer$(if($name -eq 'arm64'){'-arm64'}).exe" }
                @{ Source = "dist\*.en-US.win64$(if($name -eq 'arm64'){'-aarch64'}).zip"; 
                   Dest = "zen.win-$(if($name -eq 'arm64'){'arm64'}else{$name}).zip" }
            )

            foreach ($op in $artifactOperations) {
                $source = Get-Item $op.Source
                if (-not $source) {
                    throw "Missing source file: $($op.Source)"
                }
                Move-Item $source.FullName "$targetDir\$($op.Dest)" -Force
            }

            # Process ZIP contents
            $zipFile = Get-Item "$targetDir\zen.win-$name.zip"
            $extractPath = "$targetDir\zen.win-$name"
            
            Expand-Archive $zipFile -DestinationPath $extractPath -Force
            SafeRemove $zipFile.FullName
            
            $files = Get-ChildItem $extractPath -Recurse -Include *.exe, *.dll
            SignFiles $files
            
            Compress-Archive -Path "$extractPath\*" -DestinationPath $zipFile.FullName -CompressionLevel Optimal
            SafeRemove $extractPath

            # Commit artifacts
            EnsureDirectory "windsign-temp\windows-binaries"
            Move-Item $targetDir "windsign-temp\windows-binaries" -Force

            Write-Host "✅ Successfully processed $name in $($timer.Elapsed.ToString('mm\:ss'))" -ForegroundColor Green
        }
        catch {
            Write-Host "❌ Error processing $name`: $_" -ForegroundColor Red
            exit 1
        }
    }

    # Process architectures in parallel
    $signJobs = 'arm64', 'x86_64' | ForEach-Object {
        Start-ThreadJob -Name "Sign-$_" -ScriptBlock {
            param($name, $SignIdentity)
            SignAndPackage $name
        } -ArgumentList $_, $SignIdentity
    }

    $signJobs | Wait-Job | Receive-Job
    #endregion

    #region Final Commit
    Write-Host "📦 Committing signed artifacts" -ForegroundColor Cyan
    Push-Location "windsign-temp\windows-binaries"
    try {
        Retry-Command -ScriptBlock {
            git add .
            git commit -m "Sign and package windows artifacts (Run $GithubRunId)"
            git push
        }
    }
    finally {
        Pop-Location
    }
    #endregion
}
catch {
    Write-Host "💥 Critical pipeline error: $_" -ForegroundColor Red
    exit 1
}
finally {
    #region Cleanup
    Write-Host "🧹 Cleaning up temporary files..." -ForegroundColor Yellow
    $cleanupItems = @(
        "windsign-temp\windows-x64-obj-*",
        "engine\obj-x86_64-pc-windows-msvc",
        "dist"
    )
    
    $cleanupItems | ForEach-Object {
        SafeRemove $_
    }

    if (Test-Path env:SURFER_SIGNING_MODE) {
        Remove-Item env:SURFER_SIGNING_MODE
    }
    
    Stop-Transcript
    Write-Host "🕒 Total execution time: $($timer.Elapsed.ToString('hh\:mm\:ss'))" -ForegroundColor Cyan
    #endregion
}

Write-Host "🎉 All artifacts signed and packaged successfully!" -ForegroundColor Green
