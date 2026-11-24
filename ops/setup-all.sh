#!/usr/bin/env bash
# 여러 계정을 한 번에 준비합니다 (예: 여러 사람이 각자 계정으로 실습할 때).
#   ./ops/setup-all.sh ops/accounts.csv
# CSV 형식: account_id,api_token,label (첫 줄은 제목). 토큰이 들어 있으니 커밋하지 않습니다.
set -uo pipefail
OPS_DIR="$(cd "$(dirname "$0")" && pwd)"

CSV="${1:-}"
if [ -z "$CSV" ] || [ ! -f "$CSV" ]; then
  echo "사용법: ./ops/setup-all.sh ops/accounts.csv" >&2
  exit 1
fi

results=()
failed=0
while IFS=, read -r account_id api_token label || [ -n "$account_id" ]; do
  account_id=$(echo "$account_id" | tr -d '[:space:]'); api_token=$(echo "$api_token" | tr -d '[:space:]'); label=$(echo "$label" | tr -d '\r')
  if [ -z "$account_id" ] || [ "$account_id" = "account_id" ]; then continue; fi

  echo; echo "━━━ ${label:-$account_id} ━━━"
  # 계정마다 환경 변수를 바꿔서 실행합니다. 토큰은 화면에 찍지 않습니다.
  if CLOUDFLARE_ACCOUNT_ID="$account_id" CLOUDFLARE_API_TOKEN="$api_token" "$OPS_DIR/setup-account.sh" </dev/null \
    && CLOUDFLARE_ACCOUNT_ID="$account_id" CLOUDFLARE_API_TOKEN="$api_token" "$OPS_DIR/verify.sh" </dev/null; then
    results+=("✓ 성공|${label}|${account_id:0:6}…")
  else
    results+=("✗ 실패|${label}|${account_id:0:6}…")
    failed=$((failed + 1))
  fi
done < "$CSV"

echo; echo "━━━ 결과 ━━━"
printf '%-8s %-12s %s\n' "결과" "label" "계정"
for row in "${results[@]}"; do
  IFS='|' read -r status label account <<< "$row"
  printf '%-8s %-12s %s\n' "$status" "$label" "$account"
done
echo "전체 ${#results[@]}개 중 실패 ${failed}개"
[ "$failed" -eq 0 ]
