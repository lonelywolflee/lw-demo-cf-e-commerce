# ops 스크립트들이 같이 쓰는 값과 함수. 직접 실행하지 않고 다른 스크립트가 불러옵니다.

BUCKET="orange-docs"       # 정책 문서를 올리는 R2 버킷
INSTANCE="orange-search"   # 그 버킷을 색인하는 AI Search 인스턴스 (README 4단계의 instance_name)
DOCS_DIR="docs/policies"

# 어느 폴더에서 실행해도 레포 맨 위에서 동작하게 합니다.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

wr() { npx wrangler "$@"; }

# 명령의 출력을 숨기고, 실패했을 때만 보여 줍니다.
quiet() {
  local output
  if ! output=$("$@" 2>&1); then
    echo "$output" >&2
    return 1
  fi
}

# 대상 계정 확인. 토큰과 계정 ID는 환경 변수로만 받고 파일에 쓰지 않습니다.
require_account() {
  if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
    local me
    if ! me=$(wr whoami --json 2>/dev/null); then
      echo "✗ 로그인되어 있지 않습니다. npx wrangler login 을 실행하세요 (컨테이너 안이면 npx wrangler login --device)" >&2
      exit 1
    fi
    # 로그인한 사용자에게 계정이 여러 개면 어느 계정인지 정할 수 없으니 멈춥니다.
    if ! echo "$me" | node -e '
      let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
        const accounts = JSON.parse(s).accounts ?? [];
        if (accounts.length === 1) { console.log(`· 로그인된 계정을 씁니다: ${accounts[0].name}`); return; }
        console.error(`✗ 이 로그인에는 계정이 ${accounts.length}개 있습니다. 쓸 계정을 정해 주세요:`);
        for (const a of accounts) console.error(`    ${a.id}  ${a.name}`);
        console.error("  export CLOUDFLARE_ACCOUNT_ID=<위의 id> 를 실행한 뒤 다시 실행하세요");
        process.exit(1);
      });'; then
      exit 1
    fi
  else
    echo "· 대상 계정: ${CLOUDFLARE_ACCOUNT_ID:0:6}…"
  fi
}

bucket_exists() { wr r2 bucket list 2>/dev/null | grep -Eq "^name:[[:space:]]+${BUCKET}$"; }

instance_exists() {
  wr ai-search list --json 2>/dev/null | INSTANCE="$INSTANCE" node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      let list = []; try { list = JSON.parse(s); } catch {}
      process.exit(Array.isArray(list) && list.some((i) => i.id === process.env.INSTANCE) ? 0 : 1);
    });'
}
