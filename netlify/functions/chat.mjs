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
          error: "BeyinX API anahtarı bulunamadı."
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

    const maxRetries = 3;
    let response = null;
    let data = null;

    /*
      Geçici API hatalarında tekrar dene.
      429 = rate limit
      500/502/503/504 = geçici sunucu hataları
    */

    for (let attempt = 0; attempt <= maxRetries; attempt++) {

      response = await fetch(
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

      data = await response.json();

      if (response.ok) {
        break;
      }

      const retryable =
        response.status === 429 ||
        response.status === 500 ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504;

      if (!retryable || attempt === maxRetries) {
        break;
      }

      /*
        Groq 429 durumunda retry-after gönderebilir.
        Varsa onu kullanıyoruz.
      */

      const retryAfter =
        Number(response.headers.get("retry-after"));

      const waitSeconds =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter, 10)
          : Math.min(
              Math.pow(2, attempt),
              8
            );

      await new Promise(resolve =>
        setTimeout(
          resolve,
          waitSeconds * 1000
        )
      );
    }

    /* API hâlâ hata veriyorsa */

    if (!response || !response.ok) {

      let errorMessage =
        "BeyinX şu anda cevap veremiyor.";

      if (response?.status === 429) {
        errorMessage =
          "BeyinX şu anda çok fazla istek alıyor. Birkaç saniye sonra tekrar dene.";
      }

      else if (response?.status === 401) {
        errorMessage =
          "BeyinX API anahtarı geçersiz.";
      }

      else if (response?.status === 403) {
        errorMessage =
          "BeyinX API erişimi reddedildi.";
      }

      else if (
        response?.status === 500 ||
        response?.status === 502 ||
        response?.status === 503 ||
        response?.status === 504
      ) {
        errorMessage =
          "BeyinX sunucusu şu anda yoğun. Birkaç saniye sonra tekrar dene.";
      }

      else if (data?.error?.message) {
        errorMessage =
          data.error.message;
      }

      return new Response(
        JSON.stringify({
          error: errorMessage
        }),
        {
          status: response?.status || 500,
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
          "BeyinX sunucusuna bağlanırken bir sorun oluştu."
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
