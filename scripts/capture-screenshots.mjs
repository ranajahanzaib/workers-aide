import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

async function main() {
  const chromePath =
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=9222",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=/tmp/chrome-screenshot-profile",
  ]);

  const wsUrl = await new Promise((resolve, reject) => {
    chrome.stderr.on("data", (d) => {
      const match = d.toString().match(/ws:\/\/[^\s]+/);
      if (match) resolve(match[0]);
    });
    setTimeout(() => reject(new Error("Timeout waiting for Chrome")), 5000);
  });

  console.log("Connected to Chrome CDP:", wsUrl);
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve) => (ws.onopen = resolve));

  let idCounter = 1;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = idCounter++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // Create a target tab
  const {
    result: { targetId },
  } = await send("Target.createTarget", { url: "about:blank" });
  const {
    result: { sessionId },
  } = await send("Target.attachToTarget", { targetId, flatten: true });

  function sendSession(method, params = {}) {
    return new Promise((resolve) => {
      const id = idCounter++;
      pending.set(id, (msg) => resolve(msg.result));
      ws.send(JSON.stringify({ id, sessionId, method, params }));
    });
  }

  await sendSession("Network.enable");
  await sendSession("Page.enable");
  await sendSession("Runtime.enable");

  // Set high-res retina viewport
  await sendSession("Emulation.setDeviceMetricsOverride", {
    width: 1380,
    height: 880,
    deviceScaleFactor: 2,
    mobile: false,
  });

  // Set the admin session cookie
  await sendSession("Network.setCookie", {
    name: "aide_session",
    value:
      "fa7031c9-6545-4cae-b656-0bcc648f6caef93217b5-d325-4f92-bc5e-6fee1bcaeee4",
    domain: "127.0.0.1",
    path: "/",
    httpOnly: true,
  });

  // Helper to capture a screenshot
  async function screenshot(filename) {
    const res = await sendSession("Page.captureScreenshot", { format: "png" });
    const buffer = Buffer.from(res.data, "base64");
    writeFileSync(`docs/screenshots/${filename}`, buffer);
    console.log(
      `Saved docs/screenshots/${filename} (${Math.round(buffer.length / 1024)} KB)`,
    );
  }

  // 1. Overview & Dashboard
  await sendSession("Page.navigate", { url: "http://127.0.0.1:5173/" });
  await new Promise((r) => setTimeout(r, 2000));
  await screenshot("overview.png");
  await screenshot("dashboard.png");

  // Helper to click sidebar nav items
  async function clickTab(name) {
    await sendSession("Runtime.evaluate", {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('nav button'));
        const target = buttons.find(b => b.textContent.includes('${name}'));
        if (target) target.click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 1000));
  }

  // 2. Agent Config
  await clickTab("Agent");
  await screenshot("agent-config.png");

  // 3. Knowledge Base
  await clickTab("Knowledge");
  await screenshot("knowledge-base.png");

  // 4. Leads
  await clickTab("Leads");
  await screenshot("records-leads.png");

  // 5. Appointments
  await clickTab("Appointments");
  await screenshot("records-appointments.png");

  // 6. Conversations
  await clickTab("Conversations");
  await screenshot("conversations.png");

  // 7. Chat Widget (/chat)
  await sendSession("Emulation.setDeviceMetricsOverride", {
    width: 480,
    height: 720,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await sendSession("Page.navigate", { url: "http://127.0.0.1:5173/chat" });
  await new Promise((r) => setTimeout(r, 2000));
  await screenshot("chat-widget.png");

  ws.close();
  chrome.kill();
  console.log("All screenshots successfully captured!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
