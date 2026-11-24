// 화면을 그리는 스크립트. index.html과 product.html이 같이 씁니다.
// 상점 정보와 상품은 HTML에 적지 않고 API(/api/shop, /api/products)에서 받아 옵니다.
// 그래야 내 D1에 넣은 데이터가 화면에 나옵니다.

const won = (price) => `${price.toLocaleString("ko-KR")}원`;

async function getJson(path) {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "데이터를 불러오지 못했습니다.");
  return data;
}

// 태그를 만들고 글자를 넣습니다. textContent를 써서 상품 이름에 HTML이 섞여도 안전합니다.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showMessage(text) {
  const box = document.getElementById("message");
  box.textContent = text;
  box.hidden = false;
}

// 상점 이름·소개를 채우고, 테마 색과 글꼴을 CSS 변수에 넣습니다.
async function renderShop() {
  const shop = await getJson("/api/shop");
  for (const node of document.querySelectorAll("[data-shop]")) {
    node.textContent = shop[node.dataset.shop];
  }
  const root = document.documentElement;
  root.style.setProperty("--color-primary", shop.theme.primary);
  root.style.setProperty("--color-accent", shop.theme.accent);
  root.style.setProperty("--color-background", shop.theme.background);
  root.style.setProperty("--color-text", shop.theme.text);
  root.dataset.font = shop.theme.font;
  return shop;
}

function productCard(product) {
  const card = el("a", "card");
  card.href = `/product.html?id=${encodeURIComponent(product.id)}`;
  card.append(el("div", "card-image", product.emoji));

  const body = el("div", "card-body");
  body.append(el("p", "category", product.category), el("h3", "", product.name));
  const price = el("p", "price", won(product.price));
  if (product.stock === 0) price.append(el("span", "soldout", "품절"));
  body.append(price);
  card.append(body);
  return card;
}

// 랜딩 페이지: 추천 상품과 전체 상품
async function renderIndex() {
  const shop = await renderShop();
  document.title = shop.name;
  const products = await getJson("/api/products");
  const featured = products.filter((product) => product.featured);
  document.getElementById("featured-list").append(...featured.map(productCard));
  document.getElementById("product-list").append(...products.map(productCard));
}

// 상품 상세 페이지: 주소의 ?id= 값으로 상품 하나를 가져옵니다.
async function renderProduct() {
  const shop = await renderShop();
  const id = new URLSearchParams(location.search).get("id") ?? "";
  const product = await getJson(`/api/products/${encodeURIComponent(id)}`);
  document.title = `${product.name} — ${shop.name}`;

  document.getElementById("detail-emoji").textContent = product.emoji;
  document.getElementById("detail-category").textContent = product.category;
  document.getElementById("detail-name").textContent = product.name;
  document.getElementById("detail-price").textContent = won(product.price);
  document.getElementById("detail-description").textContent = product.description;
  document.getElementById("detail-stock").textContent = product.stock > 0 ? `재고 ${product.stock}개` : "품절";

  // 옵션: { size: ["S", "M"] } → "size" 아래에 S, M 칩
  const options = document.getElementById("detail-options");
  for (const [label, values] of Object.entries(product.options ?? {})) {
    const row = el("div", "option");
    row.append(el("div", "option-label", label), ...values.map((value) => el("span", "chip", value)));
    options.append(row);
  }

  // 채팅창을 열고 상품 이름을 미리 넣어 줍니다. (chat-widget.js가 만드는 함수)
  document.getElementById("ask-button").addEventListener("click", () => {
    window.openOrangeChat?.(`${product.name}에 대해 궁금한 게 있어요. `);
  });

  document.getElementById("product-detail").hidden = false;
}

const render = document.getElementById("product-detail") ? renderProduct : renderIndex;
render().catch((error) => showMessage(error.message));
