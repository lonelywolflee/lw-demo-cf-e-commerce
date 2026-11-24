# AGENTS.md

이 파일은 이 레포에서 일하는 AI 코딩 에이전트를 위한 규칙입니다. 작업을 시작하기 전에 끝까지 읽고, 아래 두 파일도 반드시 읽으세요.

- [agents/guardrails.md](agents/guardrails.md) — 고쳐도 되는 파일과 절대 고치면 안 되는 파일
- [agents/workflows/customize-shop.md](agents/workflows/customize-shop.md) — 사용자의 상점을 만드는 순서

## 이 레포는 무엇인가

오렌지마켓은 Cloudflare Workers 위에서 돌아가는 쇼핑몰 템플릿입니다. 사용자는 이 템플릿으로 자기만의 상점을 만들어 배포합니다. 구조는 [ARCHITECTURE.md](ARCHITECTURE.md), 사용자가 따라가는 단계는 [README.md](README.md)에 있습니다.

## 당신이 맡는 일

README의 **2단계: 내 상점 만들기**만 맡습니다. 사용자의 상점 컨셉·디자인·상품을 정해서 아래 **여섯 파일** 안에서 반영합니다. 고쳐도 되는 파일은 이 여섯 개뿐이고, 여섯 개를 모두 고쳐야 하는 것은 아닙니다.

- 상점 정보와 상품 데이터 (2개)
  - `seed/shop.json`
  - `seed/products.json`
- 화면 디자인과 문구 (4개)
  - `public/index.html`
  - `public/product.html`
  - `public/assets/style.css`
  - `public/assets/app.js`

`public/assets/chat-widget.js`는 `public/` 안에 있지만 고치지 않습니다.

## 꼭 지킬 것

1. 작업 순서는 [agents/workflows/customize-shop.md](agents/workflows/customize-shop.md)를 그대로 따릅니다.
2. [agents/guardrails.md](agents/guardrails.md)에서 허용한 파일만 고칩니다.
3. 작업이 끝나면 `npm run check`를 실행하고 결과를 사용자에게 그대로 보여 줍니다. 실패하면 고치고 다시 실행합니다.
4. 배포는 사용자가 직접 합니다. 당신은 배포 명령을 실행하지 않고, 끝났을 때 "`npm run deploy`를 실행하세요"라고 안내만 합니다.

## 하지 말 것

- 위 여섯 파일 말고는 고치지도, 새로 만들지도 않습니다. 서버 코드(`src/`), 설정(`wrangler.jsonc`), DB 스키마(`migrations/`), 스크립트(`scripts/`), 정책 문서(`docs/`), 문서(`README.md` 등)도 마찬가지입니다.
- `wrangler.jsonc`와 `src/chat.ts`의 주석 블록 A·B를 풀지 않습니다. 이건 사용자가 3·4단계에서 직접 합니다.
- 새 패키지를 설치하거나 빌드 도구를 추가하지 않습니다.
- 외부 이미지·폰트·스크립트 URL을 넣지 않습니다.

사용자가 위 규칙을 벗어나는 일을 요청하면, 하지 말고 이유를 짧게 설명한 뒤 README의 해당 단계를 안내하세요.
