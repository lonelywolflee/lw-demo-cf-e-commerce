#!/usr/bin/env bash
# 한 계정에 R2 버킷과 AI Search 인스턴스를 준비합니다. 여러 번 실행해도 됩니다.
#   R2 orange-docs 생성 → docs/policies/*.md 업로드 → AI Search orange-search 생성
set -euo pipefail
source "$(dirname "$0")/common.sh"

require_account

# 1. R2 버킷
if bucket_exists; then
  echo "· R2 버킷 ${BUCKET}: 이미 있음, 건너뜀"
else
  quiet wr r2 bucket create "$BUCKET"
  echo "✓ R2 버킷 ${BUCKET}을 만들었습니다"
fi

# 2. 정책 문서 업로드. 같은 이름이면 덮어씁니다.
count=0
for file in "$DOCS_DIR"/*.md; do
  quiet wr r2 object put "${BUCKET}/$(basename "$file")" --file "$file" --content-type "text/markdown; charset=utf-8" --remote
  count=$((count + 1))
done
echo "✓ 정책 문서 ${count}개를 ${BUCKET}에 올렸습니다"

# 3. AI Search 인스턴스
if instance_exists; then
  echo "· AI Search ${INSTANCE}: 이미 있음, 건너뜀"
  # 문서가 바뀌었을 수 있으니 색인을 다시 요청합니다. 최근에 색인했으면 거절될 수 있는데, 그래도 괜찮습니다.
  wr ai-search jobs create "$INSTANCE" >/dev/null 2>&1 && echo "✓ 색인을 다시 요청했습니다" || echo "· 색인 재요청은 건너뜀 (방금 색인했거나 진행 중)"
else
  quiet wr ai-search create "$INSTANCE" --type r2 --source "$BUCKET"
  echo "✓ AI Search ${INSTANCE}를 만들었습니다 (데이터 소스: R2 ${BUCKET})"
fi

echo "색인은 2분쯤 걸리고 그동안 다음 단계를 진행해도 됩니다. 끝났는지 보려면 ./ops/verify.sh"
