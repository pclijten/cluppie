# Alles wat in de code staat live zetten: functions, de toegang voor callables, rules en indexen.
# Vervangt de losse deploy-opdrachten die in PORTEREN.md per release open staan (Teamkamer, Trainingshulp,
# Platform > Mails, Clubprofiel en ouder). Zie docs/deploy-openstaand.md voor wat dit oplost.
#
# Starten vanuit de map Cluppie, op branch main, met een schone werkmap:
#   powershell -ExecutionPolicy Bypass -File tools\deploy-alles.ps1
# Alleen kijken wat er zou gebeuren (voert niets uit):
#   powershell -ExecutionPolicy Bypass -File tools\deploy-alles.ps1 -Proef
# De tests in de emulator overslaan (alleen als ze net groen waren):
#   powershell -ExecutionPolicy Bypass -File tools\deploy-alles.ps1 -ZonderEmulator
#
# Dit bestand bevat bewust alleen ASCII-tekens (Windows PowerShell 5.1 leest geen UTF-8 zonder BOM).
# Het script stopt bij elke fout. Opnieuw starten is veilig: elke stap is herhaalbaar.
# Volgorde (zoals AVG.md voorschrijft): eerst de functions, dan pas de rules.
# Er wordt nooit een functie verwijderd, en hosting gaat via GitHub Pages (niet via dit script).
# De proef (-Proef) is op 21-11-2026 op de pc van Paul gedraaid, de echte deploy op 22-11-2026 (alles OK).
param([switch]$Proef, [switch]$ZonderEmulator)

$ErrorActionPreference = 'Stop'
$PROJECT = 'cluppie-ad329'
$REGIO   = 'europe-west1'

function Stap($n, $t){ Write-Host "`n=== Stap $n - $t ===" -ForegroundColor Cyan }
function Ok($t){ Write-Host "  OK  $t" -ForegroundColor Green }
function Stop-Met($t){ Write-Host "`n  STOP: $t" -ForegroundColor Red; Write-Host "  Er is niets kapot: wat al gedeployed is blijft staan. Stuur deze uitvoer naar Claude." -ForegroundColor Yellow; exit 1 }
function Run($cmd){
  Write-Host "  > $cmd" -ForegroundColor DarkGray
  if ($Proef){ return }
  $global:LASTEXITCODE = 0
  Invoke-Expression $cmd
  if ($LASTEXITCODE -ne 0){ Stop-Met "dit commando faalde (code $LASTEXITCODE)" }
}
function Probeer($cmd){
  $global:LASTEXITCODE = 0
  $oud = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { Invoke-Expression "$cmd 2>&1" | Out-Null; $ok = ($LASTEXITCODE -eq 0) } catch { $ok = $false }
  $ErrorActionPreference = $oud
  return $ok
}

# Op Windows blijft na 'firebase emulators:exec' soms de java-emulator draaien; die houdt dan de poorten
# bezet en de volgende testrun faalt met 'port taken'. Dit stopt alleen java-processen op de emulatorpoorten
# uit firebase.json en firebase.test.json.
$EMULATORPOORTEN = 8080, 8085, 9150, 9151, 9195, 4400, 4405, 4500, 4505
function Ruim-Emulators {
  try { $con = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $EMULATORPOORTEN -contains $_.LocalPort }) } catch { return }
  foreach ($procId in ($con | Select-Object -ExpandProperty OwningProcess -Unique)){
    $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($p -and $p.ProcessName -eq 'java'){
      if ($Proef){ Write-Host "  (zou achtergebleven emulator stoppen: pid $procId)" -ForegroundColor DarkGray }
      else { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue; Write-Host "  achtergebleven emulator gestopt (pid $procId)" -ForegroundColor DarkGray }
    }
  }
}

# ---------- 0. controles ----------
Stap 0 'Controles'
if (-not (Test-Path 'tools\functies-lijst.mjs') -or -not (Test-Path 'firestore.rules')){ Stop-Met 'start dit script vanuit de map Cluppie' }
foreach ($p in 'gcloud','firebase','node','git','npm'){ if (-not (Get-Command $p -ErrorAction SilentlyContinue)){ Stop-Met "$p is niet geinstalleerd of niet gevonden" } }
$tak = (git branch --show-current).Trim()
if ($tak -ne 'main'){ Stop-Met "je staat op branch '$tak'; live gaat alleen wat op main staat: git checkout main en git pull" }
# Alleen gewijzigde bestanden die git volgt tellen; losse mappen die niet in git staan (marketing, .claude) gaan niet mee met een deploy.
if ((git status --porcelain --untracked-files=no) -and -not $Proef){ Stop-Met 'er staan gewijzigde bestanden in de werkmap die niet gecommit zijn; deploy alleen wat op main staat (git status laat zien welke)' }
# via Probeer: git schrijft zijn voortgang naar de foutuitvoer, en Windows PowerShell 5.1 ziet dat met 'Stop' als een fout
if (-not (Probeer 'git fetch origin main')){ Stop-Met 'GitHub is niet bereikbaar (git fetch origin main mislukte)' }
if ((git rev-parse HEAD).Trim() -ne (git rev-parse origin/main).Trim()){ Stop-Met 'je lokale main loopt niet gelijk met GitHub: eerst git pull' }
Ok 'gcloud, firebase, node, git en npm gevonden, branch main'
if ($Proef){ Write-Host '  PROEF: de commando''s hieronder worden getoond, niet uitgevoerd.' -ForegroundColor Yellow }

# ---------- 1. inloggen en afhankelijkheden ----------
Stap 1 'Inloggen en afhankelijkheden'
if (-not $Proef){
  $oudEap = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  $actief = (gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null)
  $ErrorActionPreference = $oudEap
  if (-not $actief){ Run 'gcloud auth login' } else { Ok "gcloud: $actief" }
  if (-not (Probeer "firebase projects:list")){ Run 'firebase login' } else { Ok 'firebase CLI ingelogd' }
}
Run 'npm install --no-audit --no-fund'
Push-Location functions; Run 'npm install --no-audit --no-fund'; Pop-Location

# ---------- 2. tests: zonder groen geen deploy ----------
Stap 2 'Tests (logica, daarna rules in de emulator)'
Run 'npm test'
if ($ZonderEmulator){ Write-Host '  Emulatortests overgeslagen (-ZonderEmulator).' -ForegroundColor Yellow }
else {
  Ruim-Emulators
  Run 'npm run test:rules'
  Ruim-Emulators
  Run 'npm run test:storage'
  Ruim-Emulators
}
Ok 'tests groen'

# ---------- 3. de lijst uit de code ----------
Stap 3 'Functies uit de code lezen'
$groepen   = @(node tools/functies-lijst.mjs --groepen=8)
if ($LASTEXITCODE -ne 0 -or $groepen.Count -eq 0){ Stop-Met 'de lijst met functies kon niet gemaakt worden (cd functions; npm install)' }
$callables = @(node tools/functies-lijst.mjs --callables)
Ok "$($groepen.Count) groepen, $($callables.Count) callables"

# ---------- 4. functions, acht tegelijk ----------
Stap 4 'Functions deployen (acht per keer; dit duurt een kwartier of langer)'
$i = 0
foreach ($g in $groepen){
  $i++
  Write-Host "  groep $i van $($groepen.Count)" -ForegroundColor DarkGray
  Run "firebase deploy --only $g --project $PROJECT"
}
Ok 'alle functions staan op de versie van main'

# ---------- 5. callables bereikbaar maken ----------
Stap 5 'Toegang voor callables (invoker allUsers; de functie zelf controleert wie je bent)'
foreach ($c in $callables){
  Run "gcloud run services add-iam-policy-binding $c --region=$REGIO --member=allUsers --role=roles/run.invoker --project=$PROJECT --quiet"
}
Ok 'elke callable is aan te roepen vanuit de app'

# ---------- 6. rules en indexen ----------
Stap 6 'Rules en indexen (Firestore en Storage)'
Run "firebase deploy --only firestore:rules,firestore:indexes,storage --project $PROJECT"
Ok 'rules en indexen staan op de versie van main'

# ---------- klaar ----------
Write-Host "`nKlaar." -ForegroundColor Green
Write-Host 'Loop nu in de app na (zie docs/deploy-openstaand.md, "Daarna nalopen"):'
Write-Host '  - Platform > Mails opent en toont de teksten'
Write-Host '  - Platform > een club > Onderdelen: Teamkamer aanzetten bij een proefclub en als ouder binnenkomen'
Write-Host '  - Lijstjes > Trainingshulp: een lijst maken en de open link proberen'
Write-Host '  - Platform > een club > Clubprofiel: een document inlezen'
