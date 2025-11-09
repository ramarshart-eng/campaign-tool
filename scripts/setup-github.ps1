param(
  [Parameter(Mandatory = $true)] [string]$GithubUser,
  [Parameter(Mandatory = $true)] [string]$Token,
  [string]$RepoName,
  [string]$FriendUser,
  [switch]$UseSSH,
  [switch]$Public
)

function Write-Step($msg) { Write-Host "[setup] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[ok] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[warn] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[err] $msg" -ForegroundColor Red }

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Err "Git is not installed or not in PATH."
  exit 1
}

if (-not (Test-Path .git)) {
  Write-Err "This folder is not a Git repository. Run 'git init' first."
  exit 1
}

if (-not $RepoName -or $RepoName.Trim() -eq '') {
  $RepoName = Split-Path -Leaf (Get-Location)
}

$isPrivate = -not $Public.IsPresent
$headers = @{
  Authorization = "token $Token"
  Accept        = 'application/vnd.github+json'
  'User-Agent'  = "setup-github-script"
}

Write-Step "Ensuring GitHub repo '$GithubUser/$RepoName' exists (private: $isPrivate)"

# Check if repo already exists
$repoExists = $false
try {
  $check = Invoke-RestMethod -Method Get -Uri "https://api.github.com/repos/$GithubUser/$RepoName" -Headers $headers
  if ($check.full_name) { $repoExists = $true }
} catch {
  $repoExists = $false
}

if (-not $repoExists) {
  $createBody = @{ name = $RepoName; private = $isPrivate } | ConvertTo-Json
  try {
    $repo = Invoke-RestMethod -Method Post -Uri "https://api.github.com/user/repos" -Headers $headers -Body $createBody
    Write-Ok "Created repo: $($repo.full_name)"
    $repoExists = $true
  } catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 422) {
      Write-Warn "Repo already exists. Proceeding."
      $repoExists = $true
    } elseif ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 403) {
      Write-Err "Token cannot create repositories (likely fine-grained or missing 'repo' scope)."
      Write-Host "Create the repo manually here: https://github.com/new (name: '$RepoName')." -ForegroundColor Yellow
      Write-Host "Then re-run this script, or run: git remote add origin https://github.com/$GithubUser/$RepoName.git; git push -u origin main" -ForegroundColor Yellow
      exit 1
    } else {
      throw
    }
  }
}

$remoteUrl = if ($UseSSH) { "git@github.com:$GithubUser/$RepoName.git" } else { "https://github.com/$GithubUser/$RepoName.git" }

Write-Step "Configuring remote origin => $remoteUrl"
if ((git remote) -match '^origin$') {
  git remote set-url origin $remoteUrl | Out-Null
} else {
  git remote add origin $remoteUrl | Out-Null
}

Write-Step "Pushing branch 'main' to origin"
if ($UseSSH) {
  git push -u origin main
} else {
  git -c http.extraHeader="AUTHORIZATION: bearer $Token" push -u origin main
}
Write-Ok "Pushed to GitHub"

if ($FriendUser -and $FriendUser.Trim() -ne '') {
  Write-Step "Inviting collaborator '$FriendUser' with push access"
  $inviteBody = @{ permission = 'push' } | ConvertTo-Json
  $invite = Invoke-RestMethod -Method Put -Uri "https://api.github.com/repos/$GithubUser/$RepoName/collaborators/$FriendUser" -Headers $headers -Body $inviteBody
  Write-Ok "Invitation sent to $FriendUser"
}

Write-Ok "All done. Repo: https://github.com/$GithubUser/$RepoName"
