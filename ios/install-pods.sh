#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

export PATH="/bin:/usr/bin:/sbin:/usr/sbin:/usr/local/bin:/opt/homebrew/bin:${HOME}/.gem/ruby/2.6.0/bin:${HOME}/.nvm/versions/node/v24.13.0/bin:${PATH}"

ART_DIR="$(pwd)/.hermes-artifacts"
DEBUG_TGZ="${ART_DIR}/hermes-ios-0.76.5-debug.tar.gz"
RELEASE_TGZ="${ART_DIR}/hermes-ios-0.76.5-release.tar.gz"
BASE="https://repo.maven.apache.org/maven2/com/facebook/react/react-native-artifacts/0.76.5"
mkdir -p "${ART_DIR}"

if [[ ! -f "${DEBUG_TGZ}" ]]; then
  echo "Downloading Hermes debug tarball..."
  curl -L --fail -o "${DEBUG_TGZ}" "${BASE}/react-native-artifacts-0.76.5-hermes-ios-debug.tar.gz"
fi
if [[ ! -f "${RELEASE_TGZ}" ]]; then
  echo "Downloading Hermes release tarball..."
  curl -L --fail -o "${RELEASE_TGZ}" "${BASE}/react-native-artifacts-0.76.5-hermes-ios-release.tar.gz"
fi

export HERMES_ENGINE_TARBALL_PATH="${DEBUG_TGZ}"
pod install
