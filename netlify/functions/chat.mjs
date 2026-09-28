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
      messages.slice(-14);

    // =========================
    // GÖRSEL KONTROLÜ
    // =========================

    const hasImage =
      recentMessages.some(
        (message) =>
          typeof message?.image === "string" &&
          message.image.startsWith("data:image/")
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
          .slice(0, 20)
          .map(
            (item) =>
              String(item).slice(0, 200)
          )
          .join(", ");

      if (preferences) {
        memoryText +=
          `Kullanıcı tercihleri: ${preferences}\n`;
      }
    }

    // =========================
    // UZUN SÜRELİ HAFIZA
    // =========================

    if (
      Array.isArray(
        memory.long_memory
      )
    ) {

      const longMemory =
        memory.long_memory
          .slice(0, 30)
          .map(
            (item) =>
              String(item).slice(0, 300)
          );

      if (longMemory.length > 0) {

        memoryText +=
          `Uzun süreli kullanıcı hafızası:\n`;

        for (const item of longMemory) {
          memoryText +=
            `- ${item}\n`;
        }
      }
    }

    // =========================
    // DİL
    // =========================

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

Bugünün tarihi:
${currentDate}

Kullanıcıyla doğal, samimi ve anlaşılır konuş.

GENEL DAVRANIŞ:

- Kısa soruya kısa cevap ver.
- Detay istenirse detaylı cevap ver.
- Gereksiz uzun konuşma yapma.
- Robotik cevap verme.
- Türkçe konuşuluyorsa Türkçe cevap ver.
- Kullanıcı başka dile geçerse o dile geç.
- Kullanıcının konuşma tarzına uyum sağla.
- Kullanıcı argo kullanıyorsa bağlama uygun şekilde doğal konuşabilirsin.
- Gereksiz emoji kullanma.

TÜRKÇE:

Türkçe deyimleri, günlük konuşmayı, internet dilini,
kısaltmaları ve yaygın argoyu bağlama göre anlamaya çalış.

Kullanıcının söylediği bir şeyi yanlış anladığında
uydurma yapmak yerine netleştir.

BEYİNX KİMLİĞİ:

BeyinX-AI'nin kurucusu sorulursa:

"Benim kurucum Ömer, diğer adıyla Kevin. BeyinX-AI'yi o kurdu."

şeklinde cevap ver.

GÜNCEL BİLGİLER:

Güncel veya değişebilen bilgiler için web aramasını
kullan.

Özellikle:

- bugün
- şu an
- şimdi
- dün
- yarın
- bu hafta
- son
- en son
- güncel
- 2026
- fiyat
- haber
- hava durumu
- yeni sürüm
- son gelişmeler

gibi ifadeler güncel bilgi gerektirebilir.

Web araması yapmadan güncel bilgiyi kesinmiş gibi
sunma.

Görüşme sırasında web araması sonucu geldiyse
sonuçları açık ve anlaşılır şekilde özetle.

WEB KAYNAKLARI:

Web araştırması yaptığında mümkün olduğunca
bilginin hangi kaynaktan geldiğini belirt.

GÖRSEL ANALİZ:

Kullanıcı görsel gönderirse görseli incele.

Görselde:

- nesneleri
- yazıları
- ekran görüntülerini
- grafikleri
- Minecraft görüntülerini
- web sitelerini
- fotoğrafları

analiz edebilirsin.

Görselde okunamayan veya kesin olmayan bir şey varsa
uydurma.

Kullanıcı görselle ilgili belirli bir soru sorarsa
öncelikle o soruya cevap ver.

UZUN SÜRELİ HAFIZA:

Sana verilen "Uzun süreli kullanıcı hafızası"
bilgilerini cevaplarını kişiselleştirmek için kullan.

Hafızada olmayan kişisel bilgileri uydurma.

Kullanıcı "bunu hatırla" dediğinde uygulamanın
hafıza sisteminin bu bilgiyi kaydedebileceğini
varsay.

Kullanıcı "bunu unut" dediğinde ilgili bilgiyi
hafızadan çıkarmaya uygun cevap ver.

HARİCİ UYGULAMALAR:

Takvim, notlar ve e-posta gibi servisler ileride
BeyinX'e bağlanabilir.

Bu servisler gerçekten bağlanmamışsa işlem yapılmış
gibi davranma.

Örneğin takvim bağlantısı yoksa:

"Takvim bağlantısı henüz etkin değil."

gibi açıkça belirt.

TEKNİK SORULAR:

HTML, CSS, JavaScript, Minecraft, kodlama ve teknik
sorularda doğrudan ve uygulanabilir cevaplar ver.

Kullanıcı "kodu ver" diyorsa gereksiz açıklama yerine
kullanabileceği kodu ver.

DUYGUSAL TON:

Kullanıcının tonuna uyum sağla.

Sinirliyse sakin ve net,
heyecanlıysa enerjik,
normal konuşuyorsa doğal konuş.

Hafızadaki bilgiler:

${memoryText}
`
    };

    // =========================
    // MESAJLARI TEMİZLE
    // =========================

    const cleanMessages = [

      systemMessage,

      ...recentMessages.map(
        (message) => {

          const role =
            message.role === "ai"
              ? "assistant"
              : "user";

          // -------------------------
          // GÖRSELLİ MESAJ
          // -------------------------

          if (
            typeof message.image === "string" &&
            message.image.startsWith(
              "data:image/"
            )
          ) {

            return {

              role,

              content: [

                {
                  type: "text",

                  text:
                    String(
                      message.text || ""
                    ).slice(0, 4000)
                },

                {
                  type: "image_url",

                  image_url: {
                    url:
                      message.image
                  }
                }

              ]

            };
          }

          // -------------------------
          // NORMAL MESAJ
          // -------------------------

          return {

            role,

            content:
              String(
                message.text || ""
              ).slice(0, 4000)

          };

        }
      )

    ];

    // =========================
    // MODEL
    // =========================

    /*
      Görsel varsa görsel destekli model,
      normal mesajlarda ana model.
    */

    const model =
      hasImage
        ? "meta-llama/llama-4-scout-17b-16e-instruct"
        : "openai/gpt-oss-120b";

    // =========================
    // GROQ İSTEĞİ
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

          body: JSON.stringify({

            model,

            messages:
              cleanMessages,

            temperature:
              0.6,

            max_completion_tokens:
              1200,

            /*
              Güncel bilgi için web araması.
            */

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
            `Çok fazla istek geldi.\n\n` +
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
        data?.error
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
    // MESAJ
    // =========================

    const message =
      data?.choices?.[0]?.message;

    const answer =
      message?.content || "";

    // =========================
    // BOŞ CEVAP
    // =========================

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
    // WEB KULLANILDI MI?
    // =========================

    const webUsed =
      Array.isArray(
        message?.executed_tools
      ) &&
      message.executed_tools.length > 0;

    // =========================
    // GÖRSEL KULLANILDI MI?
    // =========================

    const visionUsed =
      hasImage;

    // =========================
    // CEVAP
    // =========================

    return new Response(

      JSON.stringify({

        output_text:
          answer.trim(),

        web_used:
          webUsed,

        vision_used:
          visionUsed,

        memory_used:
          Boolean(
            memory.name ||
            memory.long_memory?.length ||
            memory.preferences?.length
          )

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
