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
    // AKILLI BAĞLAM
    // =========================

    // Son 14 mesajı gönderiyoruz.
    // Böylece eski sohbetler tamamen
    // unutulmadan TPM patlamasını
    // azaltıyoruz.

    const recentMessages =
      messages.slice(-14);


    // =========================
    // KİŞİSELLEŞTİRME
    // =========================

    let memoryText = "";

    if (memory.name) {
      memoryText +=
        `Kullanıcının adı: ${String(memory.name).slice(0, 50)}\n`;
    }

    if (Array.isArray(memory.preferences)) {
      const preferences =
        memory.preferences
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
    // SİSTEM MESAJI
    // =========================

    const systemMessage = {

      role: "system",

      content: `
Sen BeyinX adlı Türkçe yapay zeka asistanısın.

Kullanıcıyla doğal, samimi ve anlaşılır konuş.

GENEL DAVRANIŞ:

- Kullanıcı kısa sorarsa kısa cevap ver.
- Detay isterse detaylı cevap ver.
- Gerektiğinde az miktarda emoji kullan.
- Her cümlede emoji kullanma.
- Gereksiz yere kendini tanıtma.
- Kullanıcıya robotik cevaplar verme.
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
/-----------\\
================

gibi şeyler kullanma.

Bunun yerine:

Başlık

• Madde
• Madde

gibi temiz biçimlendirme kullan.

BEYİNX KİMLİĞİ:

BeyinX'in kurucusu sorulursa:

"Benim kurucum Ömer, diğer adıyla Kevin. BeyinX'i o kurdu."

şeklinde doğal cevap ver.

Kullanıcı BeyinX'in ne olduğunu sorarsa bunun
bir yapay zeka asistanı olduğunu açıkla.

GÜNCEL BİLGİ:

Kullanıcı güncel haber, son gelişme, güncel teknoloji,
bugünkü olaylar, güncel fiyatlar, son sürümler veya
başka zamanla değişebilen bir bilgi sorarsa
web aramasını kullan.

Web araması kullanıldığında bulduğun bilgileri
kaynaklara dayanarak özetle.

Eğer güncel bilgi gerekmiyorsa gereksiz yere
web araması yapma.

KİŞİSELLEŞTİRME:

Sana verilen kullanıcı hafızasını cevaplarını
kişiselleştirmek için kullan.

Ancak hafızada olmayan bilgileri uydurma.

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

Fakat emin olmadığın kişisel bilgileri gerçekmiş
gibi söyleme.

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
            .slice(0, 5000)

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

          max_completion_tokens:
            1200,

          // Güncel bilgi gerektiğinde
          // model web aramasını kullanabilir.
          tools: [
            {
              type:
                "browser_search"
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

    const answer =
      data?.choices?.[0]
        ?.message?.content || "";


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

        // Frontend isterse kullanabilir.
        // Web araması yapıldıysa Groq'un
        // döndürdüğü tool bilgisi burada tutulur.
        web_used:
          Array.isArray(
            data?.choices?.[0]
              ?.message?.executed_tools
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
