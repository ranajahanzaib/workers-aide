// Optional authenticated model smoke: explicitly invoked, never run in CI.
const origin = process.env.AIDE_ORIGIN;
if (!origin?.startsWith("https://"))
  throw new Error("Set AIDE_ORIGIN to your published HTTPS installation.");
const create = await fetch(new URL("/api/public/conversations", origin), {
  method: "POST",
  headers: {
    Origin: new URL(origin).origin,
    "Content-Type": "application/json",
  },
  body: "{}",
});
if (!create.ok)
  throw new Error(
    `Conversation creation failed (${create.status}). Publish the agent first.`,
  );
const session = await create.json();
const response = await fetch(
  new URL(`/api/public/conversations/${session.id}/ticket`, origin),
  {
    method: "POST",
    headers: {
      Origin: new URL(origin).origin,
      Authorization: `Bearer ${session.token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  },
);
if (!response.ok) throw new Error("Cannot issue conversation ticket");
const { ticket } = await response.json();
const wsUrl = new URL(`/agents/business-chat/${session.id}`, origin);
wsUrl.protocol = "wss:";
wsUrl.searchParams.set("ticket", ticket);
const socket = new WebSocket(wsUrl);
const timer = setTimeout(() => {
  socket.close();
  console.error("Timed out without a completed inference response.");
  process.exitCode = 1;
}, 45000);
socket.addEventListener("open", () =>
  socket.send(
    JSON.stringify({
      type: "cf_agent_use_chat_request",
      id: crypto.randomUUID(),
      init: {
        method: "POST",
        body: JSON.stringify({
          messages: [
            {
              id: crypto.randomUUID(),
              role: "user",
              parts: [
                {
                  type: "text",
                  text: "What is your business name? If a consultation price is not in your knowledge, please say it is unavailable.",
                },
              ],
            },
          ],
        }),
      },
    }),
  ),
);
socket.addEventListener("message", (e) => {
  const frame = JSON.parse(e.data);
  if (frame.type === "cf_agent_use_chat_response") {
    if (frame.error) {
      console.error("Model reported an error.");
      process.exitCode = 1;
    }
    if (frame.body) console.log(frame.body);
    if (frame.done || frame.error) {
      clearTimeout(timer);
      socket.close();
    }
  }
});
socket.addEventListener("error", () => {
  clearTimeout(timer);
  console.error("WebSocket connection failed.");
  process.exitCode = 1;
});
