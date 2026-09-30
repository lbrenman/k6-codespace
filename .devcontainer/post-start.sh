#!/usr/bin/env bash
# Runs every time the Codespace starts. Reminds you about unsaved work.
cd "$(dirname "$0")/.." || exit 0

echo "k6: $(k6 version 2>/dev/null | head -n1 || echo 'not installed - run: bash .devcontainer/install-k6.sh')"

pending="$(git status --porcelain -- scripts lib templates results 2>/dev/null | wc -l | tr -d ' ')"
unpushed="$(git log --oneline '@{u}..HEAD' 2>/dev/null | wc -l | tr -d ' ')"

if [[ "${pending:-0}" != "0" || "${unpushed:-0}" != "0" ]]; then
  echo "Note: ${pending} uncommitted and ${unpushed} unpushed change(s)."
  echo "      Run 'k6save' to push them to GitHub so they survive Codespace deletion."
fi
exit 0
