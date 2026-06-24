const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = __dirname;
loadLocalEnv(path.join(rootDir, ".env.local"));

const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";
const aiApiKey = process.env.TOKENHUB_API_KEY || process.env.HUNYUAN_API_KEY;
const aiModel = process.env.TOKENHUB_MODEL || process.env.HUNYUAN_MODEL || "deepseek-v4-pro-202606";
const aiEndpoint =
  process.env.TOKENHUB_ENDPOINT || "https://tokenhub.tencentmaas.com/v1/chat/completions";
const aiTimeoutMs = Number(process.env.AI_TIMEOUT_MS || 4500);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
};

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/api/analyze") {
      await handleAnalyze(request, response);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, { error: "Server error" });
  }
});

server.listen(port, host, () => {
  console.log(`答案之书本地服务已启动：http://${host}:${port}`);
});

async function handleAnalyze(request, response) {
  const body = await readJsonBody(request);
  const question = cleanText(body.question, 80);
  const lyric = cleanText(body.lyric, 160);
  const cardName = cleanText(body.cardName, 80);
  const songInfo = cleanText(body.songInfo, 80);

  if (!question || !lyric || !songInfo) {
    sendJson(response, 400, {
      error: "question, lyric and songInfo are required",
    });
    return;
  }

  if (aiApiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), aiTimeoutMs);
      const completion = await fetch(aiEndpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${aiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiModel,
          temperature: 0.75,
          messages: [
            {
              role: "system",
              content:
                "你是 QQ 音乐「答案之书」的歌词解读助手。你的任务是用抽到的歌词回应用户问题。语气温柔、克制、有陪伴感。不要做绝对预测，不要冒充心理医生，不要给医疗、法律、金融等高风险建议。输出 3 段中文，每段 1-2 句。",
            },
            {
              role: "user",
              content: [
                `用户的问题：${question}`,
                `抽到的卡：${cardName || "歌词卡"}`,
                `歌词：${lyric}`,
                `歌曲信息：${songInfo}`,
                "请结合歌词主题、情绪、歌曲语境，尝试回答用户的问题。",
              ].join("\n"),
            },
          ],
        }),
      });
      clearTimeout(timeoutId);

      const result = await completion.json();
      const analysis = result.choices?.[0]?.message?.content?.trim();
      if (completion.ok && analysis) {
        sendJson(response, 200, { analysis, source: "ai" });
        return;
      }
    } catch (error) {
      console.warn(`AI 解析暂不可用，已使用本地解析：${error.message}`);
    }
  }

  sendJson(response, 200, {
    analysis: buildLocalAnalysis({ question, lyric, songInfo }),
    source: "local",
  });
}

function loadLocalEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://localhost:${port}`);
  const pathname = decodeURIComponent(url.pathname);
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(rootDir, `.${safePath}`);

  if (!filePath.startsWith(rootDir)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(data);
  });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let rawBody = "";
    request.on("data", (chunk) => {
      rawBody += chunk;
      if (rawBody.length > 12_000) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(rawBody || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function buildLocalAnalysis({ question, lyric, songInfo }) {
  return [
    `你问「${question}」，这句歌词没有急着给出一个绝对答案，而是在提醒你先看见自己的真实感受。`,
    `「${lyric}」来自 ${songInfo}，它像是在说：重要的不是马上确定结果，而是确认这件事是否仍然让你愿意靠近。`,
    "如果今天要往前一步，可以先选一个让你更平静、更坦然的小动作。答案不会一下子全亮，但它会在行动里慢慢变清楚。",
  ].join("\n\n");
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}
