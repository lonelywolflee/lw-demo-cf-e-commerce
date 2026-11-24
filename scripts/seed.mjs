// seed/shop.json, seed/products.json을 D1에 넣습니다.
// 매번 기존 행을 지우고 다시 넣기 때문에 D1은 항상 seed/와 같은 상태가 됩니다.
//
//   node scripts/seed.mjs --remote   배포된 D1
//   node scripts/seed.mjs --local    내 컴퓨터의 로컬 D1
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { validateProducts, validateShop } from "./lib/validate.mjs";

const target = process.argv[2];
if (target !== "--remote" && target !== "--local") {
  console.error("사용법: node scripts/seed.mjs --remote 또는 --local");
  process.exit(1);
}

// 1. 읽고 검사
const shop = JSON.parse(readFileSync("seed/shop.json", "utf8"));
const products = JSON.parse(readFileSync("seed/products.json", "utf8"));
const errors = [...validateShop(shop), ...validateProducts(products)];
if (errors.length > 0) {
  console.error("seed 데이터에 문제가 있어 D1에 넣지 않았습니다.");
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}

// 2. SQL 만들기. 문자열 안의 작은따옴표는 두 번 써서 이스케이프합니다.
const text = (value) => `'${String(value).replaceAll("'", "''")}'`;
const lines = [
  "DELETE FROM products;",
  "DELETE FROM shop;",
  `INSERT INTO shop (id, name, tagline, concept, theme) VALUES (1, ${text(shop.name)}, ${text(shop.tagline)}, ${text(shop.concept)}, ${text(JSON.stringify(shop.theme))});`,
];
for (const p of products) {
  const options = p.options ? text(JSON.stringify(p.options)) : "NULL";
  lines.push(
    `INSERT INTO products (id, name, category, price, description, emoji, options, stock, featured) VALUES (${text(p.id)}, ${text(p.name)}, ${text(p.category)}, ${p.price}, ${text(p.description)}, ${text(p.emoji)}, ${options}, ${p.stock}, ${p.featured ? 1 : 0});`,
  );
}
mkdirSync(".wrangler", { recursive: true });
writeFileSync(".wrangler/seed.sql", lines.join("\n") + "\n");

// 3. D1에 실행. --yes는 확인 질문을 건너뜁니다.
const result = spawnSync(`npx wrangler d1 execute DB --file .wrangler/seed.sql --yes ${target}`, {
  shell: true,
  encoding: "utf8",
});
if (result.status !== 0) {
  console.error(result.stdout + result.stderr);
  console.error("D1에 상품을 넣지 못했습니다. 위 메시지를 확인하세요.");
  process.exit(1);
}

// 4. 결과
console.log(`✓ 상점 '${shop.name}'과 상품 ${products.length}개를 D1에 넣었습니다 (${target === "--remote" ? "배포된 D1" : "로컬 D1"})`);
