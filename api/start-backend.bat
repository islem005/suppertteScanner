@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "D:\projects\suppertteScanner\api"
npx.cmd wrangler dev --port 3002
