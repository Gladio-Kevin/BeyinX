
export default async (req) => {

  // =========================
  // YARDIMCI FONKSİYONLAR
  // =========================

  const json = (data, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  };

  const validImage = (image) => {
    return (
      typeof image === "string" &&
      /^data:image\/(?:jpeg|png|webp);base64,/i.test(image) &&
      image.length <= 2600000
    );
  };

  const safeName = (value) => {
    const name = String(value || "").trim();

    if (
      !name ||
      name.length > 20 ||
      !/^[a-zA-ZçÇğĞıİöÖşŞüÜ ]+$/u.test(name)
    ) {
      return "";
    }

    const normalized = name
      .toLocaleLowerCase("tr-TR")
      .replace(/\s+/g, "")
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c");

    const blocked = [
      "amk",
      "orospu",
      "siktir",
      "sik",
      "yarrak",
      "yarak",
      "pic",
      "got",
      "bok",
      "fuck",
      "bitch",
      "amcik",
      "pezevenk",
      "ibne",
      "salak",
      "aptal",
      "gerizekali",
      "gavat"
    ];

    return blocked.some(word => normalized.includes(word))
      ? ""
      : name;
  };

  try {

    // =========================
    // SADECE POST
    // =========================

    if (req.method !== "POST") {
      return json({
        error: "Sadece POST isteği kullanılabilir."
      }, 405);
    }

    // =========================
    // GELEN VERİLER
    // =========================

    const body = await req.json().catch(() => null);

    if (
      !body ||
      !Array.isArray(body.messages) ||
      body.messages.length === 0
    ) {
      return json({
        error: "Gönderilecek mesaj bulunamadı."
      }, 400);
    }

    // =========================
    // GROQ API KEY
    // =========================

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return json({
        error: "BeyinX AI bağlantısı yapılandırılmamış."
      }, 500);
    }

    // =========================
    // DEVAM ET KONTROLÜ
    // =========================

    const continuing = body.continuation === true;

    // Son mesajları alarak token tüketimini azalt.
    const recentMessages = body.messages.slice(
      continuing ? -9 : -8
    );

    // =========================
    // HAFIZA
    // =========================

    const memory =
      body.memory &&
      typeof body.memory === "object"
        ? body.memory
        : {};

    const name = safeName(memory.name);

    const preferences = Array.isArray(memory.preferences)
      ? memory.preferences
          .slice(0, 6)
          .map(x => String(x).slice(0, 90))
          .join("; ")
      : "";

    const longMemory = Array.isArray(memory.long_memory)
      ? memory.long_memory
          .slice(0, 8)
          .map(x => String(x).slice(0, 100))
          .join("; ")
      : "";

    const language = String(
      memory.language || "tr"
    ).slice(0, 15);

    // =========================
    // SİSTEM TALİMATLARI
    // =========================

    const systemMessage = {
      role: "system",
      content: `
Sen BeyinX adlı Türkçe yapay zekâ asistanısın.

Bugünün tarihi:
${new Date().toISOString().slice(0, 10)}

KİMLİK:
- BeyinX'in kurucusu sorulursa Ömer olduğunu söyle.
- Kullanıcıyla doğal ve samimi konuş.
- Kullanıcının diline uyum sağla.
- Kısa sorulara kısa cevap ver.
- Detaylı sorulara açıklayıcı cevap ver.
- Bilmediğin şeyleri uydurma.
- Güncel bilgiye erişimin yoksa belirt.

SAYGILI KONUŞMA:
- Kullanıcıya hakaret etme.
- Uygunsuz lakaplarla hitap etme.
- Kullanıcının ismi uygunsuzsa kullanma.
- Her zaman saygılı ve yardımcı ol.

YAZI BİÇİMLERİ:
- Gerektiğinde Markdown kullan.
- Başlıkları düzgün oluştur.
- Önemli ifadeleri kalın yazabilirsin.
- Listeleri anlaşılır biçimde hazırla.
- Gereksiz semboller kullanma.
- Kod istenirse kod bloğu kullan.
- Matematikte mümkün olduğunca
  √, × ve ÷ işaretlerini tercih et.
- Gereksiz LaTeX komutları kullanma.

ÖDEV ÇÖZME:
- Soruları sırayla çöz.
- Fotoğraftaki yazıları dikkatlice incele.
- Görselde olmayan sorular üretme.
- Okunmayan sayıları tahmin etme.
- Belirsiz kısımları açıkça belirt.
- Kısa ve anlaşılır işlemler göster.
- Her sorunun sonucunu açıkça yaz.
- Gereksiz uzun açıklamalardan kaçın.
- Soruları mümkün olduğunca tamamla.
- Matematik işlemlerini kontrol et.

GÖRSEL ANALİZ:
- Gerçekten gördüğün şeyleri açıkla.
- Görseli göremiyorsan uydurma.
- Fotoğrafta olmayan bilgi ekleme.
- Görseldeki soru numaralarını koru.
- Bulanık bölümleri belirt.

DEVAM ET:
- Kullanıcı devam etmek istiyorsa
  kaldığın yerden sürdür.
- Önceki cevapları tekrar etme.
- Eksik kalan bütün soruları çözmeye çalış.
- Cevabı gereksiz yere bölme.
- Sırf uzun diye kendiliğinden durma.
- Bir işlemin ortasında durmamaya çalış.
- Devam ederken yeni bir giriş yazma.
- Doğrudan eksik kalan bölümden başla.

TEKNİK KONULAR:
- HTML, JavaScript ve Minecraft
  gibi konularda yardımcı ol.
- Kullanıcı tam kod isterse
  mümkün olduğunca eksiksiz kod ver.
- Mevcut özellikleri korumaya çalış.

KULLANICI HAFIZASI:
İsim: ${name}
Tercihler: ${preferences}
Uzun hafıza: ${longMemory}
Dil: ${language}

Hafızada olmayan kişisel bilgileri uydurma.
`
    };

    // =========================
    // GÖRSEL KONTROLÜ
    // =========================

    let lastImageIndex = -1;

    for (let i = 0; i < recentMessages.length; i++) {
      const message = recentMessages[i];

      if (
        message?.role === "user" &&
        validImage(message.image)
      ) {
        lastImageIndex = i;
      }
    }

    // =========================
    // MESAJLARI HAZIRLA
    // =========================

    const cleanMessages = [systemMessage];

    for (let i = 0; i < recentMessages.length; i++) {

      const message = recentMessages[i] || {};

      const role =
        message.role === "ai" ||
        message.role === "assistant"
          ? "assistant"
          : "user";

      const text = String(
        message.text || ""
      ).slice(
        0,
        continuing ? 4200 : 3000
      );

      if (
        role === "user" &&
        i === lastImageIndex
      ) {

        cleanMessages.push({
          role: "user",
          content: [
            {
              type: "text",
              text:
                text ||
                "Bu görseli dikkatlice analiz et."
            },
            {
              type: "image_url",
              image_url: {
                url: message.image
              }
            }
          ]
        });

      } else {

        cleanMessages.push({
          role,
          content: text || " "
        });

      }
    }

    // =========================
    // DEVAM ET TALİMATI
    // =========================

    if (continuing) {

      cleanMessages.push({
        role: "user",
        content:
          "Kaldığın yerden devam et. " +
          "Önceki cevapları tekrarlama. " +
          "Henüz cevaplanmamış soruları " +
          "mümkün olduğunca tamamla. " +
          "Doğrudan kaldığın yerden başla."
      });

    }

    // =========================
    // MODEL SEÇİMİ
    // =========================

    const hasImage = lastImageIndex >= 0;

    const model = hasImage
      ? "qwen/qwen3.8-27b"
      : "openai/gpt-oss-120b";

    // =========================
    // KREDİ TASARRUFU
    // =========================

    const maxTokens = continuing ? 2200 : 1500;

    const requestBody = {
      model,
      messages: cleanMessages,
      temperature: 0.25,
      max_completion_tokens: maxTokens
    };

    // =========================
    // GROQ İSTEĞİ
    // =========================

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      }
    );

    const data = await response.json().catch(() => ({}));

    // =========================
    // KULLANIM SINIRI
    // =========================

    if (response.status === 429) {

      const retryAfter = Number(
        response.headers.get("retry-after")
      );

      const wait =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? `${Math.ceil(retryAfter)} saniye`
          : "bir süre";

      return json({
        error:
          "BeyinX kullanım sınırına ulaştı. " +
          `${wait} bekleyip tekrar dene.`,
        retry_after:
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.ceil(retryAfter)
            : null
      }, 429);
    }

    // =========================
    // API HATALARI
    // =========================

    if (!response.ok) {

      console.error(
        "Groq API hatası:",
        response.status,
        data?.error?.message
      );

      return json({
        error:
          "BeyinX şu anda cevap veremedi. " +
          "Biraz sonra tekrar dene."
      }, response.status >= 500 ? 502 : response.status);
    }

    // =========================
    // YAPAY ZEKÂ CEVABI
    // =========================

    const choice = data?.choices?.[0];

    const answer = String(
      choice?.message?.content || ""
    ).trim();

    if (!answer) {
      return json({
        error:
          "BeyinX cevap oluşturamadı. Tekrar dene."
      }, 502);
    }

    const truncated =
      choice?.finish_reason === "length";

    // =========================
    // BAŞARILI CEVAP
    // =========================

    return json({
      output_text: answer,
      truncated,
      image_used: hasImage,
      web_used: false
    });

  } catch (error) {

    console.error(
      "BeyinX backend error:",
      error
    );

    return json({
      error:
        "BeyinX bağlantısında beklenmeyen " +
        "bir sorun oluştu."
    }, 500);

  }

};
