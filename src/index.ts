// 오렌지마켓 Worker. /api/* 요청만 여기서 처리하고, 나머지는 public/의 파일을 그대로 내보냅니다.
import { handleChat, type ChatInput } from "./chat";
import type { Env } from "./env";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    try {
      if (request.method === "GET" && pathname === "/api/shop") return await getShop(env);
      if (request.method === "GET" && pathname === "/api/products") return await getProducts(env);
      if (request.method === "GET" && pathname.startsWith("/api/products/")) {
        return await getProduct(env, decodeURIComponent(pathname.slice("/api/products/".length)));
      }
      if (request.method === "POST" && pathname === "/api/chat") return await postChat(request, env);
      if (request.method === "GET" && pathname === "/api/health") {
        return Response.json({ ok: true, bindings: { DB: !!env.DB, AI: !!env.AI, SEARCH: !!env.SEARCH } });
      }
      return error(404, "없는 API 경로입니다.");
    } catch (cause) {
      console.error(cause);
      return error(500, "서버에서 오류가 났습니다. npm run deploy를 다시 실행해 보세요.");
    }
  },
};

function error(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

// D1에는 theme이 JSON 문자열로 들어 있어서, 객체로 풀어서 보냅니다.
async function getShop(env: Env): Promise<Response> {
  const row = await env.DB.prepare("SELECT name, tagline, concept, theme FROM shop WHERE id = 1").first<ShopRow>();
  if (!row) return error(404, "상점 정보가 없습니다. npm run deploy를 실행해 seed 데이터를 넣으세요.");
  return Response.json({ ...row, theme: JSON.parse(row.theme) });
}

// 추천 상품이 먼저, 그다음은 싼 순서로 보냅니다.
async function getProducts(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare("SELECT * FROM products ORDER BY featured DESC, price ASC").all<ProductRow>();
  return Response.json(results.map(toProduct));
}

async function getProduct(env: Env, id: string): Promise<Response> {
  const row = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first<ProductRow>();
  if (!row) return error(404, "없는 상품입니다.");
  return Response.json(toProduct(row));
}

// 상담. 요청을 검사하고 정리한 뒤 src/chat.ts로 넘깁니다.
const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY = 12; // 최근 6턴 (질문 6개 + 답 6개)

async function postChat(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { message?: unknown; history?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (message === "") return error(400, "질문을 입력해 주세요.");
  if (message.length > MAX_MESSAGE_LENGTH) return error(400, `질문은 ${MAX_MESSAGE_LENGTH}자까지 보낼 수 있어요.`);

  // history는 브라우저가 보낸 값이라 형식이 맞는 것만 남기고, 오래된 대화는 버립니다.
  const history: ChatInput["history"] = [];
  for (const turn of Array.isArray(body?.history) ? body.history : []) {
    if ((turn?.role === "user" || turn?.role === "assistant") && typeof turn?.content === "string") {
      history.push({ role: turn.role, content: turn.content.slice(0, 1000) });
    }
  }

  return Response.json(await handleChat(env, { message, history: history.slice(-MAX_HISTORY) }));
}

type ShopRow = { name: string; tagline: string; concept: string; theme: string };

type ProductRow = {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  emoji: string;
  options: string | null; // JSON 문자열 또는 NULL
  stock: number;
  featured: number; // 0 또는 1
};

function toProduct(row: ProductRow) {
  return { ...row, options: row.options ? JSON.parse(row.options) : null, featured: row.featured === 1 };
}
