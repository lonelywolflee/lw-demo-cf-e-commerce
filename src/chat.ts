// 상담 요청이 들어오면 여기로 옵니다.
// README 3·4단계에서 고치는 파일입니다. 표시된 두 줄의 주석만 풀면 됩니다.
import type { Env } from "./env";
import { answerWithModel } from "./ai";
import { answerWithRouting } from "./rag";

export async function handleChat(env: Env, input: ChatInput): Promise<ChatReply> {
  // ▼ 블록 B (4단계): 아래 줄 맨 앞의 // 를 지우세요
  // return answerWithRouting(env, input);

  // ▼ 블록 A (3단계): 아래 줄 맨 앞의 // 를 지우세요
  // return answerWithModel(env, input);

  return { reply: "AI 상담원 준비 중이에요. README 3단계에서 연결해 주세요.", route: "fixed", sources: [] };
}

// 브라우저가 보내는 것: 이번 질문과 지금까지의 대화
export type ChatInput = {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
};

// 브라우저로 돌려주는 것: 답, 답이 나온 경로, 근거로 쓴 문서 이름
export type ChatReply = {
  reply: string;
  route: "fixed" | "model" | "product" | "policy" | "off_topic";
  sources: string[];
};
