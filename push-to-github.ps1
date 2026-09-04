# Git Setup und Push zu GitHub
# Dieses Skript initialisiert Git und pusht den Code zu deinem GitHub Repository

Write-Host "🚀 Git Setup und Push zu GitHub" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# Repository URL
$repoUrl = "https://github.com/46143/token-man-.git"

# Prüfen ob Git initialisiert ist
if (-not (Test-Path ".git")) {
    Write-Host "📦 Git wird initialisiert..." -ForegroundColor Yellow
    git init
}

# Remote hinzufügen
Write-Host "🔗 Remote Repository wird hinzugefügt..." -ForegroundColor Yellow
git remote add origin $repoUrl

# Alle Dateien zum Staging-Bereich hinzufügen
Write-Host "📝 Dateien werden zum Staging-Bereich hinzugefügt..." -ForegroundColor Yellow
git add .

# Commit erstellen
Write-Host "✅ Commit wird erstellt..." -ForegroundColor Yellow
git commit -m "Initial commit - Token Refresh Bot"

# Branch zu main umbenennen
Write-Host "🌿 Branch wird zu main umbenannt..." -ForegroundColor Yellow
git branch -M main

# Push zu GitHub
Write-Host "📤 Code wird zu GitHub gepusht..." -ForegroundColor Yellow
git push -u origin main

Write-Host "✅ Erfolgreich zu GitHub gepusht!" -ForegroundColor Green
Write-Host "🔗 Repository: $repoUrl" -ForegroundColor Cyan
