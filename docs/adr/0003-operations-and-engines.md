# ADR 0003 — Spec'te işlem katmanı ve motor eklentileri

Tarih: 2026-10-23 · Durum: Önerildi (F0-12 bulgularıyla; spec v0.2 Faz 1'in ilk işi)

## Bağlam
Kullanıcı, programın Canva benzeri tek motorlu bir şablon aracı değil, tüm Adobe uygulamalarının (Photoshop, Illustrator, After Effects, InDesign, Premiere, Lightroom…) ve kendi Rust uygulamalarının yeteneklerini kullanan profesyonel bir araç olmasını istiyor. Örnek: düşük çözünürlüklü bir logo bulunduğunda Illustrator ile yeniden çizilmesi.
v0.1 spec yalnızca son kompozisyonu tarif ediyor; F0-4 renderer'ı (resvg) yalnızca düz şekil, metin ve görsel çizebiliyor. F0-12 denemesi aynı spec'in Photoshop'ta katmanlı PSD'ye çevrilebildiğini gösterdi.

## Karar
1. Spec v0.2 iki katmanlı: **operations** (varlık hazırlama işlemlerinin yönlü grafiği) ve **composition** (zengin görsel söz dağarcığıyla katmanlar). Ayrıntı: brief Bölüm 5a.
2. İşlemler motora değil **yeteneğe** yazılır (`vectorize`, `remove_background`, `upscale`, `relight`, `generative_fill`, `color_grade`, `mockup_place`, `animate`, …). Her motor eklentisi manifestinde hangi yetenekleri ve kompozisyon özelliklerini desteklediğini, kalite düzeyini ve tahmini süresini ilan eder.
3. Yönlendirici her işlemi uygun motora verir ve bir **yedek zinciri** tutar (ör. vectorize: Illustrator → vtracer; remove_background: Photoshop Select Subject → rembg). Adobe yoksa sistem çalışmaya devam eder.
4. Kompozisyon motorları: Photoshop (katmanlı PSD, son teslim), resvg (hızlı önizleme, deterministik testler), ileride kullanıcının Rust motoru. Bir motorun desteklemediği özellik sessizce atlanmaz; uyarı veya hata olur.
5. Adobe bağlantısı: Photoshop, InDesign, Premiere için **UXP**; Illustrator ve After Effects için UXP olmadığından **ExtendScript** (Windows'ta COM / komut satırı). ExtendScript'in sonlandırılacağı söylentisi doğrulanana kadar ExtendScript kodu ince bir adaptör katmanında tutulur.

## Sonuçlar
- Faz 1'in ilk işi spec v0.2 + motor protokolü olur; Photoshop motoru Faz 2'den Faz 1'e çekilir.
- Rubrik denetimleri (F0-5) kompozisyon geometrisine dayandığı için motorlardan bağımsız kalır; ama son kontrast denetimi teslim edilen motorun gerçek çıktısında da yapılmalıdır.
- Deterministik render (bit düzeyinde aynılık) yalnızca resvg için garanti; Adobe çıktıları için "görsel olarak eşdeğer" ölçütü gerekir (piksel farkı eşiği).
