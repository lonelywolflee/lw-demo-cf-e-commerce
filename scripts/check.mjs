// 가드레일 검사. `npm run check`와 `npm run deploy`가 실행합니다.
// 실패하면 종료 코드 1로 끝나서 배포가 진행되지 않습니다.
//
//   검사 1. 고치면 안 되는 파일이 그대로인지 (scripts/protected.lock.json과 비교)
//   검사 2. 블록 A·B가 wrangler.jsonc와 src/chat.ts에서 서로 맞는지
//   검사 3. seed/ 데이터 형식
//   검사 4. public/ 화면 규칙 (상담 버튼, 외부 주소, 글자와 배경의 대비)
//
// 템플릿 관리자용: `npm run lock` (= --write-lock)은 지금 파일 상태를 lock 파일에 기록합니다.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { contrastRatio, isHexColor, MIN_ACCENT_CONTRAST, MIN_TEXT_CONTRAST, validateProducts, validateShop } from "./lib/validate.mjs";

const LOCK_PATH = "scripts/protected.lock.json";

// 고쳐도 되는 파일 (agents/guardrails.md와 같아야 합니다)
const ALLOWED = [
  "seed/shop.json",
  "seed/products.json",
  "public/index.html",
  "public/product.html",
  "public/assets/style.css",
  "public/assets/app.js",
];

// 검사하지 않는 것: 설치·실행 중에 생기는 파일과 편집기·AI 도구의 설정 폴더
const IGNORED_DIRS = [".git", "node_modules", ".wrangler", ".claude", ".cursor", ".kilo", ".vscode", ".idea"];
const IGNORED_FILES = ["ops/accounts.csv", ".dev.vars", "worker-configuration.d.ts", LOCK_PATH];
const IGNORED_NAMES = [".DS_Store"];

// 블록 스위치가 들어 있는 파일
const SWITCH_FILES = ["wrangler.jsonc", "src/chat.ts"];
const BLOCK_MARK = "▼ 블록";

// 화면에 꼭 있어야 하는 두 줄 (agents/guardrails.md 화면 규칙)
const CHAT_ROOT = '<div id="chat-root"></div>';
const CHAT_SCRIPT = '<script src="/assets/chat-widget.js" defer></script>';

const errors = [];
const fail = (path, message) => errors.push(`${path}: ${message}`);
const read = (path) => readFileSync(path, "utf8").replaceAll("\r\n", "\n");

// ───────── 검사 1. 보호 파일 ─────────

// 레포의 모든 파일 경로를 모읍니다. 무시 목록은 건너뜁니다.
function listFiles(dir = "") {
  const files = [];
  for (const entry of readdirSync(dir || ".", { withFileTypes: true })) {
    const path = dir ? `${dir}/${entry.name}` : entry.name;
    if (IGNORED_NAMES.includes(entry.name)) continue;
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.includes(entry.name)) files.push(...listFiles(path));
    } else if (!IGNORED_FILES.includes(path)) {
      files.push(path);
    }
  }
  return files;
}

// 블록 표시 바로 다음 줄의 `// `를 지웁니다. 주석을 풀었든 아니든 같은 내용이 됩니다.
function uncommentBlocks(text) {
  const lines = text.split("\n");
  for (let i = 1; i < lines.length; i++) {
    if (lines[i - 1].includes(BLOCK_MARK)) lines[i] = lines[i].replace(/^(\s*)\/\/ ?/, "$1");
  }
  return lines.join("\n");
}

// wrangler.jsonc는 첫 배포 때 wrangler가 database_id를 써 넣으면서 파일 전체를 다시 정렬합니다.
// 그래서 database_id 줄을 빼고, 주석 줄은 따로 모으고, 나머지는 공백을 모두 없앤 뒤 비교합니다.
function normalizeWranglerConfig(text) {
  const comments = [];
  let code = "";
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//")) comments.push(trimmed);
    else if (!/^"database_id"\s*:/.test(trimmed)) code += trimmed;
  }
  // 문자열 밖의 공백을 없애고, 닫는 괄호 앞의 쉼표도 없앱니다.
  code = code.replace(/"(?:[^"\\]|\\.)*"|\s+/g, (match) => (match.startsWith('"') ? match : ""));
  code = code.replace(/"(?:[^"\\]|\\.)*"|,(?=[}\]])/g, (match) => (match.startsWith('"') ? match : ""));
  return comments.join("\n") + "\n" + code;
}

function hashFile(path) {
  let text = read(path);
  if (SWITCH_FILES.includes(path)) text = uncommentBlocks(text);
  if (path === "wrangler.jsonc") text = normalizeWranglerConfig(text);
  return createHash("sha256").update(text).digest("hex");
}

const protectedFiles = listFiles()
  .filter((path) => !ALLOWED.includes(path))
  .sort();

if (process.argv.includes("--write-lock")) {
  const files = Object.fromEntries(protectedFiles.map((path) => [path, hashFile(path)]));
  writeFileSync(LOCK_PATH, JSON.stringify({ version: 1, files }, null, 2) + "\n");
  console.log(`✓ ${LOCK_PATH}에 보호 파일 ${protectedFiles.length}개를 기록했습니다`);
  process.exit(0);
}

function checkProtected() {
  if (!existsSync(LOCK_PATH)) {
    fail(LOCK_PATH, "파일이 없습니다. `git restore scripts`로 되돌리세요");
    return;
  }
  const lock = JSON.parse(read(LOCK_PATH)).files;
  for (const path of protectedFiles) {
    if (!(path in lock)) {
      fail(path, `새 파일은 만들 수 없습니다. 이 파일을 지우세요. 고칠 수 있는 파일은 ${ALLOWED.length}개뿐입니다 (agents/guardrails.md)`);
    } else if (hashFile(path) !== lock[path]) {
      const hint = SWITCH_FILES.includes(path) ? " 후 주석 블록만 다시 푸세요" : "로 되돌리세요";
      fail(path, `고치면 안 되는 파일이 바뀌었습니다. \`git restore ${path}\`${hint}`);
    }
  }
  for (const path of Object.keys(lock)) {
    if (!protectedFiles.includes(path)) fail(path, `파일이 지워졌습니다. \`git restore ${path}\`로 되돌리세요`);
  }
}

// ───────── 검사 2. 블록 상태 ─────────

// 블록 표시 다음 줄이 주석이 아니면 켜진 것입니다. 표시가 없으면 undefined.
function blockIsOn(path, name) {
  if (!existsSync(path)) return undefined;
  const lines = read(path).split("\n");
  const index = lines.findIndex((line) => line.includes(`${BLOCK_MARK} ${name}`));
  if (index === -1 || index + 1 >= lines.length) return undefined;
  return !lines[index + 1].trim().startsWith("//");
}

function checkBlocks() {
  const state = {};
  for (const name of ["A", "B"]) {
    const [config, code] = SWITCH_FILES.map((path) => blockIsOn(path, name));
    if (config === undefined || code === undefined) continue; // 검사 1이 이미 알려 줍니다
    if (config !== code) {
      const [on, off] = config ? SWITCH_FILES : [...SWITCH_FILES].reverse();
      fail(off, `블록 ${name}가 ${on}에서는 켜져 있고 여기서는 꺼져 있습니다. '${BLOCK_MARK} ${name}' 아래 줄의 \`// \`를 두 파일에서 똑같이 풀거나 붙이세요`);
    }
    state[name] = config && code;
    state[`${name} 설정`] = config; // wrangler.jsonc 쪽 상태
  }
  // 블록 A가 두 파일에서 다르다는 안내가 이미 나갔으면 겹쳐서 말하지 않습니다.
  if (state.B && state["A 설정"] === false) {
    fail("wrangler.jsonc", "블록 B는 블록 A가 켜져 있어야 합니다. 블록 A도 두 파일에서 풀어 주세요 (3단계)");
  }
  if (state.A && state.B) return "블록 A·B 켜짐(4단계)";
  if (state.A) return "블록 A 켜짐(3단계)";
  return "블록 모두 꺼짐(1·2단계)";
}

// ───────── 검사 3. seed 데이터 ─────────

function checkSeed() {
  const load = (path) => {
    if (!existsSync(path)) return fail(path, `파일이 없습니다. \`git restore ${path}\`로 되돌리세요`);
    try {
      return JSON.parse(read(path));
    } catch (error) {
      fail(path, `JSON으로 읽을 수 없습니다 (${error.message}). 쉼표나 따옴표가 빠지지 않았는지 확인하세요`);
    }
  };
  const shop = load("seed/shop.json");
  const products = load("seed/products.json");
  if (shop !== undefined) errors.push(...validateShop(shop));
  if (products !== undefined) errors.push(...validateProducts(products));
  return Array.isArray(products) ? products.length : 0;
}

// ───────── 검사 4. 화면 ─────────

// 외부 주소: http://, https://, 그리고 //로 시작하는 주소
const EXTERNAL = String.raw`["'\x60]?\s*(?:https?:)?\/\/`;
const EXTERNAL_RULES = [
  [new RegExp(String.raw`<(?:script|img|source|iframe|video|audio|embed|track|input)\b[^>]*\bsrc(?:set)?\s*=\s*${EXTERNAL}`, "i"), "태그의 src"],
  [new RegExp(String.raw`<link\b[^>]*\bhref\s*=\s*${EXTERNAL}`, "i"), "<link href>"],
  [new RegExp(String.raw`<object\b[^>]*\bdata\s*=\s*${EXTERNAL}`, "i"), "<object data>"],
  [new RegExp(String.raw`url\(\s*${EXTERNAL}`, "i"), "CSS url()"],
  [new RegExp(String.raw`@import\s+(?:url\(\s*)?${EXTERNAL}`, "i"), "CSS @import"],
  [new RegExp(String.raw`\bimport\b[^;\n]*${EXTERNAL}`), "JS import"],
  [new RegExp(String.raw`\bfetch\(\s*${EXTERNAL}`), "JS fetch()"],
];

function checkScreens() {
  const screens = ALLOWED.filter((path) => path.startsWith("public/"));
  for (const path of screens) {
    if (!existsSync(path)) {
      fail(path, `파일이 없습니다. \`git restore ${path}\`로 되돌리세요`);
      continue;
    }
    const text = read(path);

    if (path.endsWith(".html")) {
      if (!text.includes(CHAT_ROOT)) fail(path, `상담 버튼이 붙는 줄이 없습니다. ${CHAT_ROOT} 를 </body> 앞에 그대로 넣으세요`);
      if (!text.includes(CHAT_SCRIPT)) fail(path, `상담 위젯을 불러오는 줄이 없습니다. ${CHAT_SCRIPT} 를 </body> 앞에 그대로 넣으세요`);
    }
    if (path.endsWith("app.js")) {
      for (const api of ["/api/shop", "/api/products"]) {
        if (!text.includes(api)) fail(path, `${api} 호출이 없습니다. 상점과 상품은 HTML에 직접 쓰지 않고 API에서 받아 그려야 합니다`);
      }
    }
    for (const [pattern, what] of EXTERNAL_RULES) {
      const found = text.match(pattern);
      if (found) {
        const line = text.slice(0, found.index).split("\n").length;
        fail(`${path} ${line}번째 줄`, `외부 주소에서 불러오는 코드(${what})가 있습니다. 이미지는 이모지와 CSS로, 글꼴은 seed/shop.json의 theme.font로 표현하세요 (일반 <a href> 링크는 괜찮습니다)`);
        break; // 파일마다 처음 찾은 것 하나만 알려 줍니다
      }
    }
  }
}

// style.css에만 있는 색 토큰도 글자가 보이는지 확인합니다.
// 값이 '#RRGGBB'가 아니면(color-mix, var 등) 계산할 수 없어서 건너뜁니다.
function checkContrast() {
  const css = "public/assets/style.css";
  if (!existsSync(css) || !existsSync("seed/shop.json")) return [];
  let theme;
  try {
    theme = JSON.parse(read("seed/shop.json")).theme ?? {};
  } catch {
    return []; // 검사 3이 이미 알려 줍니다
  }
  const token = (name) => read(css).match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\b`))?.[1];
  const pairs = [
    // [짧은 이름, 글자색, 배경색, 글자 설명, 배경 설명, 기준, 여기서 실패로 처리할지]
    // 위 두 줄은 seed/shop.json 안의 색이라 검사 3(validate.mjs)이 실패를 알려 줍니다. 여기서는 수치만 모읍니다.
    ["글자/배경", theme.text, theme.background, "", "", MIN_TEXT_CONTRAST, false],
    ["배지", theme.background, theme.accent, "", "", MIN_TEXT_CONTRAST, false],
    ["글자/카드", theme.text, token("--color-card"), "seed/shop.json의 text", "--color-card", MIN_TEXT_CONTRAST, true],
    ["버튼 글자", token("--color-on-primary"), theme.primary, "--color-on-primary", "seed/shop.json의 primary", MIN_TEXT_CONTRAST, true],
    ["가격", theme.primary, token("--color-card"), "seed/shop.json의 primary", "--color-card", MIN_ACCENT_CONTRAST, true],
  ];
  const summary = [];
  for (const [label, front, back, frontName, backName, minimum, failHere] of pairs) {
    if (!isHexColor(front) || !isHexColor(back)) continue;
    const ratio = contrastRatio(front, back);
    summary.push(`${label} ${ratio.toFixed(1)}(기준 ${minimum})`);
    if (failHere && ratio < minimum) {
      fail(css, `${frontName}(${front}) 글자가 ${backName}(${back}) 배경 위에서 잘 안 보입니다(대비 ${ratio.toFixed(1)}, 기준 ${minimum} 이상). ${css} 맨 위의 토큰을 바꾸세요`);
    }
  }
  return summary;
}

// ───────── 실행 ─────────

checkProtected();
const stage = checkBlocks();
const productCount = checkSeed();
checkScreens();
const contrast = checkContrast();

if (errors.length > 0) {
  console.error(`✗ 검사 실패 — ${errors.length}건. 아래를 고친 뒤 다시 실행하세요.`);
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}
if (contrast.length > 0) console.log(`  색 대비: ${contrast.join(" · ")}`);
console.log(`✓ 통과 — 상품 ${productCount}개, 현재 ${stage}`);
