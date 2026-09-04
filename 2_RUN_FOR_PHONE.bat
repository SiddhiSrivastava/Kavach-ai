@echo off
title Kavach AI - phone demo
cd /d "%~dp0"
echo Checking dependency...
python -m pip install cryptography --quiet
echo.
python 2_RUN_FOR_PHONE.py
echo.
echo Server stopped.
pause
