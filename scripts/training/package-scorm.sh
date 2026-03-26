#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD_DIR="${ROOT_DIR}/training-build/iso42001foundation"
ZIP_PATH="${ROOT_DIR}/training-build/iso42001foundation-scorm.zip"

node "${ROOT_DIR}/scripts/training/build-iso42001foundation-scorm.mjs"
rm -f "${ZIP_PATH}"
cd "${BUILD_DIR}"
zip -qr "${ZIP_PATH}" .
