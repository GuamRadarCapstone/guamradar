export async function translateToKorean(text: string) {
  try {
    const res = await fetch("https://libretranslate.de/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: text,
        source: "en",
        target: "ko",
        format: "text"
      })
    });

    const data = await res.json();
    return data.translatedText;
  } catch (err) {
    console.error("Translation failed", err);
    return text; // fallback
  }
}

// caching layer
export async function getKoreanCached(id: string, text: string) {
  const key = `ko_${id}_${text}`;

  const cached = localStorage.getItem(key);
  if (cached) return cached;

  const translated = await translateToKorean(text);
  localStorage.setItem(key, translated);

  return translated;
}