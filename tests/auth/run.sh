#!/usr/bin/env bash
set -euo pipefail
# Run from the repository root via firebase emulators:exec (demo project only).
: "${FIRESTORE_EMULATOR_HOST:?Start the Firestore emulator first}"
: "${FIREBASE_AUTH_EMULATOR_HOST:?Start the Auth emulator first}"
mkdir -p work
export BLOOM_AUTH_TEST_PORT="${BLOOM_AUTH_TEST_PORT:-4191}"
if curl -fsS --max-time 1 "http://127.0.0.1:$BLOOM_AUTH_TEST_PORT" >/dev/null 2>&1; then
  echo "Auth test port $BLOOM_AUTH_TEST_PORT is already in use; choose BLOOM_AUTH_TEST_PORT." >&2
  exit 1
fi
VITE_FIREBASE_API_KEY=demo-key \
VITE_FIREBASE_AUTH_DOMAIN=demo-bloom-auth.firebaseapp.com \
VITE_FIREBASE_PROJECT_ID=demo-bloom-auth \
VITE_FIREBASE_APP_ID=demo-app \
VITE_USE_FIREBASE_EMULATORS=true \
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port "$BLOOM_AUTH_TEST_PORT" --strictPort > work/auth-vite.log 2>&1 &
vite_pid=$!
trap 'kill "$vite_pid" 2>/dev/null || true' EXIT
for attempt in {1..30}; do
  if ! kill -0 "$vite_pid" 2>/dev/null; then cat work/auth-vite.log; exit 1; fi
  if curl -fsS "http://127.0.0.1:$BLOOM_AUTH_TEST_PORT" >/dev/null 2>&1; then break; fi
  sleep 1
done
kill -0 "$vite_pid"
node tests/auth/smoke.mjs
