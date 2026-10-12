const MODEL = "gemini-3.6-flash";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORSの事前確認
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Workerの動作確認
    if (request.method === "GET" && url.pathname === "/") {
      return jsonResponse({
        status: "ok",
        message: "AI Compare API is running",
      });
    }

    // 質問受付
    if (request.method !== "POST" || url.pathname !== "/api/chat") {
      return jsonResponse(
        { error: "Not Found" },
        404
      );
    }

    if (!env.GEMINI_API_KEY) {
      return jsonResponse(
        { error: "API key is not configured" },
        500
      );
    }

    try {
      const body = await request.json();
      const message = body.message;

      if (
        typeof message !== "string" ||
        message.trim().length === 0
      ) {
        return jsonResponse(
          { error: "質問を入力してください" },
          400
        );
      }

      if (message.length > 10000) {
        return jsonResponse(
          { error: "質問が長すぎます" },
          400
        );
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: message.trim() }
                ]
              }
            ]
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error(
          "Gemini API error:",
          response.status,
          JSON.stringify(result)
        );

        return jsonResponse(
          {
            error: "Gemini API request failed",
            status: response.status,
          },
          502
        );
      }

      const answer = (
        result.candidates?.[0]?.content?.parts || []
      )
        .map(part => part.text || "")
        .join("");

      if (!answer) {
        return jsonResponse(
          { error: "回答を取得できませんでした" },
          502
        );
      }

      return jsonResponse({
        model: MODEL,
        answer,
      });

    } catch (error) {
      console.error("Worker error:", error);

      return jsonResponse(
        { error: "リクエストの処理に失敗しました" },
        500
      );
    }
  },
};