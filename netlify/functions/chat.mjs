export default async (req) => {
  try {

    /* SADECE POST */
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


    /* İSTEK VERİSİ */
    const body = await req.json();

    const messages =
      Array.isArray(body.messages)
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


    /* API KEY */
    const apiKey =
      process.env.GROQ_API_KEY;


    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "BeyinX sunucu anahtarı bulunamadı."
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }


    /*
      TOKEN TÜKETİMİNİ AZALTMA

      Tüm sohbet geçmişini göndermek yerine
      yalnızca son 8 mesaj gönderiliyor.
    */

    const recentMessages =
      messages.slice(-8);


    /* SİSTEM MESAJI */

    const cleanMessages = [

      {
        role: "system",

        content: `
Sen BeyinX adlı Türkçe yapay zeka asistanısın.

Kullanıcıyla doğal, samimi ve anlaşılır Türkçe konuş.

Gerektiğinde az miktarda emoji kullan.
Örneğin:
🙂 😄 🤔 💡 👍 🔥 🚀

Her cümlede emoji kullanma.

Cevaplarını temiz ve okunabilir biçimde yaz.

ASCII çizgileri veya dekoratif ayraçlar kullanma.

Örneğin:

-----------
/-----------\\
================

gibi şeyler kullanma.

Bunun yerine normal başlıklar,
boşluklar veya kısa maddeler kullan.

Gereksiz yere
"BeyinX olarak..."
diye kendini tanıtma.

Kullanıcı kısa sorarsa kısa,
detay isterse detaylı cevap ver.

BeyinX'in kurucusu sorulursa:
"Beni Ömer, diğer adıyla Kevin kurdu."
şeklinde cevap verebilirsin.

Bu bilgiyi kullanıcı sormadıkça
gereksiz yere söyleme.
`
      },

      ...recentMessages.map((m) => ({

        role:
          m.role === "ai"
            ? "assistant"
            : "user",

        content:
          String(m.text || "")

      }))

    ];


    /* GROQ */

    const response =
      await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Authorization":
              `Bearer ${apiKey}`
          },

          body: JSON.stringify({

            model:
              "openai/gpt-oss-120b",

            messages:
              cleanMessages,

            temperature:
              0.7,

            /*
              Gereksiz derecede uzun cevapları
              engellemek için.
            */

            max_tokens:
              1200

          })
        }
      );


    /* GROQ CEVABI */

    const data =
      await response.json();


    /* RATE LIMIT */

    if (response.status === 429) {

      return new Response(
        JSON.stringify({

          error:
            "BeyinX şu anda çok fazla istek aldı. 🤔\n\n" +
            "Biraz bekleyip tekrar mesaj gönder."

        }),
        {
          status: 429,

          headers: {
            "Content-Type":
              "application/json"
          }
        }
      );

    }


    /* DİĞER HATALAR */

    if (!response.ok) {

      const groqError =
        data?.error?.message || "";


      return new Response(
        JSON.stringify({

          error:
            groqError
              ? "BeyinX sunucusunda geçici bir sorun oluştu. 🔧"
              : "BeyinX şu anda cevap veremiyor. Lütfen biraz sonra tekrar dene."

        }),
        {
          status:
            response.status,

          headers: {
            "Content-Type":
              "application/json"
          }
        }
      );

    }


    /* AI CEVABI */

    const answer =
      data?.choices?.[0]?.message?.content || "";


    if (!answer.trim()) {

      return new Response(
        JSON.stringify({

          error:
            "BeyinX cevap oluşturamadı. 🤔"

        }),
        {
          status: 500,

          headers: {
            "Content-Type":
              "application/json"
          }
        }
      );

    }


    /* BAŞARILI */

    return new Response(

      JSON.stringify({

        output_text:
          answer.trim()

      }),

      {
        status: 200,

        headers: {
          "Content-Type":
            "application/json"
        }
      }

    );


  } catch (error) {

    console.error(
      "BeyinX chat error:",
      error
    );


    return new Response(

      JSON.stringify({

        error:
          "BeyinX ile bağlantı kurulurken bir sorun oluştu. 🔧\n\n" +
          "Lütfen biraz sonra tekrar dene."

      }),

      {
        status: 500,

        headers: {
          "Content-Type":
            "application/json"
        }
      }

    );

  }
};
