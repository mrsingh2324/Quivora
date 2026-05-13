#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_ENV_FILE="$ROOT_DIR/api/.env"
AI_ENV_FILE="$ROOT_DIR/services/ai-orchestrator/.env"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

read_env_value() {
  local file="$1"
  local name="$2"

  if [[ -n "${!name:-}" ]]; then
    printf '%s' "${!name}"
    return
  fi

  if [[ -f "$file" ]]; then
    awk -F= -v key="$name" '
      $0 !~ /^[[:space:]]*#/ && $1 == key {
        value = substr($0, index($0, "=") + 1)
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
        gsub(/^["'\''"]|["'\''"]$/, "", value)
        print value
        exit
      }
    ' "$file"
  fi
}

require_env_file() {
  local file="$1"
  local example="$2"

  if [[ ! -f "$file" ]]; then
    echo "Missing env file: $file"
    echo "Create it from: $example"
    exit 1
  fi
}

require_env_var() {
  local file="$1"
  local name="$2"
  local value

  value="$(read_env_value "$file" "$name")"
  if [[ -z "$value" ]]; then
    echo "Missing required env var: $name"
    echo "Add it to: $file"
    exit 1
  fi

  if [[ "$value" == your_* || "$value" == "change_me" || "$value" == "CHANGE_ME" ]]; then
    echo "Placeholder value found for required env var: $name"
    echo "Update it in: $file"
    exit 1
  fi
}

cleanup() {
  if [[ -n "${API_PID:-}" ]]; then kill "$API_PID" >/dev/null 2>&1 || true; fi
  if [[ -n "${AI_PID:-}" ]]; then kill "$AI_PID" >/dev/null 2>&1 || true; fi
  if [[ -n "${ADMIN_PID:-}" ]]; then kill "$ADMIN_PID" >/dev/null 2>&1 || true; fi
  if [[ -n "${PLAYER_PID:-}" ]]; then kill "$PLAYER_PID" >/dev/null 2>&1 || true; fi
}

trap cleanup EXIT INT TERM

require_command npm
require_env_file "$API_ENV_FILE" "$ROOT_DIR/api/.env.example"
require_env_file "$AI_ENV_FILE" "$ROOT_DIR/services/ai-orchestrator/.env.example"

require_env_var "$API_ENV_FILE" "MONGODB_URI"
require_env_var "$API_ENV_FILE" "AI_SERVICE_URL"
require_env_var "$AI_ENV_FILE" "GEMINI_API_KEY"

echo "Starting Quivora app..."
echo "API:          http://localhost:4000"
echo "AI Service:   http://localhost:4100"
echo "Admin App:    http://localhost:3000"
echo "Player App:   http://localhost:3001"
echo
echo "Required env vars checked:"
echo "  api/.env: MONGODB_URI, AI_SERVICE_URL"
echo "  services/ai-orchestrator/.env: GEMINI_API_KEY"
echo
echo "Optional env vars:"
echo "  api/.env: PORT, CLIENT_URL, PLAYER_URL"
echo "  services/ai-orchestrator/.env: PORT, GEMINI_MODEL"
echo "  apps/web-admin/.env: VITE_API_URL, VITE_SOCKET_URL"
echo "  apps/web-player/.env: VITE_API_URL, VITE_SOCKET_URL"
echo

cd "$ROOT_DIR"

npm --workspace api run start &
API_PID=$!

npm --workspace services/ai-orchestrator run start &
AI_PID=$!

npm --workspace apps/web-admin run dev &
ADMIN_PID=$!

npm --workspace apps/web-player run dev &
PLAYER_PID=$!

echo "All services started. Press Ctrl+C to stop."
wait
