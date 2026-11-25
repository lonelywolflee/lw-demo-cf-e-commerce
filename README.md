# 🍊 오렌지마켓 — 서버 0대. AI 상담원이 있는 쇼핑몰 만들기

Cloudflare 개발자 플랫폼으로 AI 기능이 있는 서비스를 만들어 보는 튜토리얼입니다.

오렌지마켓은 여러 상점이 입점한 가상 쇼핑몰입니다. 여러분은 오렌지마켓에 내 상점을 하나 열고, AI 에이전트로 상점을 꾸민 다음, 오렌지마켓 공통 규정을 근거로 답하는 AI 상담원을 붙입니다. 모든 것이 Cloudflare 위에서 돌아가고, 서버는 한 대도 없습니다.

| 단계 | 하는 일 | 예상 시간 |
| --- | --- | --- |
| [1](#1단계-템플릿-배포) | 템플릿을 그대로 배포하고, 4단계에서 쓸 정책 문서를 올려 둔다 | 11분 |
| [2](#2단계-내-상점-만들기) | AI 에이전트로 내 상점의 컨셉·디자인·상품을 만든다 | 13분 |
| [3](#3단계-ai-상담원-붙이기) | 주석 한 쌍을 풀어 AI 상담원을 붙인다 | 6분 |
| [4](#4단계-문서를-근거로-답하게-하기) | 주석 한 쌍을 더 풀어 정책 문서를 근거로 답하게 한다 | 7분 |
| [5](#5단계-대시보드-보기) | 대시보드에서 트래픽·AI 호출·비용을 본다 | 5분 |

만드는 것의 구조는 [ARCHITECTURE.md](ARCHITECTURE.md)에 있습니다.

## 시작하기 전에

필요한 것은 Node.js 22 이상과 Cloudflare 계정입니다. 레포를 내려받고 의존성을 설치한 뒤 Cloudflare에 로그인하세요.

```bash
git clone https://github.com/lonelywolflee/lw-demo-cf-e-commerce.git orange-market
cd orange-market
npm ci
npx wrangler login
npx wrangler whoami
```

- `npm install`이 아니라 `npm ci`입니다. 의존성 목록이 바뀌지 않아야 check가 통과합니다.
- 원격 컨테이너나 SSH처럼 로그인 후 브라우저가 내 컴퓨터(localhost)로 돌아올 수 없는 환경에서는 `npx wrangler login --device`를 쓰세요. 화면에 나온 주소를 브라우저로 열고 코드를 확인해 승인합니다.
- `whoami`에 계정이 여러 개 보이면 쓸 계정의 Account ID로 `export CLOUDFLARE_ACCOUNT_ID=<id>`를 실행해 두세요. 이후 모든 명령이 그 계정을 씁니다.
- 2단계에서 AI 코딩 에이전트를 쓸 때는 편집기에서 `orange-market` 폴더 자체를 여세요. 에이전트가 열린 폴더에서 `AGENTS.md`를 찾습니다.

## 1단계: 템플릿 배포

> 배포는 명령어 하나입니다.

```bash
npm run deploy
```

이 명령이 하는 일은 네 가지입니다.

1. `npm run check` — 고치면 안 되는 파일이 바뀌지 않았는지, 상품 데이터 형식이 맞는지 검사합니다
2. `wrangler deploy` — Worker와 웹페이지를 배포합니다. 처음 배포할 때 **내 계정에 D1 데이터베이스가 자동으로 만들어집니다**. 이때 `wrangler.jsonc`에 `database_id` 한 줄이 생기는데, 정상입니다
3. D1에 테이블을 만듭니다 (`migrations/`)
4. `seed/`의 상점 정보와 상품을 D1에 넣습니다. 매번 새로 넣기 때문에 D1은 항상 `seed/`와 같은 상태가 됩니다

출력에 나오는 `https://orange-market.<내 서브도메인>.workers.dev` 주소를 브라우저로 여세요. 기본 상품이 있는 쇼핑몰이 보이고, 오른쪽 아래에 상담 버튼이 있습니다. 상담 버튼을 눌러 말을 걸면 아직은 "AI 상담원 준비 중"이라는 고정 응답만 나옵니다.

### 4단계 준비: 정책 문서 올리기

4단계에서 AI 상담원이 근거로 삼을 오렌지마켓 공통 규정 5종([docs/policies/](docs/policies/))을 지금 내 계정에 올려 둡니다. 문서를 색인하는 데 시간이 걸려서 미리 해 두는 것입니다.

먼저 AI Search가 R2의 문서를 읽을 때 쓰는 **서비스 API 토큰**을 만듭니다. 계정마다 한 번만 하면 됩니다. [Cloudflare 대시보드](https://dash.cloudflare.com)에서 **AI > AI Search**로 들어가 **API Tokens** 화면을 엽니다(주소는 `https://dash.cloudflare.com/<Account ID>/ai/ai-search/tokens`). **No API tokens found**가 보이면 **Create Token**을 눌러 토큰을 만들고, 목록에 하나 보이면 됩니다. 이미 토큰이 있으면 건너뜁니다. 이 토큰을 지우면 색인이 멈추니 삭제하지 마세요.

그다음 문서를 올립니다.

```bash
npm run setup:docs
```

이 명령은 R2 버킷 `orange-docs`를 만들어 문서를 올리고, 그 버킷을 색인하는 AI Search 인스턴스 `orange-search`를 만듭니다. 색인은 뒤에서 진행되니 끝날 때까지 기다리지 않고 2단계로 넘어가면 됩니다.

**완료 기준** — 내 주소에서 쇼핑몰이 열리고, `npm run setup:docs`가 ✓로 끝난다

## 2단계: 내 상점 만들기

> AI 에이전트에게 규칙을 주면, 그 안에서 안전하게 일합니다.

이 레포에는 AI 에이전트를 위한 규칙 파일이 있습니다.

- [AGENTS.md](AGENTS.md) — 에이전트가 맡는 일과 지킬 것
- [agents/guardrails.md](agents/guardrails.md) — 고쳐도 되는 파일과 안 되는 파일
- [agents/workflows/customize-shop.md](agents/workflows/customize-shop.md) — 상점을 만드는 순서

에이전트 채팅창에 이렇게 말해 보세요.

```text
AGENTS.md를 읽고 내 상점을 만들어 줘.
레트로 게임샵, 8비트 픽셀 분위기, 상품 8개로.
```

상점 종류와 분위기는 마음대로 바꾸세요. 에이전트는 `seed/`의 상점 정보·상품과 `public/`의 디자인만 고치고, 마지막에 `npm run check`를 실행해 결과를 보여 줍니다. check가 통과하면 다시 배포합니다.

```bash
npm run deploy
```

새로고침하면 내 상점이 내 상품으로 보입니다. 상품은 내 계정의 D1에 들어 있습니다.

**완료 기준** — 내 주소에서 내 컨셉의 상점과 상품이 보인다

> 마음에 안 들면 `git restore public seed`로 처음 상태로 돌아간 뒤 다시 시켜 보세요.

## 3단계: AI 상담원 붙이기

> 인프라는 설정이 아니라 바인딩 한 줄입니다.

주석을 두 줄 풉니다. 각 줄 바로 위에 `▼ 블록 A` 표시가 있습니다. 들여쓰기는 그대로 두고 `// `만 지우세요. (VS Code 계열 편집기에서는 줄을 선택하고 `Cmd + /` 또는 `Ctrl + /`)

| 파일 | 풀 줄 | 하는 일 |
| --- | --- | --- |
| `wrangler.jsonc` | `"ai": { "binding": "AI" },` | Worker에 Workers AI를 연결합니다. 코드에서 `env.AI`로 씁니다 |
| `src/chat.ts` | `return answerWithModel(env, input);` | 고정 응답 대신 AI 모델이 답하게 합니다 |

AI 호출은 모두 AI Gateway를 거칩니다. gateway 이름을 `default`로 쓰기 때문에 따로 만들 필요 없이 첫 호출 때 자동으로 생깁니다.

```bash
npm run deploy
```

상담 버튼을 열고 물어보세요.

| 질문 | 어떻게 답하나 |
| --- | --- |
| 여기서 제일 저렴한 상품은? | 내 D1 상품 목록을 보고 정확히 답합니다 |
| 제주도 배송비 얼마예요? | **답하지 못합니다**. 오렌지마켓 배송 규정을 모르기 때문입니다 |
| 개봉한 상품도 환불되나요? | 규정을 모른 채 짐작으로 답하거나, 고객센터에 문의하라고 합니다 |

**완료 기준** — 상품 질문에는 맞게 답하고, 정책 질문에는 제대로 답하지 못한다

## 4단계: 문서를 근거로 답하게 하기

> 답의 근거는 우리 문서입니다.

1단계에서 올린 오렌지마켓 공통 규정 5종([docs/policies/](docs/policies/))이 내 계정의 R2에 있고, AI Search 인스턴스 `orange-search`가 이 문서들을 색인해 두었습니다. 1단계의 `npm run setup:docs`를 건너뛰었다면 지금 실행하고, `./ops/verify.sh`로 색인이 끝났는지 확인한 뒤 진행하세요.

이번에도 주석을 두 줄 풉니다. 각 줄 위에 `▼ 블록 B` 표시가 있습니다.

| 파일 | 풀 줄 | 하는 일 |
| --- | --- | --- |
| `wrangler.jsonc` | `"ai_search": [{ "binding": "SEARCH", "instance_name": "orange-search" }],` | Worker에 AI Search를 연결합니다. 코드에서 `env.SEARCH`로 씁니다 |
| `src/chat.ts` | `return answerWithRouting(env, input);` | 질문을 먼저 분류한 뒤 알맞은 곳에서 답을 찾게 합니다 |

블록 B가 켜지면 질문마다 이렇게 처리합니다.

1. **clef-flash**(Cloudflare의 decision model)가 질문을 상품 · 정책 · 잡담 중 하나로 분류합니다
2. 상품 질문 → 3단계처럼 D1 상품 목록으로 답합니다
3. 정책 질문 → AI Search에서 관련 문단을 찾고, 그 문단에만 근거해 답하고, 출처 문서를 붙입니다
4. 잡담 → 답변을 만드는 생성 모델을 부르지 않고 정해진 문구로 거절합니다

```bash
npm run deploy
```

3단계와 같은 질문을 다시 해 보세요.

| 질문 | 어떻게 답하나 |
| --- | --- |
| 제주도 배송비 얼마예요? | 기본 3,000원에 제주 추가 4,000원. 출처 `shipping.md` |
| 개봉한 상품도 환불되나요? | 개봉하면 환불은 안 되고 다른 옵션으로 교환만 된다(식품은 교환도 안 된다). 출처 `returns.md`, `faq.md` |
| 골드 등급 혜택이 뭐예요? | 3% 적립, 월 5회 기본 배송비 무료, 매월 10% 쿠폰. 출처 `membership.md` |
| 여기서 제일 저렴한 상품은? | 그대로 D1 기준으로 정확히 |
| 내일 로또 번호 알려줘 | 정해진 문구로 거절. 분류(clef-flash)만 하고 생성 모델은 부르지 않습니다 |

**완료 기준** — 정책 질문에 정답과 출처가 나오고, 잡담은 거절된다

## 5단계: 대시보드 보기

> AI도 트래픽처럼 지표로 관리합니다.

[Cloudflare 대시보드](https://dash.cloudflare.com)에서 확인해 보세요.

| 어디서 | 무엇을 보나 |
| --- | --- |
| Workers & Pages > `orange-market` > Metrics | 요청 수, 오류, CPU 시간 |
| Workers & Pages > `orange-market` > Observability | 요청별 로그 |
| AI > AI Gateway > `default` > Logs | 상담 질문마다 어떤 모델을 몇 토큰 썼는지. 로또 질문은 생성 모델 호출이 없다는 것도 확인 |
| AI > AI Gateway > `default` > Analytics | 요청 수, 토큰, 비용 |
| Storage & databases > D1 | 내 상점과 상품 테이블 |
| AI > AI Search > `orange-search` | 색인된 문서와 검색 기록 |

**완료 기준** — 내 AI 호출 수와 토큰 수를 찾았다

## 더 해 보기

- 내 상점 주소를 다른 사람에게 공유하고 상담원에게 질문하게 해 보세요
- 에이전트에게 상점 컨셉을 완전히 바꿔 달라고 하고 다시 배포해 보세요
- AI Gateway `default` 설정에서 캐시를 켜고 같은 질문을 두 번 해 보세요. Logs에서 차이를 확인할 수 있습니다

## 막혔을 때

| 증상 | 해결 |
| --- | --- |
| `npm run check` 실패 | 메시지가 가리키는 파일을 확인하세요. 모르겠으면 `git restore public seed` 후 다시 |
| 고치면 안 되는 파일을 건드렸다는 메시지 | `git restore <파일>` 후 주석 블록만 다시 푸세요. `wrangler.jsonc`를 되돌려도 D1 연결은 유지됩니다 |
| 블록이 두 파일에서 다르다는 메시지 | `wrangler.jsonc`와 `src/chat.ts`에서 같은 블록을 둘 다 풀어야 합니다. 블록 B는 블록 A가 켜져 있어야 합니다 |
| 블록 B를 풀었더니 배포가 실패한다 (`instance 'orange-search' ... was not found`) | 내 계정에 AI Search `orange-search`가 없는 경우입니다. `npm run setup:docs` 후 다시 배포하세요 |
| 4단계에서 정책 질문에 "상담원이 안내해 드리겠습니다"만 나온다 | 색인이 아직 안 끝났을 수 있습니다. `./ops/verify.sh`로 확인하고, 끝나면 다시 물어보세요 |
| `npm run setup:docs`가 서비스 API 토큰이 없다며 멈춘다 (`No AI Search API token found`) | 출력에 나온 주소(대시보드 > AI > AI Search > API Tokens)에서 **Create Token**으로 토큰을 만든 뒤 다시 실행하세요 |
| `npm run setup:docs`가 계정이 여러 개라며 멈춘다 | 출력에 나온 계정 목록에서 쓸 계정의 id로 `export CLOUDFLARE_ACCOUNT_ID=<id>` 후 다시 실행하세요 |
| `wrangler whoami`가 로그인 안 됨 | `npx wrangler login` (원격 환경이면 `--device`를 붙이세요) |
| 처음부터 다시 하고 싶다 | `git restore public seed src wrangler.jsonc` 후 `npm run deploy` |

## 명령어 모음

| 명령 | 하는 일 |
| --- | --- |
| `npm run deploy` | 검사 → 배포 → D1 테이블 생성 → 상품 다시 넣기 |
| `npm run check` | 가드레일 검사만 |
| `npm run setup:docs` | 정책 문서를 R2에 올리고 AI Search `orange-search` 만들기 (여러 번 실행해도 됨) |
| `npm run preview` | 내 컴퓨터에서 미리 보기 (로컬 D1 사용) |
| `git restore public seed` | 2단계 결과를 처음 상태로 |

## 이 레포의 정책 문서에 대해

`docs/policies/`의 배송·환불·멤버십 규정은 이 튜토리얼을 위해 만든 가상 정책입니다. 실제 회사나 쇼핑몰의 정책이 아닙니다.
