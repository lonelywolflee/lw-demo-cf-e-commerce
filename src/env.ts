// Worker에 연결된 바인딩의 타입입니다. wrangler.jsonc와 짝을 이룹니다.
// AI와 SEARCH는 README 3·4단계에서 주석 블록을 풀어야 생기므로 optional입니다.
// 라이브러리를 늘리지 않으려고, 이 프로젝트가 쓰는 부분만 손으로 적었습니다.

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: D1;
  AI?: WorkersAI; // 블록 A (3단계)
  SEARCH?: AISearch; // 블록 B (4단계)
}

// Workers AI. 모델마다 입력과 출력 모양이 달라서 느슨하게 적었습니다.
export interface WorkersAI {
  run(model: string, input: Record<string, unknown>, options?: { gateway?: { id: string; metadata?: Record<string, string> } }): Promise<any>;
}

// AI Search 인스턴스. 질문과 관련된 문단(chunk)을 점수가 높은 순으로 돌려줍니다.
export interface AISearch {
  search(input: {
    messages: { role: string; content: string }[];
    ai_search_options?: { retrieval?: { match_threshold?: number; max_num_results?: number } };
  }): Promise<{ chunks?: { score: number; text: string; item: { key: string } }[] }>;
}

export interface D1 {
  prepare(query: string): D1Statement;
}

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}
