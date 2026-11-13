#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=================================================="
echo " 🚀 Starting Google Maps Lead Scanner PRO"
echo "=================================================="

# Free port 3001 if occupied
PID=$(lsof -ti:3001 2>/dev/null || true)
if [ -n "$PID" ]; then
  echo "⚠️ Freeing existing process on port 3001 (PID: $PID)..."
  kill -9 $PID 2>/dev/null || true
  sleep 1
fi

export PORT=3001

# Automatically open the browser once server is up
(
  sleep 2
  if which xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:3001" >/dev/null 2>&1 || true
  elif which google-chrome >/dev/null 2>&1; then
    google-chrome "http://localhost:3001" >/dev/null 2>&1 || true
  elif which brave-browser >/dev/null 2>&1; then
    brave-browser "http://localhost:3001" >/dev/null 2>&1 || true
  fi
) &

echo "🌐 Web Dashboard: http://localhost:3001"
echo "💡 Press Ctrl+C anytime to stop."
echo "=================================================="
echo ""

exec node backend/server.js
