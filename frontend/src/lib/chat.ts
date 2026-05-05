export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatRequest = {
  messages: ChatMessage[];
  context: Record<string, unknown>;
};

export type ChatResponse = {
  reply: string;
};

export type ChatErrorResponse = {
  code: string;
  error: string;
};

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export async function sendChatMessage(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
  const response = await fetch(`${BACKEND_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal,
  });

  const payload = await response.json().catch(() => null) as ChatResponse | ChatErrorResponse | null;

  if (!response.ok) {
    const message =
      payload && "error" in payload
        ? payload.error
        : "The GuamRadar assistant is unavailable right now.";
    throw new Error(message);
  }

  if (!payload || !("reply" in payload) || !payload.reply.trim()) {
    throw new Error("The GuamRadar assistant returned an empty reply.");
  }

  return payload;
}

export async function streamChatMessage(
  request: ChatRequest,
  options: {
    signal?: AbortSignal;
    onDelta: (delta: string) => void;
  },
): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal: options.signal,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as ChatErrorResponse | null;
    throw new Error(payload?.error ?? "The GuamRadar assistant is unavailable right now.");
  }

  if (!response.body) {
    throw new Error("The GuamRadar assistant could not start a streaming reply.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const eventBlock of events) {
      processStreamEvent(eventBlock, options.onDelta);
    }
  }

  if (buffer.trim()) {
    processStreamEvent(buffer, options.onDelta);
  }
}

function processStreamEvent(eventBlock: string, onDelta: (delta: string) => void) {
  const lines = eventBlock.split("\n");
  const event = lines
    .find((line) => line.startsWith("event:"))
    ?.slice("event:".length)
    .trim();
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .join("");

  if (!data) return;

  const payload = JSON.parse(data) as { delta?: string; error?: string };
  if (event === "delta" && payload.delta) {
    onDelta(payload.delta);
    return;
  }

  if (event === "error") {
    throw new Error(payload.error ?? "The GuamRadar assistant is unavailable right now.");
  }
}
