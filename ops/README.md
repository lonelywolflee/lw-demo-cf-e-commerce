# 정책 문서와 AI Search 준비하기

README 4단계(블록 B)는 계정에 아래 두 리소스가 **이미 있어야** 배포됩니다.

| 리소스 | 이름 | 내용 |
| --- | --- | --- |
| R2 버킷 | `orange-docs` | `docs/policies/*.md` 5종 |
| AI Search 인스턴스 | `orange-search` | 데이터 소스 = R2 `orange-docs`, `default` namespace |

**README 1단계에서 `npm run setup:docs`로 만듭니다.** 이 명령은 `./ops/setup-account.sh`를 실행합니다. 로그인한 wrangler로 돌기 때문에 토큰이 필요 없고, 색인은 2분쯤 걸려 4단계 전에 끝납니다.

아래는 스크립트를 직접 실행하거나, 여러 계정을 한 번에 준비할 때의 안내입니다.

## 준비물

- Node.js 22 이상, 이 레포에서 `npm ci`
- `npx wrangler login`으로 로그인 (원격 컨테이너나 SSH 환경이면 `npx wrangler login --device`)
- 로그인한 사용자에게 계정이 여러 개면 대상 계정의 **Account ID**. 스크립트가 계정 목록을 보여 주고 멈추니 그중 하나를 `CLOUDFLARE_ACCOUNT_ID`로 넣습니다
- 여러 계정을 한 번에 준비할 때만: 계정마다 **API 토큰** — 권한: Account > Workers R2 Storage: Edit, Account > AI Search: Edit, Account > AI Search: Run

## 한 계정 준비하기

```bash
export CLOUDFLARE_ACCOUNT_ID=<account id>   # 계정이 하나면 생략
export CLOUDFLARE_API_TOKEN=<api token>      # wrangler login을 썼다면 생략

./ops/setup-account.sh   # R2 생성 → 문서 업로드 → AI Search 생성 (= npm run setup:docs)
./ops/verify.sh          # 색인 상태 확인 → 테스트 질문 검색
```

`setup-account.sh`는 이미 있는 리소스는 건너뛰므로 여러 번 실행해도 됩니다. 내부에서 하는 일은 아래와 같습니다.

```bash
npx wrangler r2 bucket create orange-docs
npx wrangler r2 object put orange-docs/shipping.md --file docs/policies/shipping.md --content-type "text/markdown; charset=utf-8" --remote
# ... 5종 모두
npx wrangler ai-search create orange-search --type r2 --source orange-docs
```

> 계정에서 R2를 데이터 소스로 쓰는 AI Search 인스턴스를 처음 만들 때는 AI Search용 service API token이 필요합니다. 대시보드나 Wrangler로 만들면 자동으로 등록됩니다. REST API로 직접 만들 때는 [Service API token](https://developers.cloudflare.com/ai-search/configuration/indexing/service-api-token/)을 먼저 등록해야 합니다.

## 확인하기

`verify.sh`가 통과하면 그 계정은 준비가 끝난 것입니다. 직접 확인하려면:

```bash
npx wrangler ai-search stats orange-search                     # 색인된 문서 5개인지
npx wrangler ai-search search orange-search --query "제주도 배송비"   # shipping.md가 나오는지
```

| 테스트 질문 | 맨 위에 나와야 하는 문서 |
| --- | --- |
| 제주도 배송비 | `shipping.md` |
| 개봉한 상품 환불 | `returns.md` |
| 골드 등급 혜택 | `membership.md` |


## 여러 계정을 한 번에 준비하기 (선택)

여러 사람이 각자 계정으로 실습할 때처럼 계정을 미리 준비해 둘 때 씁니다.

`ops/accounts.csv`에 계정 목록을 적고 한 번에 돌립니다. 이 파일에는 토큰이 들어가므로 **커밋하지 않습니다** (`.gitignore`에 들어 있음).

```text
account_id,api_token,label
abc123...,cf_xxx...,seat-01
```

```bash
./ops/setup-all.sh ops/accounts.csv    # 계정마다 setup-account → verify, 결과 표 출력
```

## 지우기

```bash
./ops/teardown.sh          # orange-search, orange-docs 삭제. 지우기 전에 물어봅니다
./ops/teardown.sh --yes    # 묻지 않고 삭제
```

R2는 버킷을 지운 뒤 1분 동안 같은 이름으로 다시 만들 수 없습니다(`code: 10073`). 지운 직후 `npm run setup:docs`가 이 오류로 멈추면 1분 뒤 다시 실행하세요.
