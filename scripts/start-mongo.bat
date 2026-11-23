@echo off
rem scripts/start-mongo.bat
rem Starts the dedicated SkillSwap MongoDB replica set on port 27018.

where docker >nul 2>nul
if %ERRORLEVEL% equ 0 (
  docker start skillswap_mongodb >nul 2>nul
  if %ERRORLEVEL% equ 0 (
    echo [SkillSwap] skillswap_mongodb container started on port 27018 (replica set rs0).
    exit /b 0
  )
  docker run -d --name skillswap_mongodb -p 27018:27017 -v D:\mongo-skillswap\data:/data/db mongo:6.0 mongod --replSet rs0 --bind_ip_all
  if %ERRORLEVEL% equ 0 (
    echo [SkillSwap] skillswap_mongodb container created and started on port 27018 (replica set rs0).
    exit /b 0
  )
)

rem Fallback to native mongod if installed
echo [SkillSwap] Starting native mongod replica set on port 27018...
mongod --replSet rs0 --port 27018 --dbpath D:\mongo-skillswap\data --bind_ip 127.0.0.1

