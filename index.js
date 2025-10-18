// TempMail + Telegram Bot Worker
// Cloudflare Dashboard paste directly

const UPSTREAM = "https://tempmail.itz-ashlynn.workers.dev/"; 

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const secretPath = getEnv("TELEGRAM_SECRET_PATH");

  if (path === `/telegram/${secretPath}` && request.method === "POST") {
    const body = await request.json();
    handleTelegramUpdate(body).catch(console.error);
    return new Response("ok");
  }

  if (path === "/registerWebhook" && request.method === "GET") {
    return registerWebhook(request);
  }

  return new Response("TempMail+Telegram Worker running", { status: 200 });
}

// ---------- Telegram Handler ----------
async function handleTelegramUpdate(update) {
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const text = (msg.text || "").trim();

    if (text === "/start") return sendMessage(chatId, "Welcome! Use /new to create temp email, /inbox to check it.");

    if (text === "/new") {
      const res = await fetch(`${UPSTREAM}?action=create`);
      const json = await safeJson(res);
      if (!json?.result) return sendMessage(chatId, "Failed to create temp email.");

      const token = json.result.emailToken || json.result.token || json.result.tokenId;
      const address = json.result.address || json.result.email || json.result.mail;

      const userObj = { emailToken: token, address: address || "unknown", createdAt: Date.now(), history: [] };
      await USER_KV.put(String(chatId), JSON.stringify(userObj));
      return sendMessage(chatId, `✅ Temp email created: ${userObj.address}\nUse /inbox to list messages.`);
    }

    if (text === "/inbox") {
      const userStr = await USER_KV.get(String(chatId));
      if (!userStr) return sendMessage(chatId, "No email found. Use /new to create one.");
      const user = JSON.parse(userStr);
      const token = user.emailToken;

      const resp = await fetch(`${UPSTREAM}?action=messages&emailToken=${encodeURIComponent(token)}`);
      const j = await safeJson(resp);

      // Safe messages array
      let messages = [];
      if (j?.result?.messages && Array.isArray(j.result.messages)) {
        messages = j.result.messages;
      } else if (j?.result && Array.isArray(j.result)) {
        messages = j.result;
      } else {
        messages = [];
      }

      if (!messages.length) return sendMessage(chatId, "Inbox empty.");

      let parts = [];
      const inline_keyboard = [];
      for (let m of messages.slice(0, 20)) {
        const id = m.id || m.messageId || m._id;
        const from = m.from || m.sender || "unknown";
        const subj = m.subject || m.title || "(no subject)";
        parts.push(`${id || "?"} — ${subj} — ${from}`);
        if (id) inline_keyboard.push([{ text: `Read: ${subj}`, callback_data: `read:${id}` }]);
      }
      return sendMessage(chatId, "Inbox:\n\n" + parts.join("\n"), { reply_markup: { inline_keyboard } });
    }

    return sendMessage(chatId, "Unknown command. Use /new or /inbox.");
  }

  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message?.chat?.id || cq.from.id;
    const data = cq.data || "";
    if (data.startsWith("read:")) {
      const messageId = data.split("read:")[1];
      const userStr = await USER_KV.get(String(chatId));
      if (!userStr) return answerCallback(cq.id, "No email stored.");

      const user = JSON.parse(userStr);
      const token = user.emailToken;
      const resp = await fetch(`${UPSTREAM}?action=message&messageId=${encodeURIComponent(messageId)}`);
      const j = await safeJson(resp);
      const message = j?.result || {};
      const from = message?.from || message?.sender || "unknown";
      const subj = message?.subject || message?.title || "(no subject)";
      const body = message?.body || message?.content || "(no body)";

      await sendMessage(chatId, `From: ${from}\nSubject: ${subj}\n\n${body}`);
      await answerCallback(cq.id, "Message delivered.");
    }
  }
}

// ---------- Helpers ----------
function getEnv(name) {
  return globalThis[name] || null;
}

async function sendMessage(chatId, text, extra = {}) {
  const token = getEnv("TELEGRAM_TOKEN");
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: String(text).slice(0, 4096), ...extra })
  });
}

async function answerCallback(callbackQueryId, text) {
  const token = getEnv("TELEGRAM_TOKEN");
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text })
  });
}

async function registerWebhook(request) {
  const token = getEnv("TELEGRAM_TOKEN");
  const secretPath = getEnv("TELEGRAM_SECRET_PATH");
  const workerUrl = new URL(request.url);
  workerUrl.pathname = `/telegram/${secretPath}`;
  workerUrl.search = "";
  const webhookUrl = workerUrl.toString();
  const resp = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl })
  });
  return new Response(JSON.stringify(await safeJson(resp)), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function safeJson(resp) {
  try { return await resp.json(); } catch { return { text: await resp.text() }; }
}
