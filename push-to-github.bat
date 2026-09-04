@echo off
echo ========================================
echo Git Setup und Push zu GitHub
echo ========================================
echo.

set repoUrl=https://github.com/46143/token-man-.git

if not exist ".git" (
    echo [1/5] Git wird initialisiert...
    git init
) else (
    echo [1/5] Git ist bereits initialisiert
)

echo.
echo [2/5] Remote Repository wird hinzugefugt...
git remote add origin %repoUrl%

echo.
echo [3/5] Dateien werden zum Staging-Bereich hinzugefugt...
git add .

echo.
echo [4/5] Commit wird erstellt...
git commit -m "Initial commit - Token Refresh Bot"

echo.
echo [5/5] Branch wird zu main umbenannt und Code wird gepusht...
git branch -M main
git push -u origin main

echo.
echo ========================================
echo Erfolgreich zu GitHub gepusht!
echo Repository: %repoUrl%
echo ========================================
echo.
pause
