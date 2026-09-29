export default async (req) => {
  try {

    // =========================
    // SADECE POST
    // =========================

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "Sadece POST isteği kullanılabilir."
        }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    // =========================
    // VERİLER
    // =========================

    const body = await req.json();

    const messages = Array.isArray(body.messages)
      ? body.messages
      : [];

    const memory =
      body.memory &&
      typeof body.memory === "object"
        ? body.memory
        : {};

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Gönderilecek mesaj bulunamadı."
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    // =========================
    // API KEY
    // =========================

    const apiKey =
      process.env.GROQ_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "BeyinX AI bağlantısı yapılandırılmamış."
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    // =========================
    // SON MESAJLAR
    // =========================

    const recentMessages =
      messages.slice(-10);

    // =========================
    // GÖRSEL KONTROLÜ
    // =========================

    const hasImage =
      recentMessages.some(
        (m) =>
          typeof m?.image === "string" &&
          m.image.startsWith("data:image/")
      );

    // =========================
    // HAFIZA
    // =========================

    let memoryText = "";

    if (memory.name) {
      memoryText +=
        `Kullanıcının adı: ${String(
          memory.name
        ).slice(0, 50)}\n`;
    }

    if (
      Array.isArray(
        memory.preferences
      )
    ) {
      const preferences =
        memory.preferences
          .slice(0, 10)
          .map(
            (x) =>
              String(x).slice(0, 150)
          )
          .join(", ");

      if (preferences) {
        memoryText +=
          `Kullanıcı tercihleri: ${preferences}\n`;
      }
    }

    if (memory.language) {
      memoryText +=
        `Tercih edilen dil: ${String(
          memory.language
        ).slice(0, 30)}\n`;
    }

    // =========================
    // TARİH
    // =========================

    const currentDate =
      new Date()
        .toISOString()
        .slice(0, 10);

    // =========================
    // SİSTEM MESAJI
    // =========================

    const systemMessage = {
      role: "system",

      content: `
Sen BeyinX-AI adlı Türkçe yapay zeka asistanısın.

Bugünün tarihi: ${currentDate}

Kullanıcıyla doğal, samimi ve anlaşılır konuş.

GENEL DAVRANIŞ:

- Kullanıcı kısa sorarsa kısa cevap ver.
- Detay isterse detaylı cevap ver.
- Gereksiz robotik cevaplar verme.
- Kullanıcının konuşma tarzına uyum sağla.
- Türkçe konuşuluyorsa Türkçe cevap ver.
- Kullanıcı başka dile geçerse o dile uyum sağla.
- Gerektiğinde az miktarda emoji kullan.

BEYİNX-AI KİMLİĞİ:

BeyinX-AI'nin kurucusu sorulursa:

"Benim kurucum Ömer BeyinX-AI'yi o kurdu."

şeklinde doğal cevap ver.

HAFIZA:

Sana verilen kullanıcı hafızasını kullan.

Hafızada bulunan bilgileri sonraki konuşmalarda
tutarlı şekilde hatırla.

Hafızada olmayan kişisel bilgileri uydurma.

Örneğin kullanıcı daha önce Minecraft
oynadığını söylediyse ve bu bilgi hafızada
bulunuyorsa sonraki sohbetlerde tekrar
"Hangi oyun?" diye sorma.

GÖRSEL ANALİZ:

Kullanıcı görsel gönderirse görseli gerçekten
incele ve gördüklerini açıklamaya çalış.

Görselde:
- Minecraft ekranları
- oyunlar
- yazılar
- nesneler
- arayüzler
- ekran görüntüleri
- grafikler

varsa bunları analiz edebilirsin.

Görseli göremiyorsan uydurma.

Görsel gönderildiğinde gereksiz yere
"fotoğrafı buraya yükle" deme.

TEKNİK SORULAR:

HTML, JavaScript, Minecraft ve benzeri
teknik konularda doğrudan ve uygulanabilir
cevaplar ver.

Kullanıcı "kodu ver" derse mümkün olduğunca
doğrudan kodu ver.

Kullanıcının hafızası:

${memoryText}
`
    };

    // =========================
    // MESAJLARI GROQ FORMATINA ÇEVİR
    // =========================

    const cleanMessages = [
      systemMessage,

      ...recentMessages.map((m) => {

        const role =
          m.role === "ai"
            ? "assistant"
            : "user";

        const text =
          String(
            m.text || ""
          ).slice(0, 4000);

        const image =
          typeof m.image === "string" &&
          m.image.startsWith("data:image/")
            ? m.image
            : null;

        // Görsel varsa:
        if (
          image &&
          role === "user"
        ) {
          return {
            role: "user",

            content: [
              {
                type: "text",

                text:
                  text ||
                  "Bu görseli analiz et."
              },

              {
                type: "image_url",

                image_url: {
                  url: image
                }
              }
            ]
          };
        }

        // Normal mesaj
        return {
          role,

          content: text
        };

      })
    ];

    // =========================
    // MODEL
    // =========================

    const model =
      hasImage
        ? "qwen/qwen3.8-27b"
        : "openai/gpt-oss-120b";

    // =========================
    // İSTEK
    // =========================

    const requestBody = {
      model,

      messages:
        cleanMessages,

      temperature: 0.6,

      max_completion_tokens: 1000
    };

    // =========================
    // GROQ
    // =========================

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

          body:
            JSON.stringify(
              requestBody
            )
        }
      );

    const data =
      await response.json();

    // =========================
    // RATE LIMIT
    // =========================

    if (
      response.status === 429
    ) {

      const retryAfter =
        response.headers.get(
          "retry-after"
        );

      let waitText =
        "birkaç saniye";

      if (retryAfter) {

        const seconds =
          Math.ceil(
            Number(retryAfter)
          );

        if (
          Number.isFinite(
            seconds
          ) &&
          seconds > 0
        ) {
          waitText =
            `${seconds} saniye`;
        }
      }

      return new Response(
        JSON.stringify({
          error:
            `BeyinX şu anda biraz yoğun 😅\n\n` +
            `Çok fazla istek geldiği için ` +
            `kısa süreliğine beklememiz gerekiyor.\n\n` +
            `Yaklaşık ${waitText} sonra tekrar dene.`
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

    // =========================
    // API HATASI
    // =========================

    if (!response.ok) {

      const apiError =
        data?.error?.message || "";

      console.error(
        "Groq API:",
        apiError
      );

      return new Response(
        JSON.stringify({
          error:
            apiError ||
            "BeyinX bağlantısında geçici bir sorun oluştu."
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

    // =========================
    // CEVAP
    // =========================

    const message =
      data?.choices?.[0]?.message;

    const answer =
      message?.content || "";

    if (!answer.trim()) {

      return new Response(
        JSON.stringify({
          error:
            "BeyinX şu anda cevap oluşturamadı. Tekrar deneyebilirsin."
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

    // =========================
    // BAŞARILI
    // =========================

    return new Response(
      JSON.stringify({

        output_text:
          answer.trim(),

        web_used:
          false,

        image_used:
          hasImage

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
      "BeyinX backend error:",
      error
    );

    return new Response(
      JSON.stringify({
        error:
          "BeyinX bağlantısında beklenmeyen bir sorun oluştu. Biraz sonra tekrar dene. 😅"
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
