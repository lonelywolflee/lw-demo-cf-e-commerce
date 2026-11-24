// 블록 B (4단계): 질문을 먼저 분류하고, 종류에 맞는 곳에서 답을 찾습니다.
//   상품 질문 → D1 상품 목록 (3단계와 같음)
//   정책 질문 → AI Search에서 찾은 정책 문서에만 근거해 답하고 출처를 붙임
//   잡담     → 생성 모델을 부르지 않고 정해진 문구로 거절
import { answerForProducts, generate } from "./ai";
import type { ChatInput, ChatReply } from "./chat";
import type { Env } from "./env";

// 질문을 분류하는 모델. 고를 수 있는 답마다 확률을 돌려주는 decision model이라 빠르고 쌉니다.
const CLASSIFIER = "@cf/cloudflare/clef-flash";

// 정해진 문구. docs/policies/support-guidelines.md의 문구와 같습니다.
const OFF_TOPIC = "오렌지마켓 쇼핑 관련 질문만 도와드릴 수 있어요.";
const NEEDS_HUMAN =
  "확인이 필요한 내용이라 상담원이 안내해 드리겠습니다. 평일 10:00–18:00(점심시간 12:00–13:00 제외)에 '상담원 연결'을 입력해 주세요.";

export async function answerWithRouting(env: Env, input: ChatInput): Promise<ChatReply> {
  const route = await classify(env, input.message);
  if (route === "off_topic") return { reply: OFF_TOPIC, route: "off_topic", sources: [] };
  if (route === "product") return answerForProducts(env, input);
  return answerFromPolicies(env, input);
}

// 1. 분류: product · policy · off_topic 중 확률이 가장 높은 것을 고릅니다.
async function classify(env: Env, message: string): Promise<"product" | "policy" | "off_topic"> {
  if (!env.AI) throw new Error("AI 바인딩이 없습니다. wrangler.jsonc의 블록 A를 풀고 다시 배포하세요.");

  const shop = await env.DB.prepare("SELECT name FROM shop WHERE id = 1").first<{ name: string }>();
  const decision = await env.AI.run(
    CLASSIFIER,
    {
      model: "clef-flash",
      state: `상점: ${shop?.name ?? "오렌지마켓"}\n질문: ${message}`,
      questions: {
        route: {
          type: "choice",
          instructions: "쇼핑몰 상담 질문을 어디로 보낼지 고르세요.",
          criteria: {
            product: "이 상점의 상품, 가격, 재고, 사이즈, 추천에 대한 질문",
            policy: "배송, 배송비, 환불, 교환, 멤버십, 적립금, 결제, 주문 취소, 상담원 연결 같은 쇼핑몰 규정 질문",
            off_topic: "쇼핑과 관계없는 질문 (로또, 날씨, 주식, 숙제, 잡담)",
          },
        },
      },
    },
    { gateway: { id: "default", metadata: { shop: shop?.name ?? "", route: "classify" } } },
  );

  // 응답 예: { answers: { route: { choice: "policy", probabilities: { product: 0.03, policy: 0.95, off_topic: 0.02 } } } }
  const choice = decision?.answers?.route?.choice;
  return choice === "product" || choice === "off_topic" ? choice : "policy";
}

// 2. 정책 질문: 관련 문단을 찾고, 그 문단에만 근거해 답합니다.
async function answerFromPolicies(env: Env, input: ChatInput): Promise<ChatReply> {
  if (!env.SEARCH) throw new Error("SEARCH 바인딩이 없습니다. wrangler.jsonc의 블록 B를 풀고 다시 배포하세요.");

  // 점수가 낮은 문단은 버리고, 점수가 높은 순으로 4개까지 받습니다.
  const found = await env.SEARCH.search({
    messages: [{ role: "user", content: input.message }],
    ai_search_options: { retrieval: { match_threshold: 0.3, max_num_results: 4 } },
  });
  const chunks = found.chunks ?? [];

  // 찾은 문단이 없으면 생성 모델을 부르지 않습니다.
  if (chunks.length === 0) return { reply: NEEDS_HUMAN, route: "policy", sources: [] };

  const system = [
    "당신은 쇼핑몰 '오렌지마켓'의 상담원입니다. 아래 [문서]의 내용에만 근거해 답하세요.",
    `[문서]에 답이 없으면 다른 말 없이 이 문장만 그대로 답하세요: ${NEEDS_HUMAN}`,
    "규칙: 존댓말로, 세 문장 이내로 답하세요. 금액·기간·횟수는 문서에 적힌 숫자 그대로 말하세요.",
    "",
    ...chunks.map((chunk) => `[문서: ${chunk.item.key}]\n${chunk.text}`),
  ].join("\n");
  const reply = await generate(env, system, input, { route: "policy" });

  // 출처는 근거로 쓴 문서의 파일 이름입니다. 답을 찾지 못했으면 출처를 붙이지 않습니다.
  const sources = reply.includes("상담원이 안내해 드리겠습니다") ? [] : [...new Set(chunks.map((chunk) => chunk.item.key))];
  return { reply, route: "policy", sources };
}
