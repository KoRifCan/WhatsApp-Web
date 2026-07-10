#!/bin/bash
git pull
cd server && npm install --cache /tmp/npm-cache
cd ../client && npm install --cache /tmp/npm-cache && npm run build
pm2 restart whatsapp-web
