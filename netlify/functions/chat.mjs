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
      body.memory && typeof body.memory === "object"
        ? body.memory
        : {};

    const image =
      typeof body.image === "string"
        ? body.image
        : null;

    if (messages.length === 0 && !image) {
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

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "BeyinX AI bağlantısı yapılandırılmamış."
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
    // HAFIZA
    // =========================

    let memoryText = "";

    if (memory.name) {
      memoryText +=
        `Kullanıcının adı: ${String(memory.name).slice(0, 50)}\n`;
    }

    if (Array.isArray(memory.preferences)) {

      const preferences = memory.preferences
        .slice(0, 20)
        .map(x => String(x).slice(0, 200))
        .join(", ");

      if (preferences) {
        memoryText +=
          `Kullanıcı tercihleri: ${preferences}\n`;
      }
    }

    if (memory.language) {
      memoryText +=
        `Tercih edilen dil: ${String(memory.language).slice(0, 30)}\n`;
    }

    // =========================
    // TARİH
    // =========================

    const currentDate =
      new Date().toISOString().slice(0, 10);

    // =========================
    // SON MESAJLAR
    // =========================

    const recentMessages =
      messages.slice(-20);

    // =========================
    // SİSTEM MESAJI
    // =========================

    const systemMessage = {
      role: "system",

      content: `
Sen BeyinX-AI adlı Türkçe yapay zeka asistanısın.

Bugünün tarihi: ${currentDate}

Kullanıcıyla doğal, samimi ve anlaşılır konuş.

GENEL:

- Kısa soruya kısa cevap ver.
- Detay istenirse detaylandır.
- Türkçe konuşuluyorsa Türkçe konuş.
- Kullanıcının konuşma tarzına uyum sağla.
- Gereksiz emoji kullanma.
- Robotik cevap verme.
- Bilmediğin şeyi uydurma.

KİMLİK:

BeyinX-AI'nin kurucusu sorulursa:

"Benim kurucum Ömer, diğer adıyla Kevin. BeyinX-AI'yi o kurdu."

de.

HAFIZA:

Sana verilen kullanıcı hafızasını kullan.

Özellikle kullanıcı daha önce:
- Minecraft oynadığını,
- HTML ile uğraştığını,
- BeyinX geliştirdiğini
gibi bilgileri hafızada tutuyorsa bunları unutmuş gibi davranma.

Hafızada olmayan bilgileri uydurma.

Kullanıcı yeni bir sohbete geçtiğinde bile backend'e gönderilen
hafıza bilgilerini kullan.

KULLANICI HAFIZASI:

${memoryText || "Kayıtlı ek kullanıcı hafızası yok."}

WEB ARAŞTIRMASI:

Güncel bilgi gerektiğinde web araştırmasını kullan.

Özellikle:

- bugün
- şu an
- şimdi
- dün
- yarın
- son
- en son
- güncel
- 2026
- haber
- fiyat
- hava durumu
- yeni sürüm
- son gelişmeler

gibi ifadelerde güncel bilgi gerekiyorsa web araması yap.

Web araması sonucunda elde edilen bilgileri kendi
cevabınmış gibi uydurma.

Kaynaklardan gelen bilgileri doğru şekilde özetle.

Web araştırması gerekiyorsa araştır.

GÖRSEL:

Kullanıcı bir görsel gönderirse görseli analiz et.

Görselde:
- yazı
- Minecraft görüntüsü
- hata mesajı
- web sitesi
- kod
- nesne
- ekran görüntüsü

gibi şeyler varsa bunları mümkün olduğunca incele.

Kullanıcı "bu fotoğrafta ne var?" derse doğrudan görseli analiz et.

Görsel hakkında emin olmadığın şeyleri kesinmiş gibi söyleme.

TEKNİK:

Kod, HTML, JavaScript, Minecraft veya web sitesi
konularında doğrudan ve uygulanabilir cevap ver.

Kullanıcı "kodu ver" derse kodu ver.

${memoryText}
`
    };

    // =========================
    // NORMAL MESAJLAR
    // =========================

    const cleanMessages =
      recentMessages.map((m) => ({
        role:
          m.role === "ai"
            ? "assistant"
            : "user",

        content:
          String(m.text || "")
            .slice(0, 5000)
      }));

    // =========================
    // GÖRSEL VARSA
    // =========================

    if (image) {

      const lastUserText =
        [...recentMessages]
          .reverse()
          .find(m => m.role !== "ai")
          ?.text || "Bu görseli analiz et.";

      const visionMessages = [

        systemMessage,

        ...cleanMessages.slice(0, -1),

        {
          role: "user",

          content: [
            {
              type: "text",
              text: String(lastUserText).slice(0, 4000)
            },

            {
              type: "image_url",
              image_url: {
                url: image
              }
            }
          ]
        }

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

            model:
              "meta-llama/llama-4-scout-17b-16e-instruct",

            messages:
              visionMessages,

            temperature: 0.5,

            max_completion_tokens: 1200
          })
        }
      );

      const data =
        await response.json();

      if (!response.ok) {

        console.error(
          "Groq Vision:",
          data?.error?.message || data
        );

        return new Response(
          JSON.stringify({
            error:
              "Görsel analiz edilirken bir sorun oluştu."
          }),
          {
            status: response.status,
            headers: {
              "Content-Type":
                "application/json"
            }
          }
        );
      }

      const answer =
        data?.choices?.[0]?.message?.content || "";

      if (!answer.trim()) {

        return new Response(
          JSON.stringify({
            error:
              "Görsel hakkında cevap oluşturulamadı."
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

      return new Response(
        JSON.stringify({

          output_text:
            answer.trim(),

          web_used: false,

          image_used: true

        }),
        {
          status: 200,

          headers: {
            "Content-Type":
              "application/json"
          }
        }
      );
    }

    // =========================
    // NORMAL / WEB CEVABI
    // =========================

    const finalMessages = [
      systemMessage,
      ...cleanMessages
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

          model:
            "openai/gpt-oss-120b",

          messages:
            finalMessages,

          temperature: 0.6,

          max_completion_tokens: 1200,

          tools: [
            {
              type: "browser_search"
            }
          ]
        })
      }
    );

    // =========================
    // GROQ CEVABI
    // =========================

    const data =
      await response.json();

    // =========================
    // RATE LIMIT
    // =========================

    if (response.status === 429) {

      const retryAfter =
        response.headers.get("retry-after");

      let waitText =
        "birkaç saniye";

      if (retryAfter) {

        const seconds =
          Math.ceil(Number(retryAfter));

        if (
          Number.isFinite(seconds) &&
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

      console.error(
        "Groq API:",
        data?.error?.message || data
      );

      return new Response(
        JSON.stringify({
          error:
            "BeyinX bağlantısında geçici bir sorun oluştu. " +
            "Biraz sonra tekrar dene. 🤖"
        }),
        {
          status: response.status,

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
            "BeyinX şu anda cevap oluşturamadı."
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
    // WEB KONTROLÜ
    // =========================

    const webUsed =
      Array.isArray(
        message?.executed_tools
      ) &&
      message.executed_tools.length > 0;

    // =========================
    // BAŞARILI
    // =========================

    return new Response(
      JSON.stringify({

        output_text:
          answer.trim(),

        web_used:
          webUsed,

        image_used:
          false

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
          "BeyinX bağlantısında beklenmeyen bir sorun oluştu. " +
          "Biraz sonra tekrar dene. 😅"
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
