param(
  [Parameter(Mandatory=$true)] [string]$AsanaPAT,
  [Parameter(Mandatory=$true)] [string]$AsanaProjectGid,
  [Parameter(Mandatory=$true)] [string]$GithubToken,
  [Parameter(Mandatory=$true)] [string]$Repo, # e.g., "ramarshart-eng/campaign-tool"
  [switch]$OnlyMVP
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step($m){ Write-Host "[sync] $m" -ForegroundColor Cyan }
function Write-Ok($m){ Write-Host "[ok] $m" -ForegroundColor Green }
function Write-Err($m){ Write-Host "[err] $m" -ForegroundColor Red }

$asanaHeaders = @{ Authorization = "Bearer $AsanaPAT"; 'Content-Type'='application/json' }
$ghHeaders    = @{ Authorization = "Bearer $GithubToken"; 'Content-Type'='application/json'; Accept='application/vnd.github+json'; 'User-Agent'='asana-github-sync' }

Write-Step "Fetching Asana tasks for project $AsanaProjectGid"
$url = "https://app.asana.com/api/1.0/projects/$AsanaProjectGid/tasks?limit=100&opt_fields=gid,name,notes,permalink_url,tags.name"
$resp = Invoke-RestMethod -Headers $asanaHeaders -Uri $url
$tasks = @($resp.data)

if ($OnlyMVP) { $tasks = $tasks | Where-Object { $_.tags.name -contains 'mvp' } }

# Limit to epics by tag
$epics = $tasks | Where-Object { $_.tags.name -contains 'epic' }
if (-not $epics) { Write-Err "No epic-tagged tasks found."; exit 1 }

Write-Step ("Creating GitHub issues in {0} for {1} epics" -f $Repo, $epics.Count)
$created = @()
foreach ($t in $epics) {
  $title = "Epic: " + $t.name
  $body  = """
From Asana: $($t.permalink_url)

Acceptance Criteria / Notes:
$($t.notes)
"""
  $payload = @{ title=$title; body=$body } | ConvertTo-Json -Depth 5
  try {
    $issue = Invoke-RestMethod -Headers $ghHeaders -Method Post -Uri ("https://api.github.com/repos/$Repo/issues") -Body $payload
    $created += [PSCustomObject]@{ title=$issue.title; url=$issue.html_url; asana=$t.permalink_url }
  } catch {
    $created += [PSCustomObject]@{ title=$title; url='ERROR'; asana=$t.permalink_url }
  }
}

$created | Format-Table -AutoSize
Write-Ok "Done"

