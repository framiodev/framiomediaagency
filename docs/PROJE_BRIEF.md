# Ajans İşletim Sistemi — Proje Brief'i (Claude Code devir dokümanı)

Sürüm: 0.2 · Tarih: 2026-10-23 · Dil: Türkçe · Durum: Faz 0 başlamadan önce

Bu doküman, bir sohbet oturumunda yapılan planlama ve araştırmanın özetidir. Claude Code ile geliştirmeye başlarken tek kaynak olarak kullanılır. "Doğrula" işaretli maddeler kaynaktan teyit edilmemiş varsayımlardır; kod yazmadan önce kontrol edilmelidir.

v0.2'de değişenler: donanım ve geliştirme ortamı (Bölüm 3a), referans ajanslar ve pilot markalar (Bölüm 8a), Faz 0 görevleri (Bölüm 11), açık sorular (Bölüm 14).

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
| Ürün biçimi | Bağımsız program; Windows, macOS, Android |
| Sahiplik | Önce kullanıcının kendi ajansının aracı; ileride sistem olarak satılabilir yapı |
| Altyapı | Bulut tabanlı çekirdek; telefon, tablet, PC'den kesintisiz erişim |
| Evdeki makine | Casper Excalibur G870 (dizüstü), Windows 11, RTX 4070; sürekli açık kalabilir; "işçi" (worker) olarak kullanılacak |
| Başlangıç motorları | Önce Adobe uygulamaları + açık kaynak araçlar; sonra kullanıcının kendi Rust motoru |
| Otonomluk | Başta her şey onaya gelir; öğrenme ve güvenle artar |
| Bütçe | API için "çok ciddi para" ödenmeyecek. Referans: şu an Adobe'ye aylık ~1.700 (TL olduğu varsayıldı, doğrula) ödeniyor; benzer aralık hedeflendi |
| Satış niyeti | BYOK, çok kiracılı veri modeli ve lisans denetimi baştan düşünülmeli |
| Referans ajanslar | ESG Dijital ve Zemberenk Medya (iki ajans; çalıştıkları markalar incelenecek). Mui Medya sonra |
| Pilot markalar | A: DK Köksallar (ESG Dijital müşterisi); B: Ankara Çayyolu'ndan bir kafe/restoran (öneri Bölüm 8a'da) |

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
| Render (başlangıç) | Headless tarayıcıyla HTML/SVG → PNG/PDF; metin ölçümü ve Türkçe karakter denetimi | Playwright veya resvg; Faz 0'da seç |
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

**REA (morluto/rea) hakkında:** Bu repo "Reverse Engineer Anything"tir; yazılım/binary analizi içindir, tasarım mantığıyla ilgisi yoktur. Ticari programları (Adobe) çözüp kopyalamak lisans/hukuk riskidir. Rust motoru için referans olarak kaynak kodu açık programlar (GIMP, Krita, Inkscape, darktable, RawTherapee) kullanılır.

Genel kural: Bir repoyu eklemeden önce lisans, bakım durumu ve kod güvenliği kontrol edilir (çoğunun yıldız sayısı düşük). Çok sayıda skill yüklemek ajanı yavaşlatıp bulandırabilir; önce 8-10 araçlık çekirdek set.

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

### Pilot A: DK Köksallar (ESG Dijital müşterisi)
- Sektör, hesaplar ve varlıklar (logo, renkler, fontlar) **doğrulanmadı**; kullanıcıdan alınacak.
- Bu marka başka bir ajansın müşterisidir. Çalışma yalnızca **iç konsept/benchmark çalışması** olarak yapılır: yayınlanmaz, markaya veya ajansa danışmadan portföyde ya da sunumda kullanılmaz, markaya doğrudan ulaşılmaz. Kullanıcının ESG Dijital ile ilişkisinin niteliği (ilham, rakip, ortaklık) net olmalı.
- Marka kiti yalnızca kullanıcının sağladığı veya halka açık varlıklardan çıkarılır; lisanslı fontlar tahmin edilmez.

### Pilot B: Ankara Çayyolu'ndan kafe/restoran
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

Faz 0 bitmeden arayüze geçilmez. Kalite kanıtı pilot markalar için körleme karşılaştırmayla (şablon çıktısına karşı) doğrulanır; pilot çalışmalar yayınlanmaz (Bölüm 8a).

## 12. Yol haritası

| Faz | Süre (kaba) | İçerik |
|---|---|---|
| 0 | 1-2 hafta | Yukarıdaki görev listesi |
| 1 | 5-7 hafta | Tauri istemcisi (Windows), bulut API, marka kiti, onay panosu, not defteri, tek motor; CI'da macOS derlemesi |
| 2 | 4-6 hafta | Eklenti sistemi + MCP istemcisi, FFmpeg/Remotion, ComfyUI, Adobe işçisi (Windows dizüstü), Android istemci |
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
