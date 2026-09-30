#!/usr/bin/env bash
# Runs once when the Codespace is created or rebuilt.
set -euo pipefail
cd "$(dirname "$0")/.."

bash .devcontainer/install-k6.sh

# k6 type definitions for IntelliSense in VS Code
if command -v npm >/dev/null 2>&1; then
  npm install --no-audit --no-fund --silent
fi

# Local env file (never committed)
[[ -f .env ]] || cp .env.example .env

chmod +x bin/* .devcontainer/*.sh
echo "Setup complete. Run 'k6run smoke' to try it out."
