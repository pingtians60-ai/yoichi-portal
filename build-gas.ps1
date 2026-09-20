$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $rootDir) { $rootDir = Get-Location }

$gasDir = Join-Path $rootDir "gas"
$imagesDir = Join-Path $rootDir "images"
$cssDir = Join-Path $rootDir "css"
$jsDir = Join-Path $rootDir "js"

Write-Host "Building single-file HTML for Google Apps Script..." -ForegroundColor Cyan

$indexPath = Join-Path $rootDir "index.html"
$htmlContent = [System.IO.File]::ReadAllText($indexPath, [System.Text.Encoding]::UTF8)

# 1. Base64 encode images
$iconPath = Join-Path $imagesDir "portal-icon.png"
if (Test-Path $iconPath) {
    $bytes = [System.IO.File]::ReadAllBytes($iconPath)
    $b64 = [System.Convert]::ToBase64String($bytes)
    $dataUri = "data:image/png;base64,$b64"
    $htmlContent = $htmlContent.Replace('src="images/portal-icon.png"', ('src="' + $dataUri + '"'))
    $htmlContent = $htmlContent.Replace("src='images/portal-icon.png'", ('src="' + $dataUri + '"'))
    Write-Host "  Inlined portal-icon.png" -ForegroundColor Green
}

# 2. Inline CSS files
$cssFiles = @("css/main.css", "css/calendar.css", "css/event_shift.css")
foreach ($rel in $cssFiles) {
    $filePath = Join-Path $rootDir ($rel.Replace('/', '\'))
    if (Test-Path $filePath) {
        $content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
        $pattern = '<link\s+rel=["'']stylesheet["'']\s+href=["'']' + [regex]::Escape($rel) + '["'']\s*/?>'
        $styleBlock = "<style>`n/* $rel */`n" + $content + "`n</style>"
        $htmlContent = [regex]::Replace($htmlContent, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ return $styleBlock }, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        Write-Host "  Inlined $rel" -ForegroundColor Green
    }
}

# 3. Inline JS files
$jsList = @(
    "js/config.js",
    "js/utils.js",
    "js/store.js",
    "js/dashboard.js",
    "js/schedule.js",
    "js/event_shift.js",
    "js/members.js",
    "js/shops.js",
    "js/app.js"
)

foreach ($rel in $jsList) {
    $filePath = Join-Path $rootDir ($rel.Replace('/', '\'))
    if (Test-Path $filePath) {
        $content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
        $pattern = '<script\s+src=["'']' + [regex]::Escape($rel) + '["'']\s*></script>'
        $scriptBlock = "<script>`n// $rel`n" + $content + "`n</script>"
        $htmlContent = [regex]::Replace($htmlContent, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ return $scriptBlock }, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        Write-Host "  Inlined $rel" -ForegroundColor Green
    }
}

# 4. Save to gas/index.html
if (-not (Test-Path $gasDir)) {
    New-Item -ItemType Directory -Path $gasDir -Force | Out-Null
}
$outputPath = Join-Path $gasDir "index.html"
[System.IO.File]::WriteAllText($outputPath, $htmlContent, [System.Text.Encoding]::UTF8)

Write-Host "`nSuccessfully generated $outputPath" -ForegroundColor Cyan
