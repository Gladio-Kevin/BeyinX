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

    // Frontend'den gelen sıkıştırılmış base64 görsel
    const image =
      typeof body.image === "string" &&
      body.image.startsWith("data:image/")
        ? body.image
        : null;

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

    const apiKey = process.env.GROQ_API_KEY;

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
    // MESAJLAR
    // =========================

    const recentMessages =
      messages.slice(-10);

    // =========================
    // HAFIZA
    // =========================

    let memoryText = "";

    if (memory.name) {
      memoryText +=
        `Kullanıcının adı: ${String(memory.name).slice(0, 50)}\n`;
    }

    if (Array.isArray(memory.preferences)) {

      const preferences =
        memory.preferences
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
    // SİSTEM
    // =========================

    const systemMessage = {
      role: "system",

      content: `
Sen BeyinX-AI adlı Türkçe yapay zeka asistanısın.

Bugünün tarihi: ${currentDate}

Kullanıcıyla doğal, samimi ve anlaşılır konuş.

GENEL DAVRANIŞ:

- Kısa soruya kısa cevap ver.
- Detay istenirse detaylandır.
- Gereksiz robotik konuşma yapma.
- Kullanıcının konuşma tarzına uyum sağla.
- Türkçe konuşuluyorsa Türkçe cevap ver.
- Kullanıcı başka dile geçerse o dile uyum sağla.
- Gerektiğinde az miktarda emoji kullan.

HAFIZA:

Sana verilen kullanıcı hafızasını kullan.

Hafızada bulunan bilgileri sonraki konuşmalarda
tutarlı şekilde hatırla.

Hafızada olmayan bilgileri uydurma.

Örneğin kullanıcı daha önce Minecraft oynadığını
söylediyse ve bu bilgi hafızada bulunuyorsa,
sonraki sohbetlerde bunu tekrar sorma.

Kullanıcının hafızasında:
${memoryText}

GÖRSEL ANALİZ:

Kullanıcı bir görsel gönderirse görseli analiz et.

Görselde:
- yazıları,
- oyunları,
- Minecraft ekranlarını,
- arayüzleri,
- nesneleri,
- genel görüntüyü

mümkün olduğunca doğru şekilde açıklayabilirsin.

Görsel gönderildiğinde "görseli alamadım" gibi
bir cevap verme.

Görsel gerçekten modele ulaşmadıysa bunu belirt.

Kullanıcı görseldeki bir oyunun adını sorarsa,
görseldeki ipuçlarından hareketle cevap ver.

GÜNCEL BİLGİLER:

Güncel bilgi gerektiğinde web aramasını kullan.

Özellikle:
- bugün
- şu an
- şimdi
- dün
- yarın
- güncel
- en son
- 2026
- haber
- fiyat
- hava durumu
- yeni sürüm

gibi ifadelerde güncel bilgi gerektiğini düşün.

Web araması kullanıldığında elde edilen bilgileri
kaynaklara dayanarak özetle.

Web kullanılamıyorsa bunu açıkça belirt.

BEYİNX KİMLİĞİ:

BeyinX-AI'nin kurucusu sorulursa:

"Benim kurucum Ömer, diğer adıyla Kevin. BeyinX-AI'yi o kurdu."

şeklinde cevap ver.

TEKNİK KONULAR:

HTML, JavaScript, Minecraft ve benzeri teknik
konularda doğrudan uygulanabilir cevaplar ver.

Kullanıcı "kodu ver" derse mümkün olduğunca
doğrudan kodu ver.
`
    };

    // =========================
    // MESAJLARI OLUŞTUR
    // =========================

    const cleanMessages = [
      systemMessage,

      ...recentMessages.map(m => ({
        role:
          m.role === "ai"
            ? "assistant"
            : "user",

        content:
          String(m.text || "")
            .slice(0, 4000)
      }))
    ];

    // =========================
    // GÖRSEL VARSA
    // =========================

    if (image) {

      const lastUserIndex =
        cleanMessages.length - 1;

      if (
        cleanMessages[lastUserIndex] &&
        cleanMessages[lastUserIndex].role === "user"
      ) {

        const userText =
          cleanMessages[lastUserIndex].content;

        cleanMessages[lastUserIndex] = {

          role: "user",

          content: [

            {
              type: "text",

              text:
                userText ||
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

    }

    // =========================
    // MODEL
    // =========================

    // Görsel varsa vision destekli model,
    // yoksa normal model kullanıyoruz.

    const model =
      image
        ? "meta-llama/llama-4-scout-17b-16e-instruct"
        : "openai/gpt-oss-120b";

    // =========================
    // GROQ
    // =========================

    const response = await fetch(
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

          model,

          messages:
            cleanMessages,

          temperature:
            0.6,

          max_completion_tokens:
            1200

        })
      }
    );

    const data =
      await response.json();

    // =========================
    // RATE LIMIT
    // =========================

    if (response.status === 429) {

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

      const apiError =
        data?.error?.message || "";

      console.error(
        "Groq API:",
        apiError
      );

      return new Response(
        JSON.stringify({

          error:
            "BeyinX bağlantısında geçici bir sorun oluştu. " +
            "Biraz sonra tekrar dene. 🤖"

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
            "BeyinX şu anda cevap oluşturamadı. " +
            "Tekrar deneyebilirsin."

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
          Boolean(image)

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
