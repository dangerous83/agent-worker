@echo off
cd /d "%~dp0"
echo When the terminal is ready, type /login to connect your model.
node --env-file-if-exists=.env.local node_modules/eve/bin/eve.js dev --no-default-extensions
pause
