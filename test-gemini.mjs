
import fs from "node:fs";

const envText = fs.readFileSync(".env.local", "utf8");

const keyLine = envText
  .split(/\r?\n/)
  .find(line => /^\s*GEMINI_API_KEY\s*=/.test(line));

if (!keyLine) {
  console.error("GEMINI_API_KEY bulunamadı.");
  process.exit(1);
}

const apiKey = keyLine.split("=").slice(1).join("=")
  .trim()
  .replace(/^["']|["']$/g, "");

if (!apiKey) {
  console.error("API anahtarı boş.");
  process.exit(1);
}

const url =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

try {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: "Global Mobilya markası için modern bir oturma odası takımını tanıtan, kısa ve profesyonel bir Türkçe reklam metni yaz."
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 200
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("API Hatası:", response.status);
    console.error(data.error?.message ?? "Bilinmeyen hata");
    process.exit(1);
  }

  console.log("\n--- GEMINI YANITI ---\n");
  console.log(
    data.candidates?.[0]?.content?.parts
      ?.map(part => part.text ?? "")
      .join("\n") ?? "Metin yanıtı alınamadı."
  );

  console.log("\n--- TOKEN KULLANIMI ---");
  console.log(data.usageMetadata ?? "Kullanım bilgisi dönmedi.");

  console.log("\nAPI bağlantısı başarılı.");
} catch (error) {
  console.error("Bağlantı hatası:", error.message);
  process.exit(1);
}
