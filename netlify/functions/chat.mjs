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
    // AKILLI BAĞLAM
    // =========================

    // Gereksiz token tüketimini azaltmak
    // için son 10 mesajı gönderiyoruz.
    const recentMessages = messages.slice(-10);

    // =========================
    // KİŞİSELLEŞTİRME
    // =========================

    let memoryText = "";

    if (memory.name) {
      memoryText +=
        `Kullanıcının adı: ${String(memory.name).slice(0, 50)}\n`;
    }

    if (Array.isArray(memory.preferences)) {
      const preferences = memory.preferences
        .slice(0, 10)
        .map(x => String(x).slice(0, 150))
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
    // GÜNCEL TARİH
    // =========================

    const currentDate = new Date().toISOString().slice(0, 10);

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
- Gerektiğinde az miktarda emoji kullan.
- Her cümlede emoji kullanma.
- Gereksiz yere kendini tanıtma.
- Robotik cevaplar verme.
- Türkçe konuşuluyorsa Türkçe cevap ver.
- Kullanıcı başka bir dile geçerse o dile uyum sağla.
- Kullanıcının yazışma tonuna mümkün olduğunca uyum sağla.

EMOJİ:

Uygun yerlerde:
🙂 😄 🤔 💡 👍 🔥 🚀 🧠

kullanabilirsin.

Ancak emojileri abartma.

BİÇİMLENDİRME:

ASCII çizgileri veya dekoratif ayraçlar kullanma.

Örneğin:

-----------
================

gibi şeyler kullanma.

Bunun yerine:

Başlık

• Madde
• Madde

gibi temiz biçimlendirme kullan.

BEYİNX-AI KİMLİĞİ:

BeyinX-AI'nin kurucusu sorulursa:

"Benim kurucum Ömer, diğer adıyla Kevin. BeyinX-AI'yi o kurdu."

şeklinde doğal cevap ver.

Kullanıcı BeyinX-AI'nin ne olduğunu sorarsa bunun
bir yapay zeka asistanı olduğunu açıkla.

GÜNCEL BİLGİLER:

ÇOK ÖNEMLİ:

Kullanıcı güncel veya zamanla değişebilen bir bilgi
sorarsa web aramasını kullan.

Özellikle şu ifadeler güncel bilgi gerektirir:

- bugün
- şu an
- şimdi
- dün
- yarın
- bu hafta
- son
- en son
- güncel
- günümüzde
- 2026
- fiyat
- hava durumu
- haber
- son gelişmeler
- yeni sürüm

Bu tür sorularda eski eğitim bilgilerine dayanarak
cevap verme.

Web araması yapmadan güncel bir bilgiyi kesinmiş gibi
söyleme.

Örneğin kullanıcı:

"Bugün hava nasıl?"

derse güncel hava bilgisini aramaya çalış.

Ancak kullanıcının şehri veya konumu bilinmiyorsa
şehir uydurma.

Bunun yerine:

"Hangi şehir için hava durumuna bakayım?"

diye sor.

Benzer şekilde güncel haber veya fiyat sorularında
gerekli konum/ürün belirtilmemişse bunu netleştir.

Web araması sonucundaki bilgileri kaynaklara dayanarak
özetle.

Web araması yapılamıyorsa bunu açıkça belirt ve
eski bilgiyi güncelmiş gibi gösterme.

TARİH:

Bugünün tarihi ${currentDate}.

Kullanıcı "bugün", "yarın", "dün" veya benzeri
göreceli bir tarih kullanırsa bu tarihi esas al.

2024 veya daha eski bir bilgiyi sırf eğitim verisinde
bulunduğu için güncel bilgi olarak kullanma.

KİŞİSELLEŞTİRME:

Sana verilen kullanıcı hafızasını cevaplarını
kişiselleştirmek için kullan.

Hafızada olmayan bilgileri uydurma.

DUYGUSAL TON:

Kullanıcının mesajının tonuna dikkat et.

Örneğin kullanıcı:

- heyecanlıysa daha enerjik,
- üzgün görünüyorsa daha sakin,
- sinirliyse sakin ve net,
- normal konuşuyorsa normal

bir ton kullan.

Ancak kullanıcı hakkında psikolojik veya tıbbi
teşhis yapma.

HAFIZA:

Önceki mesajlardan gelen bilgileri tutarlı şekilde
kullan.

Fakat emin olmadığın kişisel bilgileri gerçekmiş gibi
söyleme.

TEKNİK SORULAR:

Kod, Minecraft, HTML, JavaScript veya benzeri
teknik konularda mümkün olduğunca doğrudan,
uygulanabilir ve anlaşılır cevap ver.

Kullanıcı "kodu ver" diyorsa gereksiz yere uzun
açıklamalar yapmadan kodu ver.

${memoryText}
`
    };

    // =========================
    // MESAJLARI TEMİZLE
    // =========================

    const cleanMessages = [
      systemMessage,

      ...recentMessages.map((m) => ({
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
    // GROQ API
    // =========================

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

          temperature: 0.6,

          max_completion_tokens: 1000,

          // Güncel bilgi gerektiğinde
          // web araması kullanılabilir.
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

    const data = await response.json();

    // =========================
    // RATE LIMIT
    // =========================

    if (response.status === 429) {
      const retryAfter =
        response.headers.get("retry-after");

      let waitText = "birkaç saniye";

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
    // DİĞER API HATALARI
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
      );

    // =========================
    // BAŞARILI
    // =========================

    return new Response(
      JSON.stringify({
        output_text:
          answer.trim(),

        web_used:
          webUsed
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
