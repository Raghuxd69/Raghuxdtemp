// TempMail + Telegram Worker

const TELEGRAM_TOKEN = TELEGRAM_TOKEN || ""; // From wrangler.toml / .env
const SECRET_PATH = TELEGRAM_SECRET_PATH || ""; // From wrangler.toml / .env
const KV = USER_KV; // KV namespace from wrangler.toml

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  // Webhook registration
  if (url.pathname === `/${SECRET_PATH}/registerWebhook`) {
    return await registerWebhook();
  }

  // Telegram bot webhook handler
  if (url.pathname === `/${SECRET_PATH}` && request.method === "POST") {
    const body = await request.json();
    return await handleTelegramUpdate(body);
  }

  return new Response("TempMail+Telegram Worker running", {
    headers: { "Content-Type": "text/plain" },
  });
}

// Register webhook with Telegram
async function registerWebhook() {
  const webhookURL = `https://minetemp.raghubamaniya69.workers.dev/${SECRET_PATH}`;
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${webhookURL}`);
  const data = await res.json();
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}

// Handle Telegram updates
async function handleTelegramUpdate(update) {
  if (!update.message) return new Response("No message", { status: 200 });

  const chatId = update.message.chat.id;
  const text = update.message.text || "";

  if (text === "/start") {
    await sendMessage(chatId, "Welcome to TempMail+Telegram Bot!\nUse /new to create temp email.");
  } else if (text === "/new") {
    const emailToken = crypto.randomUUID();
    const emailAddress = `${emailToken}@minetemp.workers.dev`;
    await KV.put(chatId.toString(), JSON.stringify({ emailToken, emailAddress }));
    await sendMessage(chatId, `Your temp email: ${emailAddress}`);
  } else if (text === "/inbox") {
    const data = await KV.get(chatId.toString(), { type: "json" });
    if (!data) {
      await sendMessage(chatId, "No temp email found. Use /new first.");
    } else {
      // For now just return stored token & address
      await sendMessage(chatId, `Your email: ${data.emailAddress}\nToken: ${data.emailToken}`);
    }
  } else {
    await sendMessage(chatId, "Unknown command. Use /start, /new, /inbox.");
  }

  return new Response("OK", { status: 200 });
}

// Send message helper
async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}
