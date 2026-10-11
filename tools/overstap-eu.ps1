# Overstap van Cluppie naar de EU, in één keer. Zie MIGRATIE-EU.md voor uitleg per stap.
# Starten vanuit de map Cluppie (branch eu-database):
#   powershell -ExecutionPolicy Bypass -File tools\overstap-eu.ps1
# Het script stopt bij elke fout. Opnieuw starten is veilig: gedane stappen worden herkend of zijn herhaalbaar.

$ErrorActionPreference = 'Stop'
$PROJECT   = 'cluppie-ad329'
$REGIO     = 'europe-west1'
$TIJDELIJK = 'cluppie-overzet'
$BUCKET    = 'cluppie-ad329-eu'
$OUDE      = 'cluppie-ad329.firebasestorage.app'

function Stap($n, $t){ Write-Host "`n=== Stap $n · $t ===" -ForegroundColor Cyan }
function Ok($t){ Write-Host "  OK  $t" -ForegroundColor Green }
function Stop-Met($t){ Write-Host "`n  STOP: $t" -ForegroundColor Red; Write-Host "  Er is niets kapot. Stuur deze uitvoer naar Claude." -ForegroundColor Yellow; exit 1 }
function Run($cmd){
  Write-Host "  > $cmd" -ForegroundColor DarkGray
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

# ---------- 0. controles ----------
Stap 0 'Controles'
if (-not (Test-Path 'tools\migreer-eu.mjs') -or -not (Test-Path 'MIGRATIE-EU.md')){ Stop-Met 'start dit script vanuit de map Cluppie, op branch eu-database (git checkout eu-database)' }
foreach ($p in 'gcloud','firebase','node','git'){ if (-not (Get-Command $p -ErrorAction SilentlyContinue)){ Stop-Met "$p is niet geïnstalleerd of niet gevonden" } }
$tak = (git branch --show-current).Trim()
if ($tak -ne 'eu-database'){ Stop-Met "je staat op branch '$tak'; eerst: git checkout eu-database" }
Ok 'gcloud, firebase, node en git gevonden, branch eu-database'

# ---------- 1. inloggen ----------
Stap 1 'Inloggen bij Google (browser opent; log in met het account van het Firebase-project)'
$actief = (gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null)
if (-not $actief){ Run 'gcloud auth login' } else { Ok "gcloud: $actief" }
if (-not (Probeer 'gcloud auth application-default print-access-token')){ Run 'gcloud auth application-default login' } else { Ok 'toegang voor het kopieerscript staat al' }
Run "gcloud config set project $PROJECT"
if (-not (Probeer "firebase projects:list")){ Run 'firebase login' } else { Ok 'firebase CLI ingelogd' }
Push-Location functions; Run 'npm install --no-audit --no-fund'; Pop-Location

# ---------- 2. tijdelijke EU-database ----------
Stap 2 "Tijdelijke database $TIJDELIJK in $REGIO"
if (Probeer "gcloud firestore databases describe --database=$TIJDELIJK --project=$PROJECT"){ Ok 'bestaat al' }
else { Run "gcloud firestore databases create --database=$TIJDELIJK --location=$REGIO --type=firestore-native --project=$PROJECT" }

# ---------- 3. EU-bucket ----------
Stap 3 "Bucket $BUCKET in $REGIO, gekoppeld aan Firebase"
if (Probeer "gcloud storage buckets describe gs://$BUCKET --project=$PROJECT"){ Ok 'bucket bestaat al' }
else { Run "gcloud storage buckets create gs://$BUCKET --location=$REGIO --uniform-bucket-level-access --project=$PROJECT" }
$token = (gcloud auth print-access-token).Trim()
try {
  Invoke-RestMethod -Method Post -Uri "https://firebasestorage.googleapis.com/v1beta/projects/$PROJECT/buckets/${BUCKET}:addFirebase" `
    -Headers @{ Authorization = "Bearer $token"; 'x-goog-user-project' = $PROJECT } -ContentType 'application/json' -Body '{}' | Out-Null
  Ok 'bucket gekoppeld aan Firebase'
} catch {
  if ($_.Exception.Message -match '409|already'){ Ok 'bucket was al gekoppeld' }
  else { Stop-Met "bucket koppelen aan Firebase lukte niet: $($_.Exception.Message). Doe het dan in de Firebase-console: Storage → Add bucket → Import existing bucket → $BUCKET" }
}
Run "firebase target:apply storage eu $BUCKET --project $PROJECT"
Run "firebase target:apply storage oud $OUDE --project $PROJECT"
Run "firebase deploy --only storage:eu --project $PROJECT"

# ---------- 4. bestanden kopiëren (app draait nog) ----------
Stap 4 'Bestanden kopiëren naar de EU-bucket (de app draait nog gewoon)'
Run 'node tools/migreer-eu.mjs storage'
Run 'node tools/migreer-eu.mjs controle-storage'

# ---------- 5. app op slot ----------
Stap 5 'App op slot zetten'
Write-Host "  Vanaf nu werkt de app 15 à 30 minuten niet. Doe dit op een rustig moment." -ForegroundColor Yellow
$a = Read-Host '  Typ JA om door te gaan (iets anders = stoppen, er is dan niets veranderd aan de database)'
if ($a -ne 'JA'){ Write-Host '  Gestopt. Start het script later opnieuw; stap 1 t/m 4 worden dan overgeslagen of herhaald.'; exit 0 }
Run "firebase deploy --config firebase.slot.json --only firestore:rules --project $PROJECT"

# ---------- 6. kopie A ----------
Stap 6 "Database kopiëren: (default) → $TIJDELIJK"
Run "node tools/migreer-eu.mjs firestore --van=`"(default)`" --naar=$TIJDELIJK"
Run "node tools/migreer-eu.mjs controle --van=`"(default)`" --naar=$TIJDELIJK"
Run 'node tools/migreer-eu.mjs storage'
Ok 'kopie A is gelijk aan de bron'

# ---------- 7. (default) verwijderen ----------
Stap 7 'Oude database (VS) verwijderen'
Write-Host "  De controle hierboven zei 'Gelijk': alles staat in $TIJDELIJK (EU)." -ForegroundColor Yellow
Write-Host "  Verwijderen van (default) kan niet ongedaan worden gemaakt." -ForegroundColor Yellow
$a = Read-Host "  Typ VERWIJDER $PROJECT om de oude database te verwijderen"
if ($a -ne "VERWIJDER $PROJECT"){ Write-Host "  Gestopt vóór het verwijderen. De app staat nog op slot; start het script opnieuw om verder te gaan,"; Write-Host "  of zet de app weer open met: firebase deploy --only firestore:rules --project $PROJECT"; exit 0 }
Probeer "gcloud firestore databases update --database=`"(default)`" --no-delete-protection --project=$PROJECT" | Out-Null
Run "gcloud firestore databases delete --database=`"(default)`" --project=$PROJECT --quiet"

# ---------- 8. (default) opnieuw in de EU ----------
Stap 8 "(default) opnieuw aanmaken in $REGIO"
Write-Host '  Google laat een verwijderde database-ID pas na ongeveer 5 minuten weer toe; het script probeert het elke minuut.'
$gelukt = $false
for ($i = 1; $i -le 20 -and -not $gelukt; $i++){
  Start-Sleep -Seconds 60
  Write-Host "  poging $i …"
  $gelukt = Probeer "gcloud firestore databases create --database=`"(default)`" --location=$REGIO --type=firestore-native --project=$PROJECT"
}
if (-not $gelukt){ Stop-Met "(default) kon na 20 minuten niet opnieuw worden aangemaakt. De gegevens staan veilig in $TIJDELIJK." }
Ok "(default) staat nu in $REGIO"
Run "firebase deploy --only firestore:indexes --project $PROJECT"

# ---------- 9. kopie B ----------
Stap 9 "Database terugkopiëren: $TIJDELIJK → (default)"
Run "node tools/migreer-eu.mjs firestore --van=$TIJDELIJK --naar=`"(default)`""
Run "node tools/migreer-eu.mjs controle --van=$TIJDELIJK --naar=`"(default)`""
Ok 'kopie B is gelijk'

# ---------- 10. rules en nieuwe app live ----------
Stap 10 'Rules en nieuwe app live'
Run "firebase deploy --only firestore:rules --project $PROJECT"
Run 'git fetch origin'
git checkout -- package-lock.json functions/package-lock.json 2>$null   # npm install wijzigt deze; niet relevant
Run 'git checkout main'
Run 'git pull origin main'
Run 'git merge --no-edit origin/eu-database'
Run 'git push origin main'
Ok 'app staat binnen een paar minuten live (GitHub Pages)'

# ---------- 11. functies ----------
Stap 11 'Functies opnieuw deployen (trigger aan de nieuwe database)'
Push-Location functions
Run "firebase deploy --only functions --project $PROJECT --force"
Pop-Location
foreach ($f in 'aggregeergebruik','platformoverzichtnu','meldclubaan','beoordeelclubaanmelding'){
  Run "gcloud run services add-iam-policy-binding $f --region=$REGIO --member=allUsers --role=roles/run.invoker --project=$PROJECT --quiet"
}

# ---------- 12. oude bucket dicht ----------
Stap 12 'Oude bucket (VS) dicht'
Run 'node tools/migreer-eu.mjs storage'
Run "firebase deploy --only storage:oud --project $PROJECT"

Write-Host "`n=== Klaar: Cluppie staat in de EU ===" -ForegroundColor Green
Write-Host '  Test: inloggen, een team openen, een video of PDF openen, iets uploaden, Platform → Vernieuwen.'
Write-Host "  Na een week zonder problemen opruimen: gcloud firestore databases delete --database=$TIJDELIJK --project=$PROJECT"
