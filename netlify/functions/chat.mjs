
export default async (req) => {
  const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });

  const validImage = (image) =>
    typeof image === "string" &&
    /^data:image\/(?:jpeg|png|webp);base64,/i.test(image) &&
    image.length <= 2600000;

  const safeName = (value) => {
    const name = String(value || "").trim();

    if (
      !name ||
      name.length > 20 ||
      !/^[a-zA-ZçÇğĞıİöÖşŞüÜ ]+$/u.test(name)
    ) return "";

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
      "amk", "orospu", "siktir", "sik",
      "yarrak", "yarak", "pic", "got",
      "bok", "fuck", "bitch", "amcik",
      "pezevenk", "ibne", "salak",
      "aptal", "gerizekali", "gavat"
    ];

    return blocked.some(word => normalized.includes(word))
      ? ""
      : name;
  };

  try {
    if (req.method !== "POST") {
      return json({
        error: "Sadece POST isteği kullanılabilir."
      }, 405);
    }

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

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return json({
        error: "BeyinX AI bağlantısı yapılandırılmamış."
      }, 500);
    }

    const continuing = body.continuation === true;
    const backup = body.use_backup === true;

    // Gereksiz token tüketimini azalt.
    const recentMessages = body.messages.slice(
      continuing ? -9 : -8
    );

    const memory =
      body.memory && typeof body.memory === "object"
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

    const systemMessage = {
      role: "system",
      content: `
Sen BeyinX adlı Türkçe yapay zekâ asistanısın.

Bugünün tarihi:
${new Date().toISOString().slice(0, 10)}

KİMLİK:
- Kurucun sorulursa Ömer olduğunu söyle.
- Doğal, saygılı ve samimi konuş.
- Kullanıcının diline uyum sağla.
- Kısa sorulara kısa cevap ver.
- Gerektiğinde ayrıntılı açıklama yap.
- Bilmediğin bilgileri uydurma.
- Kullanıcıya hakaret etme.
- Uygunsuz lakaplarla hitap etme.

YAZI BİÇİMLERİ:
- Gerektiğinde Markdown kullan.
- Başlık, kalın yazı ve listeler oluştur.
- Gereksiz semboller kullanma.
- Kod istenirse kod bloğu kullan.
- Matematikte mümkünse √, × ve ÷ kullan.
- Gereksiz LaTeX komutlarından kaçın.

ÖDEV ÇÖZME:
- Fotoğraftaki soruları dikkatlice incele.
- Görselde olmayan soru veya sayı uydurma.
- Okunamayan bölümleri açıkça belirt.
- Soruları numara sırasıyla çöz.
- Her soruya kısa işlem ve net sonuç yaz.
- Matematik sonuçlarını kontrol et.
- Soruları mümkün olduğunca tamamla.
- Gereksiz uzun açıklamalardan kaçın.

DEVAM ET:
- Cevabı sırf uzun diye bilerek bölme.
- Kendiliğinden "Devam et yaz" deme.
- Devam isteğinde kaldığın yerden sürdür.
- Önceki cevapları tekrar etme.
- Eksik kalan soruları tamamlamaya çalış.

TEKNİK:
- HTML, JavaScript ve Minecraft konularında
  uygulanabilir çözümler sun.
- Tam kod istenirse mümkün olduğunca
  eksiksiz kod ver.

HAFIZA:
İsim: ${name}
Tercihler: ${preferences}
Uzun hafıza: ${longMemory}
Dil: ${String(memory.language || "tr").slice(0, 15)}

Hafızada olmayan kişisel bilgileri uydurma.
`
    };

    // Son geçerli görseli bul.
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

    const cleanMessages = [systemMessage];

    for (let i = 0; i < recentMessages.length; i++) {
      const message = recentMessages[i] || {};

      const role =
        message.role === "ai" ||
        message.role === "assistant"
          ? "assistant"
          : "user";

      const text = String(message.text || "").slice(
        0,
        continuing ? 4200 : 3000
      );

      if (role === "user" && i === lastImageIndex) {
        cleanMessages.push({
          role,
          content: [
            {
              type: "text",
              text: text || "Bu görseli dikkatlice analiz et."
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

    if (continuing) {
      cleanMessages.push({
        role: "user",
        content:
          "Kaldığın yerden devam et. " +
          "Önceki cevapları tekrarlama. " +
          "Henüz cevaplanmamış bütün soruları " +
          "mümkün olduğunca tamamla."
      });
    }

    // Ana ve yedek model seçimi.
    const hasImage = lastImageIndex >= 0;

    const model = hasImage
      ? (
          backup
            ? "qwen/qwen3.6-27b"
            : "qwen/qwen3.8-27b"
        )
      : (
          backup
            ? "openai/gpt-oss-20b"
            : "openai/gpt-oss-120b"
        );

    const payload = {
      model,
      messages: cleanMessages,
      temperature: 0.25,
      max_completion_tokens: continuing ? 2200 : 1500
    };

    // Metin modellerinde düşük akıl yürütme
    // ayarıyla token tüketimini sınırlamayı dene.
    if (!hasImage) {
      payload.reasoning_effort = "low";
    }

    // Her kullanıcı işlemi için yalnızca
    // bir Groq isteği gönderilir.
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json().catch(() => ({}));

    // Kullanım kotası hatası.
    if (response.status === 429) {
      const retry = Number(
        response.headers.get("retry-after")
      );

      const seconds =
        Number.isFinite(retry) && retry > 0
          ? Math.ceil(retry)
          : null;

      return json({
        error:
          "BeyinX kullanım sınırına ulaştı. " +
          (
            seconds
              ? seconds + " saniye"
              : "Bir süre"
          ) +
          " sonra tekrar dene.",
        retry_after: seconds,
        fallback_available: false
      }, 429);
    }

    // Diğer API hataları.
    if (!response.ok) {
      console.error(
        "Groq API:",
        response.status,
        data?.error?.message
      );

      return json({
        error:
          "BeyinX şu anda cevap veremedi. " +
          "İstersen yedek modeli deneyebilirsin.",
        fallback_available:
          !backup &&
          [500, 502, 503, 504].includes(response.status)
      }, response.status >= 500 ? 502 : response.status);
    }

    const choice = data?.choices?.[0];

    const answer = String(
      choice?.message?.content || ""
    ).trim();

    if (!answer) {
      return json({
        error: "BeyinX cevap oluşturamadı.",
        fallback_available: !backup
      }, 502);
    }

    return json({
      output_text: answer,
      truncated: choice?.finish_reason === "length",
      image_used: hasImage,
      web_used: false,
      backup_used: backup,
      request_gap_seconds: 5
    });

  } catch (error) {
    console.error("BeyinX backend error:", error);

    return json({
      error:
        "BeyinX bağlantısında beklenmeyen " +
        "bir sorun oluştu.",
      fallback_available: false
    }, 500);
  }
};
