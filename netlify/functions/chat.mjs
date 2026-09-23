export default async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Sadece POST kullanılabilir." }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const body = await req.json();

    const messages = Array.isArray(body.messages)
      ? body.messages
      : [];

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Mesaj bulunamadı." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "OPENAI_API_KEY Netlify Function tarafından bulunamadı."
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const cleanMessages = messages.map((m) => ({
      role:
        m.role === "ai"
          ? "assistant"
          : "user",
      content: String(m.text || "")
    }));

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-5-mini",
          input: cleanMessages
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error:
            data?.error?.message ||
            "OpenAI API hata verdi."
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const answer =
      data.output_text ||
      "";

    if (!answer) {
      return new Response(
        JSON.stringify({
          error: "AI cevap üretmedi."
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    return new Response(
      JSON.stringify({
        output_text: answer
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error?.message ||
          "Beklenmeyen sunucu hatası."
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
};
// BeyinX production deploy
