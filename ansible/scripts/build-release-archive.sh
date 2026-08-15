#!/usr/bin/env bash
# Build pd-fade on the controller and pack a release archive for bare-metal deploy.
# Writes release metadata to ${OUTPUT_DIR}/release-meta.json (release_id, archive, checksum).
set -euo pipefail

REPO_ROOT="$(cd "${1:?repo root required}" && pwd)"
mkdir -p "${2:?output dir required}"
OUTPUT_DIR="$(cd "${2}" && pwd)"
RELEASE_ID="${3:-}"
META_FILE="${OUTPUT_DIR}/release-meta.json"

if [[ -z "${RELEASE_ID}" ]]; then
  if git -C "${REPO_ROOT}" rev-parse --short HEAD >/dev/null 2>&1; then
    RELEASE_ID="$(git -C "${REPO_ROOT}" rev-parse --short HEAD)"
  else
    RELEASE_ID="$(date -u +%Y%m%dT%H%M%SZ)"
  fi
fi

STAGING="${OUTPUT_DIR}/staging-${RELEASE_ID}"
ARCHIVE="${OUTPUT_DIR}/pd-fade-${RELEASE_ID}.tar.gz"

rm -rf "${STAGING}"
mkdir -p "${STAGING}" "${OUTPUT_DIR}"

cd "${REPO_ROOT}"
pnpm install --frozen-lockfile >&2
pnpm build >&2

cp "${REPO_ROOT}/package.json" "${STAGING}/package.json"
cp "${REPO_ROOT}/pnpm-lock.yaml" "${STAGING}/pnpm-lock.yaml"
cp "${REPO_ROOT}/pnpm-workspace.yaml" "${STAGING}/pnpm-workspace.yaml"

mkdir -p "${STAGING}/shared" "${STAGING}/server" "${STAGING}/client"
cp "${REPO_ROOT}/shared/package.json" "${STAGING}/shared/package.json"
cp "${REPO_ROOT}/server/package.json" "${STAGING}/server/package.json"
cp "${REPO_ROOT}/client/package.json" "${STAGING}/client/package.json"

copy_release_dist() {
  local pkg="$1"
  mkdir -p "${STAGING}/${pkg}/dist"
  rsync -a \
    --exclude='*.test.js' \
    --exclude='*.test.js.map' \
    --exclude='*.test.d.ts' \
    --exclude='*.test.d.ts.map' \
    --exclude='test-helpers.*' \
    "${REPO_ROOT}/${pkg}/dist/" "${STAGING}/${pkg}/dist/"
}

copy_release_dist shared
copy_release_dist server
cp -R "${REPO_ROOT}/client/dist" "${STAGING}/client/dist"

printf '%s\n' "${RELEASE_ID}" > "${STAGING}/RELEASE_ID"

tar -C "${STAGING}" -czf "${ARCHIVE}" .

if command -v shasum >/dev/null 2>&1; then
  CHECKSUM="$(shasum -a 256 "${ARCHIVE}" | awk '{print $1}')"
elif command -v sha256sum >/dev/null 2>&1; then
  CHECKSUM="$(sha256sum "${ARCHIVE}" | awk '{print $1}')"
else
  echo "sha256 tool not found" >&2
  exit 1
fi

rm -rf "${STAGING}"

printf '%s\n' "{\"release_id\":\"${RELEASE_ID}\",\"archive\":\"${ARCHIVE}\",\"checksum\":\"${CHECKSUM}\"}" > "${META_FILE}"
