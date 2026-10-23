# Ajans İşletim Sistemi — Proje Brief'i (Claude Code devir dokümanı)

Sürüm: 0.3 · Tarih: 2026-10-23 · Dil: Türkçe · Durum: Faz 0 sürüyor (F0-1 – F0-5 tamam)

Bu doküman, bir sohbet oturumunda yapılan planlama ve araştırmanın özetidir. Claude Code ile geliştirmeye başlarken tek kaynak olarak kullanılır. "Doğrula" işaretli maddeler kaynaktan teyit edilmemiş varsayımlardır; kod yazmadan önce kontrol edilmelidir.

v0.2'de değişenler: donanım ve geliştirme ortamı (Bölüm 3a), referans ajanslar ve pilot markalar (Bölüm 8a), Faz 0 görevleri (Bölüm 11), açık sorular (Bölüm 14).

v0.3'te değişenler: ürün tanımı "tüm Adobe uygulamalarına ve kullanıcının Rust uygulamalarına bağlı profesyonel tasarım aracı" olarak netleşti (Bölüm 1, 2); yazılım envanteri tüm ajans araçlarını kapsayacak şekilde genişledi (Bölüm 4a); spec'e işlem katmanı eklendi (Bölüm 5a, ADR 0003); F0-12 Adobe fizibilitesi eklendi (Bölüm 11); yol haritası Adobe entegrasyonunu öne çekti (Bölüm 12).

---

## 1. Amaç

Tek kişilik bir freelance sosyal medya ve grafik tasarım ajansının, gerçek bir ajansın yaptığı işleri otonom ve kaliteli yapabilmesini sağlayan **bağımsız bir program** (Claude Desktop veya Claude içinde çalışan bir sistem değil).

Çözmesi gereken sorun: Kullanıcı daha önce Canva/Envato şablonlarıyla çalıştı, müşteriler memnun kalmadı ve iş kaybedildi. Hedef, şablon görünümünden uzak, konuya ve markaya özgü, profesyonel tasarım ilkelerine sahip çıktılar üretmek.

Kapsam (kademeli):
1. Marka kiti, içerik stratejisi, aylık takvim ve haftalık iş akışı üretimi ve onaya sunma.
2. Gönderi/story/carousel tasarımı, fotoğraf düzenleme, kısa video ve hareketli grafik üretimi.
3. Sosyal medya yayın planlama.
4. İleride: sektör ve rakip araştırması, SWOT, markaya özel fiyat teklifi, müşteri adayı bulma, web sitesi kurulumu.

## 2. Verilmiş kararlar

| Konu | Karar |
|---|---|
| Ürün biçimi | Bağımsız program; Windows, macOS, Android. Canva tarzı şablon aracı değil: tüm Adobe uygulamalarının ve kullanıcının Rust uygulamalarının yeteneklerini ajanlara açan profesyonel tasarım aracı (v0.3) |
| Sahiplik | Önce kullanıcının kendi ajansının aracı; ileride sistem olarak satılabilir yapı |
| Altyapı | Bulut tabanlı çekirdek; telefon, tablet, PC'den kesintisiz erişim |
| Evdeki makine | Casper Excalibur G870 (dizüstü), Windows 11, RTX 4070; sürekli açık kalabilir; "işçi" (worker) olarak kullanılacak |
| Başlangıç motorları | Önce Adobe uygulamaları (Creative Cloud Tüm Uygulamalar) + açık kaynak araçlar; sonra kullanıcının kendi Rust motoru. Envanter: Bölüm 4a |
| Otonomluk | Başta her şey onaya gelir; öğrenme ve güvenle artar |
| Bütçe | API için "çok ciddi para" ödenmeyecek. Referans: şu an Adobe'ye aylık ~1.700 (TL olduğu varsayıldı, doğrula) ödeniyor; benzer aralık hedeflendi |
| Satış niyeti | BYOK, çok kiracılı veri modeli ve lisans denetimi baştan düşünülmeli |
| Referans ajanslar | ESG Dijital ve Zemberenk Medya (iki ajans; çalıştıkları markalar incelenecek). Mui Medya sonra |
| Pilot markalar | A: DK Köksallar (şehirlerarası otobüs; Eylül 2026'ya kadar ESG Dijital müşterisi); B: Whisk (Çayyolu, matcha kafe) — 2026-10-23'te seçildi |

## 3. Mimari

```
 İSTEMCİ (Tauri 2 önerisi: Windows / macOS / Android)
   Onay panosu · Müşteri/proje · Not defteri · Takvim · Canlı önizleme
                         │ HTTPS / WebSocket
 BULUT ÇEKİRDEĞİ
   API + oturum · İş akışı motoru (onay kapıları) · Ajan orkestratörü
   Postgres + vektör arama (pgvector) · Dosya depolama (S3 uyumlu) · İş kuyruğu
                         │
 ARAÇ KATMANI (eklenti sistemi; her eklenti ayrı süreç/sidecar)
   HTML/SVG renderer · FFmpeg · Remotion · ComfyUI · GIMP/Krita
   Adobe işçisi (evdeki Windows dizüstü, UXP) · Postiz · SEO bilgi paketleri
   Video üretim sağlayıcıları (bkz. Bölüm 10) · Rust motoru (ileride)
```

Temel ilkeler:
- **Render soyutlaması:** Ajanlar bir motora değil, ortak **tasarım spec'ine** (Bölüm 5) yazar. Bugün Adobe veya HTML renderer, yarın Rust motoru aynı spec'i render eder. Bu projenin en değerli mimari kararıdır.
- **Model sağlayıcıdan bağımsızlık:** İnce bir LLM soyutlaması; vision destekli model gerekir. Sağlayıcı yapılandırmadan değişir.
- **Android'de ağır iş yok:** Telefon/tablet kumanda, onay ve not yüzeyidir. Render bulutta veya evdeki işçide yapılır.
- **Maliyet sayacı zorunlu:** Her model çağrısı ve render işi maliyetiyle kaydedilir; müşteri başına ve genel aylık bütçe tavanı vardır, aşılırsa iş durur ve onay ister.
- **Satış için:** Her tabloda `tenant_id`, BYOK (kullanıcının kendi API anahtarı), Adobe isteğe bağlı eklenti (her kullanıcı kendi lisansı).

### Teknoloji seçimleri (öneri)

| Katman | Öneri | Not |
|---|---|---|
| İstemci | Tauri 2 (Rust + web arayüzü) | Mobil (Android) desteğini küçük bir deneme derlemesiyle doğrula |
| Çekirdek API | TypeScript (Node 22) veya Rust (axum) | Kullanıcı Rust motorunu planladığından Rust uzun vadede avantajlı; Faz 0-1 için TS hızlıdır. Karar Faz 0 sonunda |
| Veritabanı | Postgres + pgvector | Yönetilen servis (ör. Supabase) kabul edilebilir |
| Kuyruk | Postgres tabanlı veya Redis | Basit başla |
| Depolama | S3 uyumlu (ör. Cloudflare R2) | |
| Render (başlangıç) | Headless tarayıcıyla HTML/SVG → PNG/PDF; metin ölçümü ve Türkçe karakter denetimi | **Seçildi: resvg** (ADR 0002) |
| Rust motoru (sonra) | linebender/vello, resvg, wgpu | Vello alfa aşamasında |

## 3a. Donanım ve geliştirme ortamı (YENİ)

Makine: **Casper Excalibur G870, dizüstü**, Windows 11, kullanıcıya göre RTX 4070.

- **Model kodunu ve VRAM'i doğrula** (Görev Yöneticisi > Performans > GPU). Bir haber kaynağı bu seriyi RTX 4060'a kadar listeliyor, yeni G870 sürümleri RTX 5070/5060 ile satılıyor; kullanıcının 4070'li sürümü doğrulanmadı. Dizüstü RTX 4070'ler genellikle **8 GB VRAM** taşır (varsayım, doğrula). Aşağıdaki yerel yapay zekâ kararları buna dayanır.
- **7/24 işçi olarak dizüstü:** Fişte çalışsın, uyku/hazırda bekletme kapalı olsun, sıcaklık ve fan izlensin, havalandırma temiz tutulsun, mümkünse pil şarj sınırı kullanılsın (üreticinin yazılımı varsa), Windows güncellemeleri için etkin saatler ayarlansın. Gündüz kişisel kullanımla çakışırsa ileride ikinci bir küçük makine düşünülür.
- **Adobe işçisi Windows'ta çalışır:** adb-mcp (UXP) ve dcc-mcp-photoshop Windows'u destekler. Photoshop/Premiere açık ve giriş yapılmış olmalı; UXP eklentisi yeniden başlatmada tekrar yüklenmek zorunda kalabilir.
- **Yerel yapay zekâ (8 GB varsayımıyla):** ComfyUI ile SDXL sınıfı görsel üretim makul olabilir; daha büyük modeller kuantize edilmeli. Yerel video üretimi pratik değil, video için API kullan (Bölüm 10). Küçük kuantize bir vision/LLM modeli referans etiketlemeyi ücretsiz yapabilir. Hepsi Faz 0'da ölçülür (F0-11).
- **Geliştirme (Claude Code, Windows 11):** Yerel Windows veya WSL2. Tauri Windows derlemesi: Rust, MSVC Build Tools, WebView2. Android: Android Studio, SDK, NDK, JDK. **macOS sürümü Windows'ta derlenemez;** GitHub Actions macOS runner'ı veya bir Mac gerekir (Tauri belgelerinden doğrula). Bu yüzden CI'ı Faz 1'in başında kur.

## 4. Eklenti/motor envanteri

Her eklenti: manifest (yetenekler, platform, izinler) + ayrı süreç + ortak iş protokolü. Programa bir **MCP istemcisi** gömülür; böylece MCP sunucusu olan repolar kod yazmadan takılır. SKILL.md formatlı repolar "bilgi paketi" olarak içe aktarılır (ajan yönergelerine eklenen talimat dosyaları).

| Repo / araç | Rol | Platform | Not |
|---|---|---|---|
| mikechambers/adb-mcp | Adobe işçisi (Photoshop, Premiere, InDesign; UXP) | Windows/macOS | En olgun aday. UXP eklentisi her Photoshop yeniden başlatmasında tekrar yüklenmek zorunda kalabilir |
| dcc-mcp/dcc-mcp-photoshop | Photoshop, MCP Streamable HTTP | Masaüstü | HTTP tabanlı, bulut mimarisine uygun |
| znznzna/photoshop-cli | Photoshop CLI + SDK | Yalnızca macOS | Windows planlanmış; kullanıcının makinesinde kullanılamaz |
| loonghao/photoshop-python-api-mcp-server, airtaxi/PhotoshopMcpServer | Photoshop (COM) | Yalnızca Windows | Alternatif/yedek; ana tercih değil |
| hetpatel-11/Adobe_Premiere_Pro_MCP, morim3/mcp_adobe_premiere | Premiere kontrolü | Masaüstü | Premiere Beta 25.3+ gerekebilir |
| pastorsimon1798/mcp-video (ve KyaniteLabs/mcp-video) | FFmpeg tabanlı kurgu, Remotion ile video üretimi | Bulut + masaüstü | İki farklı repo aynı adı taşıyor; birini seç |
| remotion-dev/skills, Remotion | React ile hareketli grafik | Bulut | **Lisans:** bireyler/küçük ekipler ücretsiz, belirli eşik üstü şirketler lisans almalı. Satış öncesi kontrol et |
| whaleyxbt/claude-motion, dev-isaacmello/extreme-motion-design | Hareketli grafik bilgi paketleri | | |
| artokun/comfyui-mcp | Yerel görsel üretim (ComfyUI) | Masaüstü/GPU | VRAM'e dikkat (Bölüm 3a) |
| maorcc/gimp-mcp, Krita MCP sunucuları | Açık kaynak rötuş yedeği | Bulut + masaüstü | GIMP GPL: ayrı süreç olarak çağır, koda gömme (lisans bulaşması) |
| ahujasid/blender-mcp | 3B ürün görselleri | Masaüstü | |
| gitroomhq/postiz-app (+ postiz-mcp) | Planlama ve yayın | Bulut (kendi sunucu) | Çoklu platform; MCP desteği var |
| AgriciDaniel/claude-seo, ccforseo/seo-claude-code-skills, anthropics/knowledge-work-plugins (seo-audit) | SEO bilgi paketleri | Her yerde | DataForSEO vb. ücretli API'ler isteğe bağlı |
| yzfly/awesome-design-html, Impeccable, anthropics/skills | Tasarım bilgi paketleri / referanslar | | Lisansı kontrol et |
| linebender/vello | Rust 2B çizim motoru | Her yerde | Alfa |
| ajv (npm) | Spec JSON Schema doğrulama | Her yerde | MIT, aktif; F0-2 ile eklendi (bkz. docs/dependencies.md) |
| eslint, @eslint/js, globals (npm) | Lint (yalnızca geliştirme) | Her yerde | MIT, aktif; F0-1 ile eklendi |
| fontkit (npm) | Font okuma, değişken font, Türkçe glif denetimi | Her yerde | MIT, aktif; F0-4 ile opentype.js yerine geçti |
| @resvg/resvg-js (npm) | Yerel SVG → PNG renderer | Her yerde | MPL-2.0, aktif; F0-4, bkz. docs/adr/0002-renderer.md |

**REA (morluto/rea) hakkında:** Bu repo "Reverse Engineer Anything"tir; yazılım/binary analizi içindir, tasarım mantığıyla ilgisi yoktur. Ticari programları (Adobe) çözüp kopyalamak lisans/hukuk riskidir. Rust motoru için referans olarak kaynak kodu açık programlar (GIMP, Krita, Inkscape, darktable, RawTherapee) kullanılır.

Genel kural: Bir repoyu eklemeden önce lisans, bakım durumu ve kod güvenliği kontrol edilir (çoğunun yıldız sayısı düşük). Çok sayıda skill yüklemek ajanı yavaşlatıp bulandırabilir; önce 8-10 araçlık çekirdek set.

## 4a. Ajans yazılım envanteri (YENİ, v0.3)

Hedef: Canva benzeri tek motorlu bir şablon aracı değil; profesyonel bir ajansın kullandığı programların **tüm yeteneklerini** ajanlara açan bir eklenti/işçi katmanı. Her program bir **motor eklentisidir**: manifestinde hangi işlemleri yapabildiğini ilan eder (Bölüm 5a), spec'teki işlemleri yapabilecek motora yönlendirilir.

Kullanıcının lisansı: **Adobe Creative Cloud Tüm Uygulamalar**. Evdeki dizüstünde kurulu (2026-10-23 kontrol): Photoshop 2026 (27.11), Premiere Pro 2026, After Effects 2026, Media Encoder 2026, Lightroom CC, Acrobat. **Illustrator kullanıcı "kurulu" dese de diskte ve kayıt defterinde bulunamadı** (doğrula / yeniden kur).

Otomasyon yolları (UXP: Adobe'nin modern eklenti platformu, V8/ES6; ExtendScript: eski ES3 betik dili; CEP: eski HTML panel platformu; COM: Windows otomasyon arayüzü):

| Program | Ajans işi | Otomasyon yolu | Durum |
|---|---|---|---|
| **Photoshop** | Kompozit, rötuş, dekupe (Select Subject), ışık, mockup, generative fill/expand | UXP (ana), ExtendScript + COM (Windows) | **F0-12'de çalıştı**: COM + ExtendScript ile spec'ten katmanlı PSD, ~3-6 sn |
| **Illustrator** | Logo yeniden çizimi/vektörleştirme, ikon, desen, infografik, ambalaj | ExtendScript (+ COM), CEP. **Genel UXP yok** (2026 itibarıyla "yakında"; üçüncü taraf kaynak) | Makinede kurulu değil; doğrula |
| **InDesign** | Broşür, katalog, menü, sunum, çok sayfalı belge, veri birleştirme | UXP, ExtendScript | Kurulmadı |
| **After Effects** | Hareketli grafik, kinetik tipografi, logo animasyonu, reels şablonları | ExtendScript (+ `AfterFX.exe -r`), `aerender` CLI. **UXP yok** | F0-12'de betik çalışmadı (dosya yazma tercihi kapalı olabilir; doğrula) |
| **Premiere Pro** | Reels/kurgu, altyazı, yeniden boyutlandırma | UXP (25.x+), ExtendScript/CEP. ExtendScript'in Eylül 2026'da biteceği iddiası var (kullanıcı forumu, doğrula) | UXP eklentisi gerekir; denenmedi |
| **Media Encoder** | Toplu dışa aktarım, kodlama | ExtendScript, izlenen klasörler | Kurulu |
| **Lightroom (CC)** | Fotoğraf renk düzeltme, preset | Masaüstünde betik yok. Bulut: Lightroom API (Firefly Services), preset/XMP uygulama | Firefly Services kurumsal sözleşme istiyor (üçüncü taraf kaynak, doğrula). Alternatif: Photoshop Camera Raw filtresi (XMP preset) |
| **Lightroom Classic** | Toplu fotoğraf işleme | Lua SDK | Kurulu değil; gerekirse eklenir |
| Firefly / Firefly Services | Görsel üretimi, genişletme, dekupe API'leri | REST | Kurumsal; tek kişilik ajans için büyük olasılıkla kapalı. Photoshop içindeki generative özellikler CC kredisiyle çalışır |
| Adobe Stock | Lisanslı fotoğraf/vektör | API + Photoshop/Illustrator içi | Lisanslar envantere işlenir |
| Adobe Fonts | Marka fontları | CC uygulaması üzerinden etkinleştirme | Font lisansı provenance'a yazılır |
| Adobe Express, Acrobat, Bridge, Audition, Substance 3D | Hızlı varyasyon, PDF teklif/sunum, varlık yönetimi, ses, 3B malzeme | Değişken | İhtiyaca göre |
| Frame.io | Müşteri onayı, video yorumları | REST API | Onay panosu ile bütünleşebilir |
| Figma | Sunum, sosyal şablon, müşteri işbirliği | REST API, eklenti API'si, MCP | Hesap gerekirse |
| Blender | 3B ürün/ambalaj görseli | Python API, CLI render | Açık kaynak (GPL, ayrı süreç) |
| DaVinci Resolve | Renk düzenleme, kurgu | Python/Lua betik API (Studio sürümünde tam) | İsteğe bağlı |
| Inkscape | Vektör yedeği, SVG dönüştürme | CLI | GPL, ayrı süreç |
| vtracer / potrace | Raster → vektör (logo yeniden çizimi için ilk taslak) | CLI / kütüphane | vtracer MIT (Rust); potrace GPL |
| rembg, Real-ESRGAN | Dekupe, çözünürlük artırma (Adobe'siz yedek) | Python CLI | MIT / BSD; GPU'da hızlı |
| ComfyUI | Yerel görsel üretim | HTTP API | Bölüm 3a, F0-11 |
| FFmpeg, Remotion, Lottie | Video işleme, kodla hareketli grafik, web animasyonu | CLI / Node | Bölüm 4 |
| Kullanıcının Rust uygulamaları | Kendi render ve işleme motorları | Spec + eklenti protokolü | Faz 5; protokol Faz 1'de sabitlenir |

Dikkat:
- **Adobe kullanım şartları:** masaüstü uygulamalarını otomasyonla, kullanıcının kendi lisansıyla, kendi işleri için çalıştırmak normal kullanım. Programı satarken her kullanıcı kendi Adobe lisansını kullanır (BYOL); bulutta Adobe masaüstü çalıştırmak lisansa aykırı olabilir (doğrula).
- **Tek bağımlılık yok:** her Adobe işleminin açık kaynak bir yedeği olmalı (tabloda). Adobe yoksa sistem daha düşük kalitede çalışmaya devam eder.

## 5. Tasarım spec formatı (taslak v0.1)

Sürümlü, JSON Schema ile doğrulanan bir belge. Ajanlar bunu üretir, renderer'lar tüketir.

```json
{
  "spec_version": "0.1",
  "intent": {
    "message": "Tek cümlelik ana mesaj",
    "audience": "Hedef kitle",
    "cta": "Eylem çağrısı",
    "platform": "instagram_post_4x5"
  },
  "canvas": { "w": 1080, "h": 1350, "unit": "px", "safe_area": { "top": 120, "bottom": 160, "side": 72 } },
  "brand_ref": "brand_kit_id",
  "grid": { "cols": 12, "margin": 72, "gutter": 24, "baseline": 8 },
  "layers": [
    { "id": "bg", "type": "image", "src": "asset://...", "fit": "cover" },
    { "id": "headline", "type": "text", "text": "...", "font": "brand.display", "size": 96,
      "grid": { "col": 1, "span": 10, "row": 3 }, "color": "brand.ink", "lang": "tr" }
  ],
  "provenance": { "assets": [ { "id": "...", "source": "...", "license": "..." } ] },
  "rubric": { "scores": {}, "failures": [] }
}
```

Gereksinimler: sürümleme ve diff, deterministik render, her varlık için kaynak ve lisans kaydı, Türkçe karakter (ğ, ş, ı, İ, ö, ü, ç) destekleyen font doğrulaması.

## 5a. İşlem katmanı (YENİ, v0.3; ADR 0003)

v0.1 spec yalnızca **son kompozisyonu** tarif eder. Ajans işi ise önce varlıkları hazırlar: logoyu vektöre çevirir, fotoğrafı dekupe eder, ışığı düzeltir, ürünü sahneye yerleştirir. Spec v0.2 iki katmanlı olur:

1. **operations**: varlık hazırlama işlemlerinin yönlü grafiği. Her işlemin girdisi, çıktısı (`asset://`), parametreleri ve **gerekli yeteneği** vardır (ör. `vectorize`, `remove_background`, `upscale`, `relight`, `generative_fill`, `color_grade`, `mockup_place`, `animate`). Motor seçimi spec'te değil, yönlendiricidedir.
2. **composition**: bugünkü katmanlar, zenginleştirilmiş görsel söz dağarcığıyla: zengin metin (satır içi renk/kalınlık), maske ve kırpma, gradyan, gölge/efekt, karışım modu, döndürme, gruplar, doku/desen.

Her motor eklentisi manifestinde desteklediği işlemleri ve kompozisyon özelliklerini ilan eder. Yönlendirici her işlemi en iyi uygun motora verir (ör. vectorize → Illustrator, yoksa vtracer). Kompozisyon da bir motora gider: Photoshop (katmanlı PSD), resvg (hızlı önizleme), ileride Rust motoru. Desteklenmeyen özellik sessizce düşürülmez; uyarı veya hata olur.

## 6. Tasarım rubriği (taslak)

Eleştiri döngüsü iki katmanlıdır: (a) **deterministik denetimler** (kodla ölçülür), (b) **model tabanlı eleştiri** (ucuz vision model ilk geçiş, gerekirse güçlü model).

| Ölçüt | Ağırlık | Deterministik denetim örneği |
|---|---|---|
| Mesaj netliği (tek mesaj, tek odak) | 20 | — |
| Görsel hiyerarşi | 15 | Yazı boyutu oranları |
| Tipografi (okunabilirlik, Türkçe glif) | 15 | Glif eksikliği, minimum punto |
| Yerleşim, grid, boşluk | 15 | Gridden sapma, çakışma |
| Renk ve kontrast | 10 | WCAG kontrast oranı (gövde metin ≥ 4,5:1) |
| Marka uyumu | 10 | Palet/font dışı kullanım |
| Odak ve görsel kalite | 10 | Çözünürlük, bulanıklık |
| Platform uygunluğu | 5 | Güvenli alan ihlali |

Geçme eşiği: ≥ 80 puan ve hiçbir **kritik hata** yok (kontrast, glif eksikliği, güvenli alan ihlali, lisanssız varlık). Eleştiri turu varsayılan en fazla 2; aşılırsa kullanıcıya sorulur.

## 7. İş akışı (onay kapılı durum makinesi)

Müşteri alımı → marka kiti → strateji ve sektör araştırması → **aylık plan [onay]** → **haftalık sprint [onay]** → kreatif brief → **konsept seçenekleri [onay]** → üretim → otomatik eleştiri → revizyon → **müşteri sunumu [onay]** → yayın veya teslim → performans kaydı.

Dışarı giden her şey (yayın, mesaj, teklif) onay kapısından geçer.

| Seviye | Davranış |
|---|---|
| 1 | Taslak üretir, kullanıcı onaylar |
| 2 | Haftalık/aylık planı kendisi kurar, kullanıcı onaylar |
| 3 | Onaylanmış planı uygular, işleri hazırlar |
| 4 | Düşük riskli rutin işleri (ör. rutin story'ler) otomatik üretir |

Otonomluk seviyesi iş türüne göre ayrı ayarlanır. Marka kimliği en son otomatikleştirilir.

## 8. Öğrenme sistemi

Model yeniden eğitilmez; öğrenme modelin dışında bir bilgi katmanıdır:
- **Referans kütüphanesi:** Kullanıcı bağlantı/dosya ekler; sistem vision ile analiz edip yapısal **stil kartı** çıkarır (grid, tipografi hiyerarşisi, renk ilişkileri, boşluk, odak, ton). Orijinal değil kart ve kaynak bağlantısı saklanır.
- **Zevk hafızası:** Onay/ret/yorumlar kaydedilir; en değerli veri bu.
- **Dış kaynaklar:** Eğitici markalar/hesaplar, YouTube dersleri (transkript + kare örnekleme), sektör bazlı iyi örnekler. İlke ve teknik çıkarılır, kopya değil.
- **Sonuçlar:** İleride performans verisi hafızaya girer.

Sınırlar:
- Instagram/TikTok'u otomatik kazıma yapma (kırılgan, hizmet şartlarına aykırı). Resmi API, halka açık kaynak ve kullanıcının verdiği bağlantı/ekran görüntüsü.
- Stok görsel, font ve yapay zekâ görseli lisansları varlık yöneticisinde takip edilir.
- Müşteri materyali model sağlayıcıya gittiği için kullanım şartları ve KVKK dikkate alınır. Soğuk müşteri bulmada İYS ve KVKK koşulları sisteme baştan yazılır.

## 8a. Referans ajanslar ve pilot markalar (YENİ)

### Referans ajanslar
**ESG Dijital** ve **Zemberenk Medya** birer ajanstır ve "kalite çıtası" referansı olarak seçildi. İncelenecek olan, **bu ajansların çalıştığı markaların** sosyal medya çalışmalarıdır. Mui Medya sonraki aşamadır.

Durum: Sohbet sırasında web aramasıyla bu iki ajansın ve DK Köksallar markasının halka açık sayfaları **bulunamadı** (arama motoru ilgisiz sonuçlar döndürdü). Bu yüzden onların çalışmaları hakkında hiçbir bilgi doğrulanmadı. **Kullanıcının Instagram/web bağlantıları veya ekran görüntüleri gerekli.**

İnceleme yöntemi (Faz 0, F0-9):
1. Her ajans için: ajans → müşteri markaları → sektör → format (gönderi, carousel, story, reel) tablosu.
2. Her marka için 10-15 örnek (kullanıcının verdiği bağlantı/ekran görüntüsü).
3. Her örnekten stil kartı: grid, tipografi, renk, boşluk, odak, ton, format, hedef; ve **"neden iyi?" notu** (kullanıcı yazar).
4. Kopya yok: kart ilkeleri saklar, birebir yerleşim saklamaz. Başka ajansların işini taklit etmek hukuki ve etik risktir.

### Pilot A: DK Köksallar
**Güncelleme (2026-10-23):** Şehirlerarası tarifeli yolcu taşımacılığı (otobüs). Web: dkkoksallar.com, Instagram: @koksallarcom. Eylül 2026'da ESG Dijital ile yollarını ayırdı; kullanıcının bildiğine göre şu an ajanssız. Logo/font dosyası yok; renkler ve font (Inter) web sitesinden çıkarıldı (`brands/dk_koksallar/brand-kit.json`). Aşağıdaki kurallar geçerliliğini korur: marka hâlâ izinsizdir.
- Sektör, hesaplar ve varlıklar (logo, renkler, fontlar) **doğrulanmadı**; kullanıcıdan alınacak.
- Bu marka başka bir ajansın müşterisidir. Çalışma yalnızca **iç konsept/benchmark çalışması** olarak yapılır: yayınlanmaz, markaya veya ajansa danışmadan portföyde ya da sunumda kullanılmaz, markaya doğrudan ulaşılmaz. Kullanıcının ESG Dijital ile ilişkisinin niteliği (ilham, rakip, ortaklık) net olmalı.
- Marka kiti yalnızca kullanıcının sağladığı veya halka açık varlıklardan çıkarılır; lisanslı fontlar tahmin edilmez.

### Pilot B: Whisk (Çayyolu)
**Güncelleme (2026-10-23):** Kullanıcı Whisk'i seçti. Web: whiskandmore.com, Instagram: @whisk.more. Sitede matcha ve ekipman e-ticareti ile toptan satış da var. Kit: `brands/whisk/brand-kit.json`.
Aday listesi (Google Haritalar kayıtlarından; görsel dili ve sosyal medya hesapları henüz incelenmedi):

| Aday | Tür | Web sitesi |
|---|---|---|
| **Whisk (öneri)** | Matcha odaklı küçük kafe | whiskandmore.com |
| Luma Çayyolu (yedek) | Kahvaltı ve ana yemek restoranı | lumacayyolu.com |
| Noon Coffee & Shop | İç mekân tasarımı öne çıkan kafe | nooncoffeeshop.com |

Neden Whisk: görsel odaklı, belirli bir niş (matcha), küçük ölçek, içerik üretimi için çeşitlilik (içecek, tatlı, mekân). Luma, restoran içeriği (menü, kahvaltı, mekân) için daha geniş bir test sunar. Kararı kullanıcı verir; seçilen marka sosyal medya hesabı bakıldıktan sonra doğrulanır.

Kurallar: Gerçek ve izinsiz bir işletmedir; çalışma "konsept çalışması" olarak etiketlenir, yayınlanmaz. İleride işletmeye teklif sunulursa ticari elektronik ileti (İYS) ve KVKK kuralları uygulanır; konsept çalışmaları ancak izin/yaklaşım netleştikten sonra gösterilir.

Pilotun amacı: Gerçek marka verisiyle brief → spec → render → eleştiri döngüsünü sınamak ve şablon çıktısına karşı körleme karşılaştırma yapmak.

## 9. Maliyet ve model yönlendirmesi

Fiyatlar milyon token başına dolar (Ekim 2026'da araştırıldı; değişebilir, **kodda sabit yazma, yapılandırmadan oku**):

| Model | Giriş | Çıkış | Not |
|---|---|---|---|
| Claude Sonnet 5.5 | 2 | 10 | Batch yarı fiyat; önbellekli giriş 0,20 |
| Claude Haiku 5.5 | 0,10 (≤100 bin token) | 0,50 | >100 bin tokenda 0,50 / 2,50 |
| Gemini Flash ailesi | ~0,5-0,75 | ~3-3,75 | Tanıtım fiyatları 31 Aralık 2026'ya kadar bazı modellerde |

Yönlendirme: ucuz model sınıflandırma, etiketleme, eleştiri, çeviri; güçlü model konsept ve yerleşim kararı. Önbellek (rubrik, marka kiti, stil kartları), gece Batch (haftalık/aylık plan), eleştiri turu sınırı, yerel küçük vision model ile referans etiketleme (VRAM yeterliyse; Bölüm 3a).

Tasarım başına tahmin (varsayım, kaynaklı değil): konsept + spec + 2 revizyon + 3 eleştiri ≈ 40 bin giriş / 11 bin çıkış token ≈ 0,10-0,25 $. Aylık ~60 çıktı için toplam ~11-25 $, ~150 için ~20-53 $, ~400 için ~50-120 $ (planlama/araştırma payı dahil). Görsel/video üretimi ayrı kalemdir. Dolar/TL kuru doğrulanmadı.

Faz 0'ın çıktılarından biri **gerçek maliyet ölçümü** ve 20 brief'lik model karşılaştırmasıdır.

## 10. Video üretimi kararı (Seedance ve Higgsfield)

**Temel bulgu:** Seedance bir **modeldir** (ByteDance), Higgsfield ise Seedance dahil 30'dan fazla modeli tek kredi bakiyesinde satan bir **platformdur**. İkisi rakip değil; aynı model farklı "kapılardan" satılıyor. Gerçekçilik farkı çoğunlukla model farkı değil, hangi sürüm/çözünürlük/komut olduğuna bağlı.

Bulgular (kaynaklar kısmen satıcı bloglarıdır, taraflıdır; fiyatlar değişebilir):
- Resmi (BytePlus ModelArk) Seedance 2.0, 5 sn klip: 480p 0,35 $; 720p 0,76 $; 1080p 1,87 $; 4K 3,89 $. Seedance 2.5: 720p 1,16 $; 1080p 2,84 $ (4K yok). Ses ek ücret değil. Tek seferlik ~30 $ ön yükleme gerekiyor. 2.0 en fazla 15 sn, 2.5 en fazla 30 sn.
- Üçüncü taraf API satıcıları 2.0 1080p 5 sn için kabaca 1,70-3,41 $ arasında.
- Higgsfield planları: Starter 19 $ (270 kredi, yalnızca Seedance 2.0 Fast/Mini), Plus 47-59 $ (1.200 kredi, 2.5 ve 2.0 tam), Ultra 99-129 $ (3.000 kredi). Abonelik kredileri her yenilemede sıfırlanır; paket kredileri 90 günde sona erer. Seedance 2.0, 5 sn 720p için 23, 1080p için 45 kredi. Plus yıllık kredi başına ~0,039 $ ile bu ~0,90 $ (720p) ve ~1,76 $ (1080p) eder: resmi API fiyatıyla neredeyse aynı. **Yani Higgsfield'in değeri fiyat değil, arayüz ve paket.**
- Higgsfield "Unlimited" teklifi kişisel ve insan kullanımı içindir; otomasyon/betik yasak, MCP/CLI/Canvas kredi harcar, 1080p yok. Ücretsiz planda ticari kullanım yok; ücretli planların ticari hakları teyit edilemedi (kullanım şartlarını oku).
- Hukuk: Şubat 2026'da Hollywood stüdyoları ve MPA itiraz etti, ABD'li senatörler talepte bulundu; ByteDance C2PA etiketi ve içerik filtreleri duyurdu. Ağustos 2026 itibarıyla ABD'de dava açıldığı veya uzlaşma olduğu doğrulanmadı. Gerçek insan yüzü içeren referans, resmi API'de doğrudan desteklenmiyor (kurumsal "ileri yaratım hakları" ayrı pahalı seçenek). Tanınmış karakter/ünlü kullanma. Müşteri marka varlıkları için yazılı yetki al; AI kullanımını belirt.

**Karar önerisi:**
1. Şimdilik **abonelik alma.** Video üretimi Faz 3+ konusu; çekirdek program önce çalışmalı.
2. Otomasyon hedeflendiği için doğru kapı **per-kullanım API** (resmi BytePlus veya bir satıcı). Abonelik kredileri otomasyona uygun değil ve boşa gidebilir.
3. Video üretimini bir **sağlayıcı eklentisi** olarak soyutla (Seedance, Kling vb. aynı arayüz); böylece model değişse sistem değişmez.
4. Deneme: ~30 $ ön yükleme veya pay-as-you-go satıcıyla birkaç test; aylık bütçe tavanı koy. Kaba bütçe (varsayım): 20 klip × 10 sn × 720p ≈ 30 $, 1080p ≈ 75 $; yeniden denemeler (re-roll) 3× çarpan olarak hesaba katılmalı.
5. Doğrula: Türkiye'den BytePlus hesabı ve ödeme yöntemi (kart/dolar), bölgesel erişim, ticari kullanım şartları, C2PA etiketinin müşteri teslimine etkisi.
6. Yerel video üretimi 8 GB VRAM'li dizüstüde pratik değil (Bölüm 3a).

## 11. Faz 0 görev listesi (ilk Claude Code oturumu)

Hedef: Arayüz yok; komut satırında "brief → spec → yerel render → eleştiri → revizyon" döngüsünü kanıtlamak ve maliyeti ölçmek.

| # | Görev | Kabul kriteri |
|---|---|---|
| F0-0 | **Windows 11 geliştirme ortamı** (Node 22, Rust, Python, Git, FFmpeg; WSL2 kararı) ve `docs/ortam.md` | `docs/ortam.md` kurulum adımlarını ve sürümleri içerir; ortam sağlık kontrolü betiği geçer |
| F0-1 | Repo iskeleti, lisans, CLAUDE.md, CI (lint/test) | `main` yeşil; README çalıştırma adımlarını içerir |
| F0-2 | Spec JSON Schema + doğrulayıcı + örnekler | Geçersiz spec reddedilir; 3 örnek geçerli |
| F0-3 | Marka kiti şeması + **2 pilot marka** (DK Köksallar, Çayyolu kafe/restoran) | Renk/font/logo/ton alanları; Türkçe glif denetimi; varlıkların kaynağı kayıtlı |
| F0-4 | Yerel renderer (HTML/SVG → PNG), deterministik | Aynı spec bit düzeyinde aynı çıktıyı verir; 1080×1350 render < 5 sn |
| F0-5 | Deterministik rubrik denetimleri | Kontrast, güvenli alan, glif, çakışma, lisans testleri geçer |
| F0-6 | LLM sağlayıcı soyutlaması + maliyet sayacı + bütçe tavanı | Her çağrı maliyetle loglanır; tavan aşılınca durur |
| F0-7 | Model tabanlı eleştiri + en fazla 2 tur revizyon | Eleştiri JSON'u rubrikle eşleşir |
| F0-8 | 20 brief'lik benchmark (Sonnet / Haiku / Gemini Flash), pilot markalar üzerinden | Kalite ve maliyet raporu |
| F0-9 | Referans ajanslardan (ESG Dijital, Zemberenk Medya) **marka bazlı** stil kartı çıkarma; kullanıcı bağlantı/ekran görüntüsü verir | Ajans→marka→sektör tablosu; 10-15 örnek kart; her kartta "neden iyi?" notu |
| F0-10 | Faz 0 raporu ve Faz 1 kararları (API dili, render seçimi) | Karar kayıtları (ADR) yazılır |
| F0-11 | **GPU ölçümü** (Casper dizüstü): VRAM, ComfyUI SDXL süresi, küçük yerel vision modeli hızı, sürekli çalışma sıcaklığı | Ölçüm raporu; yerel/bulut iş dağılımı kararı |
| F0-12 | **Adobe fizibilitesi** (YENİ): aynı spec'ten Photoshop'ta katmanlı PSD; logo büyütme/vektörleştirme; After Effects, Premiere, Lightroom, Illustrator otomasyon yollarının denenmesi | Her program için çalışan/çalışmayan işlemler, süre ve kırılganlık raporu (docs/reports/f0-12-adobe.md); işlem katmanı için ADR |

Faz 0 bitmeden arayüze geçilmez. Kalite kanıtı pilot markalar için körleme karşılaştırmayla (şablon çıktısına karşı) doğrulanır; pilot çalışmalar yayınlanmaz (Bölüm 8a).

## 12. Yol haritası

| Faz | Süre (kaba) | İçerik |
|---|---|---|
| 0 | 2-3 hafta | Yukarıdaki görev listesi (F0-12 dahil) |
| 1 | 6-8 hafta | Spec v0.2 (işlem + zengin kompozisyon), motor eklenti protokolü, **Photoshop motoru** (UXP), Tauri istemcisi (Windows), bulut API, marka kiti, onay panosu; CI'da macOS derlemesi |
| 2 | 5-7 hafta | MCP istemcisi, Illustrator, After Effects, InDesign, Premiere motorları; FFmpeg/Remotion, ComfyUI; açık kaynak yedek motorlar; Android istemci |
| 3 | 4-6 hafta | Referans kütüphanesi, stil kartları, zevk hafızası, planlayıcı, Postiz yayın, video sağlayıcı eklentisi |
| 4 | Sürekli | SEO, sektör araştırması, SWOT, teklif şablonları, lead takibi, web sitesi üretimi |
| 5 | Sürekli | Rust motorunu render eklentisi olarak bağlama |

Süreler tek geliştirici + yapay zekâ destekli kodlama varsayımıyla kabadır.

## 13. Riskler

1. **Kalite:** Şablon tuzağı otomasyonda da çıkabilir. Faz 0'da gerçek markayla test et.
2. **Adobe kırılganlığı ve lisans:** UXP eklentisi yeniden yükleme isteyebilir; Adobe'nin otomasyon/bulut kullanım şartlarını kontrol et. Tek bağımlılık yapma.
3. **Donanım:** Dizüstünün 7/24 çalışması ısı ve pil yıpranması riski taşır; 8 GB VRAM sınırı yerel yapay zekâyı kısıtlar.
4. **Maliyet:** Vision model, görsel/video üretimi ve bulut render ücretleri. Sayaç ve tavan zorunlu.
5. **Kapsam:** Ajans işletim sistemi hedefi büyük; Faz 0-1 çalışmadan Faz 4'e dokunma.
6. **Güvenlik:** MCP sunucuları ve skill'ler kullanıcı yetkisiyle çalışır; kodu okumadan kurma; müşteri dosyalarını ayrı ortamda tut.
7. **Hukuk ve itibar:** Lisans envanteri (Remotion, GIMP/GPL, fontlar, stok, AI çıktıları), KVKK, İYS, yapay zekâ içerik etiketi; **başkasının müşterisi/markası üzerinde yapılan çalışmaların yayınlanmaması**; başka ajansların işinin kopyalanmaması.

## 14. Açık sorular (kullanıcıya)

1. **DK Köksallar** hangi sektörde? Instagram/web adresi, logo, renkler, fontlar var mı?
2. ESG Dijital ve Zemberenk Medya'nın web/Instagram bağlantıları ve sevdiğin 10-15 gönderi (bağlantı veya ekran görüntüsü). Hangi markalar üzerinden başlayalım? Mui Medya sonra mı?
3. ESG Dijital ile ilişkin nedir (ilham, rakip, ortaklık)? DK Köksallar'a yaklaşım stratejisi bunu etkiler.
4. Pilot B için Whisk (öneri), Luma veya Noon'dan hangisi? Hesaplarını inceledikten sonra kesinleştirelim.
5. Dizüstünün tam model kodu ve ekran kartı VRAM'i (Görev Yöneticisi > Performans > GPU)?
6. Adobe fiyatının para birimi ve güncel kur (bütçe tavanı için).
7. Program açık kaynak mı olacak, kapalı mı? (Eklenti lisanslarını etkiler.)
8. Claude Code kullanım maliyeti bütçeye nasıl yansıyacak (plan mı, API anahtarı mı)?
9. **(v0.3)** Illustrator diskte bulunamadı; Creative Cloud’dan kurulabilir mi?
10. **(v0.3)** After Effects’te “Betiklerin dosya yazmasına izin ver” tercihi açılabilir mi?
11. **(v0.3)** Marka fontları (Inter, League Spartan; OFL) işçi makineye kurulsun mu?

## 15. Kaynaklar

- REA: https://github.com/morluto/rea ; https://www.infoq.com/news/2026/10/reverse-engineer-anything/
- adb-mcp: https://github.com/mikechambers/adb-mcp ; dcc-mcp-photoshop: https://pypi.org/project/dcc-mcp-photoshop/
- mcp-video: https://pypi.org/project/mcp-video/ ; claude-motion: https://github.com/whaleyxbt/claude-motion
- comfyui-mcp: https://github.com/artokun/comfyui-mcp ; Postiz: https://github.com/gitroomhq/postiz-app
- claude-seo: https://github.com/AgriciDaniel/claude-seo ; Vello: https://github.com/linebender/vello
- Casper Excalibur G870 (haber, 4060'a kadar listeliyor): https://www.tamindir.com/haber/casper-excalibur-g870-ozellikleri-fiyati_80492/
- Claude fiyatları: https://www.eesel.ai/blog/claude-sonnet-5-5-pricing ; https://techenclave.com/news/items/claude-haiku-5-5-launches-with-0-10-input-pricing-for-shorter-prompts
- Seedance fiyatları ve rotalar: https://useapi.net/docs/articles/seedance-2-api-pricing
- Higgsfield planları (Krea, rakip kaynak): https://www.krea.ai/blog/higgsfield-pricing-explained-2026-unlimited-credits-and-real-monthly-costs
- Seedance Unlimited: https://higgsfield.ai/blog/seedance-unlimited
- Seedance telif ve kullanım: https://morphed.app/blog/seedance-copyright
- Higgsfield / Seedance karşılaştırması (Novoads, rakip kaynak): https://novoads.ai/blog/higgsfield-vs-seedance
