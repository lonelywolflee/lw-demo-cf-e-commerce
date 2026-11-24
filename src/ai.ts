// 블록 A (3단계): 내 D1의 상품 목록을 프롬프트에 넣고, Workers AI의 생성 모델이 답합니다.
// 모든 호출은 AI Gateway(default)를 거쳐서 대시보드에 로그·토큰·비용이 남습니다.
import type { ChatInput, ChatReply } from "./chat";
import type { Env } from "./env";

// 답변을 만드는 모델. 한국어가 자연스럽고 빠른 모델을 골랐습니다.
export const MODEL = "@cf/google/gemma-4-26b-a4b-it";

// 3단계: 어떤 질문이든 상품 목록만 보고 답합니다.
// 배송·환불 같은 규정은 프롬프트에 없어서 제대로 답하지 못합니다. 4단계에서 해결합니다.
export async function answerWithModel(env: Env, input: ChatInput): Promise<ChatReply> {
  return { reply: await askAboutProducts(env, input, "model"), route: "model", sources: [] };
}

// 4단계에서 상품 질문으로 분류됐을 때 src/rag.ts가 부릅니다.
export async function answerForProducts(env: Env, input: ChatInput): Promise<ChatReply> {
  return { reply: await askAboutProducts(env, input, "product"), route: "product", sources: [] };
}

async function askAboutProducts(env: Env, input: ChatInput, route: string): Promise<string> {
  // 1. D1에서 상점과 상품을 읽습니다.
  const shop = await env.DB.prepare("SELECT name, concept FROM shop WHERE id = 1").first<{ name: string; concept: string }>();
  const { results: products } = await env.DB.prepare(
    "SELECT name, category, price, description, options, stock FROM products ORDER BY price ASC LIMIT 12",
  ).all<ProductRow>();

  // 2. 상품 목록을 글로 바꿔 system prompt에 넣습니다.
  const list = products
    .map((p) => {
      const options = p.options ? ` | 옵션 ${p.options}` : "";
      return `- ${p.name} (${p.category}) | ${p.price.toLocaleString("ko-KR")}원 | 재고 ${p.stock}개${options} | ${p.description}`;
    })
    .join("\n");
  const system = [
    `당신은 온라인 상점 '${shop?.name ?? "오렌지마켓"}'의 상담원입니다. 상점 소개: ${shop?.concept ?? ""}`,
    "",
    "상품 목록:",
    list,
    "",
    "규칙: 존댓말로, 세 문장 이내로 답하세요. 상품 정보는 위 목록에 있는 것만 말하세요.",
    "알레르기나 건강에 대한 질문에는 목록에 적힌 재료만 알려 주고, 먹어도 안전하다고 단정하지 마세요.",
  ].join("\n");

  // 3. 모델을 부릅니다.
  return generate(env, system, input, { shop: shop?.name ?? "", route });
}

// 생성 모델 호출. src/rag.ts도 정책 답변을 만들 때 같이 씁니다.
export async function generate(
  env: Env,
  system: string,
  input: ChatInput,
  metadata: Record<string, string>,
): Promise<string> {
  if (!env.AI) throw new Error("AI 바인딩이 없습니다. wrangler.jsonc의 블록 A를 풀고 다시 배포하세요.");

  const output = await env.AI.run(
    MODEL,
    {
      messages: [{ role: "system", content: system }, ...input.history, { role: "user", content: input.message }],
      max_tokens: 300,
      temperature: 0.2,
      // 이 모델은 답하기 전에 길게 추론하는 기능이 기본으로 켜져 있습니다. 상담에는 필요 없어서 끕니다.
      chat_template_kwargs: { enable_thinking: false },
    },
    // AI Gateway를 거칩니다. metadata는 대시보드 Logs에서 요청을 구분할 때 보입니다.
    { gateway: { id: "default", metadata } },
  );

  const reply = output?.choices?.[0]?.message?.content?.trim();
  return reply || "지금은 답변을 만들지 못했어요. 잠시 뒤에 다시 물어봐 주세요.";
}

type ProductRow = {
  name: string;
  category: string;
  price: number;
  description: string;
  options: string | null;
  stock: number;
};
