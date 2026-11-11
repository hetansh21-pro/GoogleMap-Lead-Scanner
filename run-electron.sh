#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=================================================="
echo " 🖥️ Launching Google Maps Lead Scanner Desktop App"
echo "=================================================="

# Free port 3000 if occupied
PID=$(lsof -ti:3000 2>/dev/null || true)
if [ -n "$PID" ]; then
  kill -9 $PID 2>/dev/null || true
  sleep 1
fi

exec npx electron --no-sandbox .
