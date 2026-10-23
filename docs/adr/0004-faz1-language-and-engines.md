# ADR 0004 — Faz 1: çekirdek dili ve motor dağılımı

Tarih: 2026-10-23 · Durum: Önerildi (kullanıcı onayı bekliyor)

## Bağlam
Brief Bölüm 3, çekirdek API dilini (TypeScript veya Rust) Faz 0 sonuna bıraktı. Faz 0'da yazılan her şey Node.js (ESM) üzerinde: spec şeması ve doğrulayıcı, marka kiti, resvg renderer, rubrik denetimleri, model katmanı ve maliyet sayacı, tasarım döngüsü, Photoshop motoru (COM + ExtendScript). Kullanıcı ileride kendi Rust uygulamalarını motor olarak bağlamak istiyor; Tauri istemcisi de Rust.

## Karar
1. **Çekirdek API ve iş akışı motoru: TypeScript (Node 22).** Faz 0 kodu doğrudan taşınır; Anthropic SDK, Ajv, resvg-js, fontkit TS/JS ekosisteminde olgun. Faz 1'in ilk işi mevcut JS'yi TypeScript'e çevirmek (tip güvenliği; `tsc --noEmit` CI'da).
2. **İstemci: Tauri 2 (Rust kabuk + web arayüzü).** Rust burada yalnızca ince kabuk; iş mantığı bulutta.
3. **Motorlar ayrı süreç, ortak protokol (ADR 0003).** Rust uygulamaları motor eklentisi olarak protokolü uygular; çekirdeğin Rust olması gerekmez. Protokol: JSON-RPC (stdio veya HTTP), istek = spec v0.2 + işlemler, yanıt = dosya(lar) + uyarılar.
4. **Render dağılımı:** resvg = önizleme ve deterministik testler (bulutta, saniyenin altında); Photoshop = son teslim PSD (evdeki işçi); ileride Rust motoru = resvg'nin yerine veya yanına.
5. **Photoshop bağlantısı:** Faz 1'de COM + ExtendScript'ten UXP eklentisine geçiş (UXP Photoshop'ta resmî ve modern yol). Illustrator ve After Effects için ExtendScript adaptörü kalır (UXP yok).

## Değerlendirilen alternatif
- **Çekirdeği Rust (axum) ile yazmak:** uzun vadede tek dil avantajı, ama Faz 0 kodunun yeniden yazılması ve LLM/SDK ekosisteminin JS/Python'da daha olgun olması Faz 1'i 2-3 hafta uzatır. Motor protokolü sayesinde Rust'ın değeri (performans, kullanıcının motoru) zaten alınabiliyor.

## Sonuçlar
- Faz 1 başında: TS'ye geçiş, motor protokolü taslağı, Photoshop UXP eklentisi.
- Kullanıcının Rust motoru Faz 5 yerine protokol hazır olur olmaz (Faz 2) denenebilir.
