@echo off
chcp 65001 >nul
title Global Mobilya — Canli Sosyal Medya Yayinci (Instagram 3'lu Grid ^& Facebook)
cd /d "%~dp0publisher"
echo ============================================================================
echo   GLOBAL MOBILYA — CANLI SOSYAL MEDYA YAYIN MOTORU BASLATILIYOR...
echo   Mod: CANLI YAYIN AKTIF (DRY_RUN=false, ENABLE_LIVE_PUBLISHING=true)
echo ============================================================================
node --env-file=..\vps_backup\publisher.env --env-file=..\..\.env.local index.js
pause
