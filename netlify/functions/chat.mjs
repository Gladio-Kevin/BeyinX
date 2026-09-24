export default async (req) => {
  try {
    if (req.method !== "POST") {
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

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "GROQ_API_KEY bulunamadı."
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const cleanMessages = [
      {
        role: "system",
        content: `
Sen BeyinX adlı Türkçe yapay zeka asistanısın.

Kullanıcıyla doğal, samimi ve anlaşılır Türkçe konuş.

Gerektiğinde az miktarda emoji kullan.
Örneğin: 🙂 😄 🤔 💡 👍 🔥 🚀

Her cümlede emoji kullanma.

Cevaplarını temiz ve okunabilir biçimde yaz.

ASCII çizgileri veya dekoratif ayraçlar kullanma.
Örneğin:
-----------
/-----------\\
================

gibi şeyler kullanma.

Bunun yerine normal başlıklar, boşluklar veya kısa maddeler kullan.

Gereksiz yere "BeyinX olarak..." diye kendini tanıtma.

Kullanıcı kısa sorarsa kısa,
detay isterse detaylı cevap ver.
`
      },

      ...messages.map((m) => ({
        role: m.role === "ai"
          ? "assistant"
          : "user",

        content: String(m.text || "")
      }))
    ];

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },

        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: cleanMessages,
          temperature: 0.7
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error:
            data?.error?.message ||
            "Groq API hata verdi."
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
      data?.choices?.[0]?.message?.content || "";

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
          "Beklenmeyen bir hata oluştu."
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
