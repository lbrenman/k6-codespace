#!/usr/bin/env bash
# Installs k6 into /usr/local/bin.
# Set K6_VERSION (e.g. v1.2.0) to pin a version; default is the latest release.
set -euo pipefail

K6_VERSION="${K6_VERSION:-latest}"

if [[ "$K6_VERSION" == "latest" ]]; then
  K6_VERSION="$(curl -fsSLI -o /dev/null -w '%{url_effective}' https://github.com/grafana/k6/releases/latest | sed 's#.*/tag/##')"
fi

case "$(uname -m)" in
  x86_64)        ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

PKG="k6-${K6_VERSION}-linux-${ARCH}"
URL="https://github.com/grafana/k6/releases/download/${K6_VERSION}/${PKG}.tar.gz"

echo "Installing k6 ${K6_VERSION} (${ARCH})..."
TMP="$(mktemp -d)"
curl -fsSL "$URL" | tar xz -C "$TMP"
sudo install -m 0755 "$TMP/$PKG/k6" /usr/local/bin/k6
rm -rf "$TMP"

# jq is used by bin/k6results
if ! command -v jq >/dev/null 2>&1; then
  sudo apt-get update -qq && sudo apt-get install -y -qq jq
fi

k6 version
