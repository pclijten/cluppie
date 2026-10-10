@echo off
REM Cluppie - deploy naar Firebase-project cluppie-ad329 (eenmalig: login + secret)
REM Vereist Node 22 (https://nodejs.org). Draai dit bestand in de map van de repo.
call npm i -g firebase-tools || goto :err
call firebase login || goto :err
call firebase use cluppie-ad329 || goto :err
echo.
echo Plak straks je Anthropic API-sleutel als hij erom vraagt (sla over met Ctrl+C als je AI nog niet wilt).
call firebase functions:secrets:set ANTHROPIC_API_KEY
pushd functions && call npm ci && popd
call firebase deploy --only functions,firestore:indexes || goto :err
echo Klaar.
goto :eof
:err
echo Mislukt - stuur de foutmelding naar Claude.
exit /b 1
