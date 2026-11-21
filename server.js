const http = require("node:http");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";
const SITE_ORIGIN = process.env.SITE_ORIGIN || "";

const instructions = `Tu es JAO POTO, l'assistant intelligent de la marque JAO en Côte d’Ivoire. Tu échanges naturellement en français, avec un ton chaleureux, fraternel, respectueux et professionnel. Tu aides sur les projets, l'immobilier, le business, le marketing, la création, l'histoire et l'écriture. Tu peux expliquer, rédiger, organiser et proposer des plans d'action concrets adaptés au contexte ivoirien. Ne prétends jamais avoir effectué une action externe si ce n'est pas le cas. Pour les questions sensibles ou les informations incertaines, indique les limites et recommande une vérification adaptée.`;

function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": SITE_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true, service: "JAO POTO API" });
  if (req.method !== "POST" || req.url !== "/api/chat") return send(res, 404, { error: "Route introuvable." });
  if (SITE_ORIGIN && req.headers.origin && req.headers.origin !== SITE_ORIGIN) return send(res, 403, { error: "Origine non autorisée." });
  if (!API_KEY) return send(res, 503, { error: "L’assistant IA n’est pas encore configuré. La clé API doit être ajoutée dans les variables privées du serveur." });

  let raw = "";
  req.on("data", chunk => {
    raw += chunk;
    if (raw.length > 20000) req.destroy();
  });
  req.on("end", async () => {
    try {
      const body = JSON.parse(raw || "{}");
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (!message) return send(res, 400, { error: "Écris ton message avant d’envoyer." });
      if (message.length > 6000) return send(res, 413, { error: "Ton message est trop long (6 000 caractères maximum)." });

      const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
      const input = [];
      for (const item of history) {
        if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string") continue;
        input.push({ role: item.role, content: item.content.slice(0, 4000) });
      }
      input.push({ role: "user", content: message });

      const upstream = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + API_KEY
        },
        body: JSON.stringify({
          model: MODEL,
          instructions,
          input,
          max_output_tokens: 900
        })
      });

      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        console.error("OpenAI API error:", upstream.status, data.error?.message || "unknown");
        return send(res, 502, { error: "Le service IA n’a pas pu répondre. Vérifie la configuration de la clé API et réessaie." });
      }
      return send(res, 200, { reply: data.output_text || "Je n’ai pas réussi à formuler une réponse. Peux-tu reformuler ?" });
    } catch (error) {
      console.error("Request error:", error.message);
      return send(res, 500, { error: "Une erreur est survenue. Réessaie dans un instant." });
    }
  });
});

server.listen(PORT, () => console.log("JAO POTO API listening on port " + PORT));