-- 오렌지마켓 D1 스키마. 상점 정보 1행과 상품 목록.
CREATE TABLE shop (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  concept TEXT NOT NULL,
  theme TEXT NOT NULL            -- JSON: { primary, accent, background, text, font }
);
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL,
  description TEXT NOT NULL,
  emoji TEXT NOT NULL,
  options TEXT,                  -- JSON 또는 NULL
  stock INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0
);
