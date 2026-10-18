
export default async (req) => {
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      }
    });

  try {
    if (req.method !== "POST") {
      return json({ error: "Sadece POST isteği kullanılabilir." }, 405);
    }

    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const memory = body.memory && typeof body.memory === "object"
      ? body.memory
      : {};

    if (!messages.length) {
      return json({ error: "Gönderilecek mesaj bulunamadı." }, 400);
    }

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return json({
        error: "BeyinX AI bağlantısı yapılandırılmamış."
      }, 500);
    }

    const recentMessages = messages.slice(-12);

    const hasImage = recentMessages.some(
      m => m?.role === "user" &&
      typeof m.image === "string" &&
      m.image.startsWith("data:image/")
    );

    const memoryText = [
      memory.name
        ? "Kullanıcının adı: " + String(memory.name).slice(0, 20)
        : "",
      Array.isArray(memory.preferences)
        ? "Tercihler: " + memory.preferences.slice(0, 10)
            .map(x => String(x).slice(0, 150)).join(", ")
        : "",
      Array.isArray(memory.long_memory)
        ? "Hatırlanan bilgiler: " + memory.long_memory.slice(0, 30)
            .map(x => String(x).slice(0, 200)).join("; ")
        : "",
      "Dil: " + String(memory.language || "tr").slice(0, 30)
    ].filter(Boolean).join("\n");

    const today = new Date().toISOString().slice(0, 10);

    const systemMessage = {
      role: "system",
      content: `
Sen BeyinX adlı Türkçe yapay zekâ asistanısın.
Bugünün tarihi: ${today}.

GENEL KURALLAR:
- Doğal, samimi ve anlaşılır konuş.
- Kullanıcı kısa sorarsa kısa, ayrıntı isterse ayrıntılı cevap ver.
- Gereksiz girişleri ve tekrarları azalt.
- Kullanıcının diline uyum sağla.
- Emin olmadığın bilgileri kesinmiş gibi sunma.
- Güncel bilgiye erişimin yoksa bunu açıkça söyle.
- BeyinX'in kurucusu sorulursa Ömer olduğunu söyle.
- Kullanıcının hafızasındaki bilgileri gerektiğinde kullan.
- Hafızada olmayan kişisel bilgileri uydurma.

ÖDEV VE MATEMATİK:
- Kullanıcı ödev çözmeni isterse soruları sırayla çöz.
- Önce soruyu doğru okuduğundan emin ol.
- Görsel bulanıksa rakam veya işlem uydurma.
- Okunamayan bölümü açıkça belirt.
- Okuyabildiğin soruları çözmeye devam et.
- Çözümleri öğrencinin anlayabileceği sade Türkçeyle yaz.
- Her soru için önce kısa işlem, ardından net sonuç ver.
- Gereksiz uzun açıklamalardan kaçın.
- Soruların tamamını mümkün olduğunca yanıtla.
- Cevap uzunsa mantıklı bir yerde dur ve
  "Devamı için Devam et yaz." de.
- Cevabı bir cümlenin veya işlemin ortasında kesme.
- Matematik ifadelerini mümkün olduğunca
  okunabilir düz metinle göster.
- Örneğin karekök için √, çarpma için × kullan.
- Gereksiz LaTeX komutları kullanma.
- Kesirleri gerektiğinde (a/b) biçiminde yaz.
- Matematik işlemlerinin doğruluğunu kontrol et.

GÖRSEL ANALİZ:
- Gönderilen fotoğrafı dikkatlice incele.
- Görselde gerçekten bulunan içerikten söz et.
- Fotoğrafı görmediysen gördüğünü iddia etme.
- Görselde olmayan sorular, sayılar veya metinler üretme.
- Sorular çoksa numara sırasını koru.
- Belirsiz karakterleri tahmin etmek yerine belirt.
- Kullanıcıdan aynı görseli gereksiz yere yeniden isteme.

KOD VE TEKNİK:
- HTML, JavaScript ve Minecraft gibi konularda
  uygulanabilir çözümler üret.
- Kullanıcı tam kod isterse eksik parça bırakma.
- Mevcut özellikleri korumak önemliyse bunu gözet.

KULLANICI HAFIZASI:
${memoryText}
`
    };

    const cleanMessages = [
      systemMessage,
      ...recentMessages.map(m => {
        const role = m.role === "ai" || m.role === "assistant"
          ? "assistant"
          : "user";

        const text = String(m.text || "").slice(0, 5000);

        const image = role === "user" &&
          typeof m.image === "string" &&
          /^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(m.image) &&
          m.image.length <= 2500000
            ? m.image
            : null;

        if (image) {
          return {
            role: "user",
            content: [
              {
                type: "text",
                text: text || "Bu görseli dikkatlice analiz et."
              },
              {
                type: "image_url",
                image_url: { url: image }
              }
            ]
          };
        }

        return { role, content: text };
      })
    ];

    const model = hasImage
      ? "qwen/qwen3.8-27b"
      : "openai/gpt-oss-120b";

    const requestBody = {
      model,
      messages: cleanMessages,
      temperature: 0.3,
      max_completion_tokens: 3500
    };

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      }
    );

    let data;

    try {
      data = await response.json();
    } catch {
      return json({
        error: "Sunucudan geçersiz cevap geldi."
      }, 502);
    }

    if (response.status === 429) {
      const retryAfter = Number(
        response.headers.get("retry-after")
      );

      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? `${Math.ceil(retryAfter)} saniye`
        : "biraz";

      return json({
        error: `BeyinX şu anda yoğun. ${wait} bekleyip tekrar dene.`
      }, 429);
    }

    if (!response.ok) {
      console.error("Groq API hatası:", data?.error);

      return json({
        error: data?.error?.message ||
          "BeyinX bağlantısında geçici bir sorun oluştu."
      }, response.status);
    }

    const choice = data?.choices?.[0];
    const answer = String(choice?.message?.content || "").trim();

    if (!answer) {
      return json({
        error: "BeyinX cevap oluşturamadı. Tekrar dene."
      }, 502);
    }

    const truncated = choice?.finish_reason === "length";

    return json({
      output_text: answer +
        (truncated
          ? "\n\nYanıt sınırına ulaşıldı. Devam et yazarak sürdürebilirsin."
          : ""),
      web_used: false,
      image_used: hasImage,
      truncated
    });

  } catch (error) {
    console.error("BeyinX backend error:", error);

    return json({
      error: "BeyinX bağlantısında beklenmeyen bir sorun oluştu. Biraz sonra tekrar dene."
    }, 500);
  }
};
