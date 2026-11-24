// seed/shop.json, seed/products.json 검증.
// check.mjs와 seed.mjs가 같이 씁니다. 오류는 한국어 문장 배열로 돌려줍니다.

// theme.font에 쓸 수 있는 이름. public/assets/style.css의 [data-font="..."]와 같아야 합니다.
export const FONTS = ["sans", "serif", "mono", "rounded"];

export const MAX_PRODUCTS = 12;

// 글자와 배경의 대비 기준 (WCAG 대비 비율, 1–21). 미리 보기 없이도 글자가 안 보이는 테마를 걸러 냅니다.
export const MIN_TEXT_CONTRAST = 4.5; // 본문 글자: 웹 접근성 지침(AA)의 기준
export const MIN_ACCENT_CONTRAST = 2; // 가격처럼 크고 굵게 쓰는 강조 글자: 최소한 구분되는 정도

// '#RRGGBB' 두 색의 대비 비율을 구합니다. 같은 색이면 1, 검정과 흰색이면 21입니다.
export function contrastRatio(colorA, colorB) {
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const value = parseInt(hex.slice(i, i + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(colorA), luminance(colorB)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

export const isHexColor = (value) => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);

const SHOP_FIELDS = ["name", "tagline", "concept", "theme"];
const THEME_FIELDS = ["primary", "accent", "background", "text", "font"];
const PRODUCT_REQUIRED = ["id", "name", "category", "price", "description", "emoji", "stock", "featured"];
const PRODUCT_FIELDS = [...PRODUCT_REQUIRED, "options"];

const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const length = (s) => [...s].length; // 한글·이모지도 한 글자로 셉니다

function checkText(errors, where, value, min, max) {
  if (typeof value !== "string") {
    errors.push(`${where}: 문자열이어야 합니다`);
  } else if (length(value.trim()) < min || length(value) > max) {
    errors.push(`${where}: ${min}–${max}자여야 합니다 (지금 ${length(value)}자)`);
  }
}

function checkFields(errors, where, obj, allowed, required) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) errors.push(`${where}: '${key}' 필드는 쓸 수 없습니다. 지워 주세요`);
  }
  for (const key of required) {
    if (!(key in obj)) errors.push(`${where}: '${key}' 필드가 없습니다`);
  }
}

function isSingleEmoji(value) {
  if (typeof value !== "string") return false;
  const graphemes = [...new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(value)];
  return graphemes.length === 1 && /\p{Extended_Pictographic}/u.test(value);
}

export function validateShop(shop) {
  const errors = [];
  if (!isObject(shop)) return ["seed/shop.json: 객체({ ... })여야 합니다"];
  checkFields(errors, "seed/shop.json", shop, SHOP_FIELDS, SHOP_FIELDS);
  if ("name" in shop) checkText(errors, "seed/shop.json name", shop.name, 1, 30);
  if ("tagline" in shop) checkText(errors, "seed/shop.json tagline", shop.tagline, 1, 60);
  if ("concept" in shop) checkText(errors, "seed/shop.json concept", shop.concept, 1, 100);

  if ("theme" in shop) {
    const theme = shop.theme;
    if (!isObject(theme)) {
      errors.push("seed/shop.json theme: 객체여야 합니다");
    } else {
      checkFields(errors, "seed/shop.json theme", theme, THEME_FIELDS, THEME_FIELDS);
      for (const key of ["primary", "accent", "background", "text"]) {
        if (key in theme && !isHexColor(theme[key])) {
          errors.push(`seed/shop.json theme.${key}: '#RRGGBB' 형식의 색이어야 합니다 (예: #F6821F)`);
        }
      }
      if (isHexColor(theme.text) && isHexColor(theme.background)) {
        const ratio = contrastRatio(theme.text, theme.background);
        if (ratio < MIN_TEXT_CONTRAST) {
          errors.push(
            `seed/shop.json theme: 글자색(text ${theme.text})과 배경색(background ${theme.background})의 대비가 낮아 글자가 잘 안 보입니다(대비 ${ratio.toFixed(1)}, 기준 ${MIN_TEXT_CONTRAST} 이상). 한쪽을 더 어둡게, 다른 쪽을 더 밝게 바꾸세요`,
          );
        }
      }
      // "오렌지마켓 입점 상점" 배지는 accent 색 바탕에 background 색 글자로 그려집니다.
      if (isHexColor(theme.accent) && isHexColor(theme.background)) {
        const ratio = contrastRatio(theme.accent, theme.background);
        if (ratio < MIN_TEXT_CONTRAST) {
          errors.push(
            `seed/shop.json theme: 포인트색(accent ${theme.accent})과 배경색(background ${theme.background})이 너무 비슷해 배지 글자가 잘 안 보입니다(대비 ${ratio.toFixed(1)}, 기준 ${MIN_TEXT_CONTRAST} 이상). accent를 배경과 뚜렷이 다른 색으로 바꾸세요`,
          );
        }
      }
      if ("font" in theme && !FONTS.includes(theme.font)) {
        errors.push(`seed/shop.json theme.font: ${FONTS.join(", ")} 중 하나여야 합니다`);
      }
    }
  }
  return errors;
}

export function validateProducts(products) {
  if (!Array.isArray(products)) return ["seed/products.json: 배열([ ... ])이어야 합니다"];
  const errors = [];
  if (products.length < 1) errors.push("seed/products.json: 상품이 1개 이상 있어야 합니다");
  if (products.length > MAX_PRODUCTS) {
    errors.push(`seed/products.json: 상품은 ${MAX_PRODUCTS}개 이하여야 합니다 (지금 ${products.length}개)`);
  }

  const seen = new Set();
  products.forEach((p, index) => {
    const where = `seed/products.json ${index + 1}번째 상품`;
    if (!isObject(p)) {
      errors.push(`${where}: 객체여야 합니다`);
      return;
    }
    checkFields(errors, where, p, PRODUCT_FIELDS, PRODUCT_REQUIRED);

    if ("id" in p) {
      if (typeof p.id !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id) || p.id.length > 40) {
        errors.push(`${where} id: 영문 소문자·숫자·하이픈만 쓸 수 있습니다 (예: orange-hoodie)`);
      } else if (seen.has(p.id)) {
        errors.push(`${where} id: '${p.id}'가 다른 상품과 겹칩니다`);
      }
      seen.add(p.id);
    }
    if ("name" in p) checkText(errors, `${where} name`, p.name, 1, 40);
    if ("category" in p) checkText(errors, `${where} category`, p.category, 1, 20);
    if ("description" in p) checkText(errors, `${where} description`, p.description, 1, 200);
    if ("price" in p && !(Number.isInteger(p.price) && p.price >= 0 && p.price <= 10_000_000)) {
      errors.push(`${where} price: 0 이상 10,000,000 이하의 정수여야 합니다. 따옴표와 쉼표 없이 숫자만 씁니다 (예: 12000)`);
    }
    if ("stock" in p && !(Number.isInteger(p.stock) && p.stock >= 0)) {
      errors.push(`${where} stock: 0 이상의 정수여야 합니다`);
    }
    if ("featured" in p && typeof p.featured !== "boolean") {
      errors.push(`${where} featured: true 또는 false여야 합니다`);
    }
    if ("emoji" in p && !isSingleEmoji(p.emoji)) {
      errors.push(`${where} emoji: 이모지 1개여야 합니다`);
    }
    if ("options" in p) {
      const ok =
        isObject(p.options) &&
        Object.values(p.options).every(
          (list) => Array.isArray(list) && list.length > 0 && list.every((v) => typeof v === "string" && v.length > 0),
        );
      if (!ok) errors.push(`${where} options: { "size": ["S", "M"] } 같은 모양이어야 합니다`);
    }
  });
  return errors;
}
