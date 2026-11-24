#!/usr/bin/env bash
# 계정이 4단계를 할 준비가 됐는지 확인합니다.
#   1. 문서 5개가 색인될 때까지 기다림 (30초 간격, 최대 10분)
#   2. 테스트 질문 3개를 검색해 기대한 문서가 맨 위에 나오는지 확인
set -euo pipefail
source "$(dirname "$0")/common.sh"

EXPECTED_DOCS=$(ls "$DOCS_DIR"/*.md | wc -l | tr -d ' ')
INTERVAL=30
MAX_WAIT=600

require_account
if ! instance_exists; then
  echo "✗ AI Search ${INSTANCE}가 없습니다. 먼저 npm run setup:docs 를 실행하세요" >&2
  exit 1
fi

# 통계에서 숫자 하나를 꺼냅니다. 예: stat completed
stat() { echo "$STATS" | KEY="$1" node -e 'let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => { try { console.log(JSON.parse(s)[process.env.KEY] ?? 0); } catch { console.log(0); } });'; }

# 1. 색인 완료까지 기다리기
start=$(date +%s)
while true; do
  STATS=$(wr ai-search stats "$INSTANCE" --json 2>/dev/null || echo "{}")
  completed=$(stat completed); queued=$(stat queued); running=$(stat running); failed=$(stat error)
  elapsed=$(( $(date +%s) - start ))
  echo "· 색인 ${completed}/${EXPECTED_DOCS} (대기 ${queued}, 진행 ${running}, 오류 ${failed}) — ${elapsed}초"
  if [ "$completed" -ge "$EXPECTED_DOCS" ] && [ "$queued" -eq 0 ] && [ "$running" -eq 0 ]; then break; fi
  if [ "$elapsed" -ge "$MAX_WAIT" ]; then
    echo "✗ ${MAX_WAIT}초가 지나도 색인이 끝나지 않았습니다. 대시보드 AI > AI Search > ${INSTANCE} > Jobs를 확인하세요" >&2
    exit 1
  fi
  sleep "$INTERVAL"
done
echo "✓ 문서 ${completed}개 색인 완료 (기다린 시간 ${elapsed}초)"

# 2. 테스트 질문. "질문|맨 위에 나와야 하는 문서"
TESTS=(
  "제주도 배송비|shipping.md"
  "개봉한 상품 환불|returns.md"
  "골드 등급 혜택|membership.md"
)
failures=0
printf '\n%-6s %-18s %-16s %s\n' "결과" "기대" "1위" "질문"
for test in "${TESTS[@]}"; do
  query="${test%%|*}"; expected="${test##*|}"
  top=$(wr ai-search search "$INSTANCE" --query "$query" --json 2>/dev/null | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try {
        const data = JSON.parse(s);
        const chunk = (data.chunks ?? data.data ?? [])[0];
        console.log(chunk?.item?.key ?? chunk?.filename ?? "(결과 없음)");
      } catch { console.log("(검색 실패)"); }
    });')
  if [ "$top" = "$expected" ]; then mark="✓"; else mark="✗"; failures=$((failures + 1)); fi
  printf '%-6s %-18s %-16s %s\n' "$mark" "$expected" "$top" "$query"
done

if [ "$failures" -gt 0 ]; then
  echo "✗ 기대와 다른 검색 결과가 ${failures}건 있습니다" >&2
  exit 1
fi
echo "✓ 이 계정은 4단계를 할 준비가 됐습니다"
