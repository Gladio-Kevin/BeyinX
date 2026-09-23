export default async (req) => {
  try {
    console.log("=== BEYINX FUNCTION CALISTI ===");
    console.log(
      "API KEY VAR MI:",
      Boolean(process.env.OPENAI_API_KEY)
    );

    if (req.method !== "POST") {
      console.log("METHOD:", req.method);

      return new Response(
        JSON.stringify({
          error: "Sadece POST kullanılabilir."
        }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const body = await req.json();

    const messages = Array.isArray(body.messages)
      ? body.messages
      : [];

    console.log(
      "MESAJ SAYISI:",
      messages.length
    );

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Mesaj bulunamadı."
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.log("API KEY YOK");

      return new Response(
        JSON.stringify({
          error:
            "OPENAI_API_KEY Netlify Function tarafından bulunamadı."
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    console.log("API KEY BULUNDU");
    console.log("OPENAI ISTEGI GONDERILIYOR");

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

    console.log(
      "OPENAI STATUS:",
      response.status
    );

    const data = await response.json();

    if (!response.ok) {
      console.log(
        "OPENAI HATA:",
        data?.error?.message ||
        "Bilinmeyen hata"
      );

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
      data.output_text || "";

    if (!answer) {
      console.log("AI CEVAP VERMEDI");

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

    console.log("AI CEVABI ALINDI");

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
    console.log(
      "BEYINX CRASH:",
      error?.message
    );

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
