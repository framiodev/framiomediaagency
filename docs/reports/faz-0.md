# Faz 0 raporu (F0-10)

Tarih: 2026-10-23 · Repo: github.com/framiodev/framiomediaagency · Kararlar: ADR 0001-0004

## Özet
Komut satırında **brief → spec → render (resvg ve Photoshop) → deterministik denetim → model eleştirisi → revizyon** döngüsü kuruldu ve test edildi. Model çağrıları maliyet sayacından ve bütçe tavanından geçiyor. Eksik kalan tek büyük parça **gerçek model çağrılarıyla ölçüm** (F0-7 gerçek çalıştırma, F0-8 karşılaştırma): API anahtarı kullanıcının isteğiyle en sona bırakıldı.

## Görev durumu

| # | Görev | Durum | Kanıt |
|---|---|---|---|
| F0-0 | Geliştirme ortamı | Tamam | docs/ortam.md, `npm run doctor`, CI'da doctor; GPU RTX 4060 8 GB olarak düzeltildi |
| F0-1 | Repo, lisans, CLAUDE.md, CI | Tamam | CI yeşil (Ubuntu + Windows) |
| F0-2 | Spec şeması + doğrulayıcı | Tamam | v0.1 → v0.2; geçersiz örnekler reddediliyor, geçerli örnekler geçiyor |
| F0-3 | Marka kiti + 2 pilot | Tamam (kitler `draft`) | DK: vektör logo, kılavuz renkleri, ton; Whisk: logo, font, renk, ton. Türkçe glif denetimi; tüm varlıklarda kaynak/lisans |
| F0-4 | Deterministik renderer | Tamam | Platformlar arası aynı SHA-256 (CI); 1080×1350 < 1 sn |
| F0-5 | Rubrik denetimleri | Tamam | Kontrast (gerçek piksel), güvenli alan, glif, çakışma, taşma, lisans, palet |
| F0-6 | LLM soyutlaması + maliyet + tavan | Tamam | Her çağrı USD maliyetiyle kayıtlı; tavan aşılacaksa çağrı gönderilmiyor |
| F0-7 | Model eleştirisi + 2 tur revizyon | **Kod tamam, gerçek çalıştırma bekliyor** | Eleştiri JSON'u rubrik şemasıyla doğrulanıyor (testli); API anahtarı gerekli |
| F0-8 | 20 brief karşılaştırması | **Kod tamam, çalıştırma bekliyor** | benchmarks/briefs.json, `npm run benchmark`; Gemini adaptörü yok |
| F0-9 | Referans ajans stil kartları | Tamam (notlar taslak) | docs/style-cards/reference-agencies.md: ajans→marka→sektör, 12 kart; "neden iyi?" notlarını kullanıcı onaylamalı |
| F0-10 | Faz 0 raporu + ADR | Tamam | Bu belge, ADR 0004 |
| F0-11 | GPU ölçümü | Sürüyor | ComfyUI + SDXL kuruldu/indiriliyor; ölçüm: docs/reports/f0-11-gpu.md |
| F0-12 | Adobe fizibilitesi | Tamam (1. tur) | Photoshop: spec → katmanlı PSD; Illustrator kurulu değil; AE betiği çalışmadı |
| F0-13 | Zengin kompozisyon | Tamam (2/3 DK gönderisi) | Spec v0.2; resvg + Photoshop motoru; 29 Ekim ve şehirler konseptleri rubrikten geçiyor; 3. gönderi (sefer, AI görsel) F0-11'e bağlı |

## Kalite
- İlk örnekler (F0-2/F0-4) kullanıcı tarafından "çok basit" bulundu; sebep spec'in görsel söz dağarcığının dar olmasıydı. F0-13 ile eklenen satır içi renk, açılı kesim, desen, gradyan, gölge, döndürme ve dekor tipografisiyle DK konseptleri ajans işine yaklaştı.
- Asıl kalite kanıtı (körleme karşılaştırma) F0-8 gerçek çalıştırmasından sonra yapılmalı: aynı brief'ler için sistem çıktısı, şablon çıktısı ve referans ajans işi kullanıcıya etiketsiz gösterilir.

## Maliyet
- Faz 0 boyunca gerçek model çağrısı yapılmadı (0 USD). Tahmin (brief Bölüm 9) F0-8 ile ölçülecek; tavan şu an 25 USD/ay, marka başına 10 USD.

## Açık konular
1. **API anahtarı** (Anthropic; ileride Gemini) → F0-7 ve F0-8'in gerçek çalıştırması.
2. **Fontlar:** Inter ve League Spartan (OFL) işçi makineye kurulursa Photoshop'taki metinler düzenlenebilir kalır; DK'nın kurumsal fontu Neo Sans Medium ticari, lisans gerekir.
3. **Illustrator** kurulumu ve After Effects betik izni → F0-12 2. tur (logo vektör düzenleme, hareketli grafik).
4. **Whisk** için ürün fotoğrafı yok; F0-11 sonrası yapay zekâ üretimi ya da gerçek çekim.
5. **Stil kartı notları** ve marka kitlerinin `ready` onayı kullanıcıda.

## Faz 1'e geçiş önerisi
ADR 0004'teki dağılımla: TypeScript'e geçiş, motor protokolü, Photoshop UXP eklentisi, spec v0.2'ye "seri şablonu" ve işlem katmanı (ADR 0003), Tauri Windows istemcisinde onay panosu.
