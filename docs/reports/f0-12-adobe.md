# F0-12 — Adobe fizibilite raporu

Tarih: 2026-10-23 · Makine: Casper Excalibur G870, Windows 11 · Lisans: Creative Cloud Tüm Uygulamalar
Betikler: `spikes/f0-12/` (çıktılar `out/f0-12/`, git dışında).

## Özet
| Program | Sonuç | Süre | Not |
|---|---|---|---|
| Photoshop 2026 (27.11) | **Çalışıyor** | İlk açılış 23 sn; spec → katmanlı PSD + PNG 3,4–5,7 sn | COM + ExtendScript. Metin katmanları düzenlenebilir, logo gömülü akıllı nesne |
| Photoshop – logo büyütme | Çalışıyor ama **yetersiz** | Bicubic 0,2 sn; Preserve Details 2.0 4,9 sn | 338×45 → 6× büyütmede ikisi de bulanık; logo için çözüm vektöre çevirmek |
| Photoshop – "Deep Upscale" (Super Resolution) | Betikten erişilemedi | — | `ResampleMethod.DEEPUPSCALE` bu sürümde yok |
| Illustrator | **Denenemedi** | — | Diskte ve kayıt defterinde bulunamadı (kurulum gerekli) |
| After Effects 2026 | **Betik çalışmadı** | Açılıp 27 sn'de kapandı | `AfterFX.exe -r` ile çalıştırıldı; ne çıktı dosyası ne render oluştu. Büyük olasılıkla "Betiklerin dosya yazmasına izin ver" tercihi kapalı; kullanıcı açmalı ve tekrar denenmeli |
| Premiere Pro 2026 | Denenmedi | — | Otomasyon için UXP eklentisinin UXP Developer Tool ile yüklenmesi gerekiyor (elle adım) |
| Lightroom CC | Masaüstü otomasyonu **yok** | — | Bulut Lightroom API kurumsal sözleşme istiyor (doğrula). Yerine Photoshop Camera Raw + XMP preset |

## Ayrıntılar

### Aynı spec, iki motor
`spikes/f0-12/spec-to-psd.mjs`, F0-4'teki spec'i okuyup ExtendScript üretiyor: arka plan, şekil katmanları, akıllı nesne olarak yerleştirilen logo (cover/contain ölçekleme), paragraf metin katmanları (font, punto, satır aralığı, harf aralığı, hizalama, renk). Whisk story'si ve DK gönderisi Photoshop'ta resvg çıktısına çok yakın göründü. Farklar:
- **Fontlar sisteme kurulu olmalı.** Photoshop marka font dosyasını doğrudan okumuyor. Inter kurulu olmadığı için DK metinleri Photoshop'un varsayılan fontuna düştü; League Spartan'ın yalnızca Bold'u kurulu olduğu için Whisk'te 500 kalınlık yerine Bold kullanıldı. Çözüm: marka fontlarını işçi makineye kurmak (kullanıcı onayıyla) veya Adobe Fonts ile etkinleştirmek.
- Satır kırılımı iki motorda farklı (Photoshop kendi paragraf motorunu kullanıyor). Rubrik denetimleri son teslim motorunun çıktısında da çalışmalı.
- Şekil köşe yarıçapı (`radius`) bu denemede uygulanmadı (şekil katmanı yerine piksel dolgusu kullanıldı).

### Logo büyütme
Raster büyütme düşük çözünürlüklü logoyu kurtarmıyor; kenarlar bulanık kalıyor. Doğru yol: **vektörleştirme + elle/yarı otomatik düzeltme** (Illustrator Image Trace ya da vtracer ile ilk taslak, ardından harf ve geometri temizliği). Illustrator kurulunca F0-12'nin ikinci turu olarak denenecek.

### Kırılganlık
- COM, Photoshop açık değilse kendisi açıyor (ilk çağrı ~23 sn). Açık bir belge veya modal diyalog varsa betik bekleyebilir; işçi tarafında zaman aşımı ve yeniden deneme gerekli.
- ExtendScript ES3: JSON yok, modern JS yok. Uzun vadede UXP'ye geçilmeli; ExtendScript yalnızca Illustrator ve After Effects için adaptörde kalmalı.
- Photoshop arayüzü işlem sırasında görünür ve meşgul; kişisel kullanımla çakışır (Bölüm 3a riski).

## Kullanıcıdan gerekenler
1. Illustrator'ı Creative Cloud'dan kurmak (diskte yok).
2. After Effects > Tercihler > Betik ve İfadeler > "Betiklerin dosya yazmasına ve ağa erişmesine izin ver" seçeneğini açmak.
3. Marka fontlarının (Inter, League Spartan tüm kalınlıklar) işçi makineye kurulmasına onay. İkisi de OFL, yeniden dağıtılabilir.

## Sonraki adım
Bunlar tamamlanınca ikinci tur: Illustrator'da DK logosunu vektörleştirme (Image Trace ve vtracer karşılaştırması), After Effects'te spec'ten 3 sn'lik animasyon ve render, Photoshop'ta fontlar kurulu olarak tekrar karşılaştırma.
