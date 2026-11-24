#!/usr/bin/env bash
# AI Search 인스턴스와 R2 버킷을 지웁니다 (처음부터 다시 해 볼 때). 인스턴스 → 버킷 순서.
#   ./ops/teardown.sh        지우기 전에 물어봄
#   ./ops/teardown.sh --yes  묻지 않고 지움
set -euo pipefail
source "$(dirname "$0")/common.sh"

require_account

if [ "${1:-}" != "--yes" ]; then
  read -r -p "AI Search ${INSTANCE}와 R2 버킷 ${BUCKET}(안의 문서 포함)을 지웁니다. 계속할까요? (y/N) " answer
  if [ "$answer" != "y" ] && [ "$answer" != "Y" ]; then
    echo "취소했습니다"
    exit 0
  fi
fi

if instance_exists; then
  quiet wr ai-search delete "$INSTANCE" --force
  echo "✓ AI Search ${INSTANCE}를 지웠습니다"
else
  echo "· AI Search ${INSTANCE}: 없음, 건너뜀"
fi

if bucket_exists; then
  # 버킷은 비어 있어야 지워집니다. 올린 문서를 먼저 지웁니다.
  for file in "$DOCS_DIR"/*.md; do
    quiet wr r2 object delete "${BUCKET}/$(basename "$file")" --remote || true
  done
  quiet wr r2 bucket delete "$BUCKET"
  echo "✓ R2 버킷 ${BUCKET}을 지웠습니다"
else
  echo "· R2 버킷 ${BUCKET}: 없음, 건너뜀"
fi
