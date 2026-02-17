#!/usr/bin/env bash
# Run test suites against a fresh database.
# Usage: ./scripts/test-fresh.sh [test-file...]
# If no test files specified, runs all test suites.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_DIR="$PROJECT_ROOT/data"
PORT=3141
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

kill_port() {
  local pids
  pids=$(lsof -ti:"$PORT" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}

start_server() {
  rm -rf "$DB_DIR"
  npx tsx "$PROJECT_ROOT/server/src/index.ts" &
  SERVER_PID=$!

  # Poll health endpoint until ready (max 10 seconds)
  local attempts=0
  while ! curl -sf "http://localhost:$PORT/api/health" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ $attempts -ge 20 ]; then
      echo "FAIL: Server did not start within 10 seconds"
      exit 1
    fi
    sleep 0.5
  done
}

stop_server() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
    SERVER_PID=""
  fi
}

# Default test suites in run order
DEFAULT_SUITES=(
  "server/src/seed-test.ts"
  "server/src/test-error-handling.ts"
  "server/src/test-word-updates.ts"
  "server/src/test-cascade-and-list.ts"
  "server/src/test-backfill-edges.ts"
  "server/src/test-attempts-and-export.ts"
)

# Use provided files or defaults
if [ $# -gt 0 ]; then
  SUITES=("$@")
else
  SUITES=("${DEFAULT_SUITES[@]}")
fi

echo "=== Test Runner ==="
echo ""

kill_port

passed=0
failed=0

for suite in "${SUITES[@]}"; do
  suite_path="$PROJECT_ROOT/$suite"
  if [ ! -f "$suite_path" ]; then
    echo "SKIP: $suite (file not found)"
    continue
  fi

  echo "--- Running: $suite ---"
  kill_port
  start_server

  if npx tsx "$suite_path"; then
    passed=$((passed + 1))
  else
    failed=$((failed + 1))
    echo "FAIL: $suite"
  fi

  stop_server
  echo ""
done

echo "=== Results: $passed passed, $failed failed ==="

if [ $failed -gt 0 ]; then
  exit 1
fi
