// 오렌지마켓 상담 위젯. 오른쪽 아래 상담 버튼과 채팅창을 그립니다.
// 모든 상점이 같이 쓰는 공통 위젯이라 고치지 않습니다. (agents/guardrails.md)
// Shadow DOM 안에 그리기 때문에 상점의 style.css를 어떻게 바꿔도 위젯 모양은 그대로입니다.
(() => {
  const STORAGE_KEY = "orange-chat"; // 대화는 탭을 닫으면 사라지는 sessionStorage에 둡니다
  const HISTORY_TURNS = 6; // 서버에 같이 보내는 최근 대화 수 (질문 + 답 한 쌍이 1턴)
  const MAX_LENGTH = 500;

  const root = document.getElementById("chat-root");
  if (!root) return;
  const shadow = root.attachShadow({ mode: "open" });

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; }
      .launcher {
        position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
        height: 56px; padding: 0 20px; border: 0; border-radius: 28px;
        font-size: 16px; font-weight: 700; color: #fff; background: #f6821f;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25); cursor: pointer;
      }
      .panel {
        position: fixed; right: 20px; bottom: 88px; z-index: 2147483000;
        display: flex; flex-direction: column;
        width: min(380px, calc(100vw - 24px)); height: min(560px, calc(100vh - 110px));
        border-radius: 16px; overflow: hidden; color: #1f2937; background: #fff;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
      }
      .panel[hidden] { display: none; }
      .header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; color: #fff; background: #f6821f; }
      .header strong { font-size: 16px; }
      .header button { border: 0; font-size: 13px; color: #fff; background: transparent; cursor: pointer; }
      .notice { margin: 0; padding: 8px 16px; font-size: 12px; color: #92400e; background: #fff7ed; }
      .messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: #f9fafb; }
      .bubble { max-width: 85%; padding: 10px 12px; border-radius: 14px; font-size: 14px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
      .user { align-self: flex-end; color: #fff; background: #f6821f; border-bottom-right-radius: 4px; }
      .assistant { align-self: flex-start; background: #fff; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px; }
      .error { align-self: flex-start; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; }
      .meta { display: block; margin-top: 6px; font-size: 11px; color: #6b7280; }
      .route { display: inline-block; padding: 1px 6px; border-radius: 6px; background: #f3f4f6; }
      .empty { margin: auto; font-size: 13px; color: #6b7280; text-align: center; }
      form { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #e5e7eb; }
      input { flex: 1; min-width: 0; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 14px; }
      input:focus { outline: 2px solid #f6821f; border-color: transparent; }
      form button { padding: 0 16px; border: 0; border-radius: 10px; font-size: 14px; font-weight: 700; color: #fff; background: #1f2937; cursor: pointer; }
      form button:disabled { opacity: 0.5; cursor: default; }
    </style>
    <button class="launcher" type="button" aria-expanded="false">💬 상담</button>
    <section class="panel" aria-label="AI 상담" hidden>
      <div class="header">
        <strong>🍊 오렌지마켓 상담</strong>
        <span>
          <button class="reset" type="button">새 대화</button>
          <button class="close" type="button" aria-label="상담 창 닫기">닫기</button>
        </span>
      </div>
      <p class="notice">개인정보(주민번호·카드번호·비밀번호)는 입력하지 마세요</p>
      <div class="messages" aria-live="polite"></div>
      <form>
        <input type="text" maxlength="${MAX_LENGTH}" placeholder="궁금한 점을 물어보세요" aria-label="질문" autocomplete="off" />
        <button type="submit">보내기</button>
      </form>
    </section>
  `;

  const launcher = shadow.querySelector(".launcher");
  const panel = shadow.querySelector(".panel");
  const list = shadow.querySelector(".messages");
  const form = shadow.querySelector("form");
  const input = shadow.querySelector("input");
  const send = form.querySelector("button");

  // 대화 기록: [{ role: "user" | "assistant", content, route?, sources? }]
  let messages = [];
  try {
    messages = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    messages = [];
  }
  const save = () => sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));

  function addBubble(kind, text) {
    const bubble = document.createElement("div");
    bubble.className = `bubble ${kind}`;
    bubble.textContent = text;
    list.append(bubble);
    list.scrollTop = list.scrollHeight;
    return bubble;
  }

  // 답 아래에 답이 나온 경로(route)와 출처 문서를 작게 보여 줍니다.
  function addAnswer(message) {
    const bubble = addBubble("assistant", message.content);
    const meta = document.createElement("span");
    meta.className = "meta";
    const route = document.createElement("span");
    route.className = "route";
    route.textContent = message.route;
    meta.append(route);
    if (message.sources?.length) meta.append(` 출처: ${message.sources.join(", ")}`);
    bubble.append(meta);
    list.scrollTop = list.scrollHeight;
  }

  function renderAll() {
    list.replaceChildren();
    if (messages.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "상품이나 배송·환불에 대해 물어보세요.";
      list.append(empty);
    }
    for (const message of messages) {
      if (message.role === "user") addBubble("user", message.content);
      else addAnswer(message);
    }
  }

  function open(prefill) {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    if (typeof prefill === "string") input.value = prefill.slice(0, MAX_LENGTH);
    input.focus();
    list.scrollTop = list.scrollHeight;
  }

  function close() {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
  }

  async function ask(text) {
    // 이번 질문을 넣기 전의 대화에서 최근 것만 서버로 보냅니다.
    const history = messages.slice(-HISTORY_TURNS * 2).map(({ role, content }) => ({ role, content }));
    if (messages.length === 0) list.replaceChildren();
    messages.push({ role: "user", content: text });
    save();
    addBubble("user", text);

    const waiting = addBubble("assistant", "답변을 쓰는 중…");
    send.disabled = true;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "답변을 받지 못했어요.");
      waiting.remove();
      const answer = { role: "assistant", content: data.reply, route: data.route, sources: data.sources ?? [] };
      messages.push(answer);
      save();
      addAnswer(answer);
    } catch (error) {
      // 실패한 질문은 기록에서 빼서 다음 질문의 history에 섞이지 않게 합니다.
      waiting.remove();
      messages.pop();
      save();
      addBubble("error", `${error.message} 잠시 뒤에 다시 시도해 주세요.`);
    } finally {
      send.disabled = false;
      input.focus();
    }
  }

  launcher.addEventListener("click", () => (panel.hidden ? open() : close()));
  shadow.querySelector(".close").addEventListener("click", close);
  shadow.querySelector(".reset").addEventListener("click", () => {
    messages = [];
    save();
    renderAll();
  });
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (text === "" || send.disabled) return;
    input.value = "";
    ask(text);
  });

  renderAll();

  // 상품 페이지의 '상담원에게 물어보기' 버튼이 부릅니다. 채팅창을 열고 글자를 미리 넣어 줍니다.
  window.openOrangeChat = open;
})();
