# Ajans İşletim Sistemi

Tek kişilik bir ajans için tasarım/içerik otomasyon programı. Şu an **Faz 0**: arayüz yok, komut satırı prototipi.
Plan ve kabul kriterleri: [docs/PROJE_BRIEF.md](docs/PROJE_BRIEF.md) · Çalışma kuralları: [CLAUDE.md](CLAUDE.md)

## Gereksinimler
- Node.js 22 veya üstü (CI Node 22 ile çalışır)
- Git

## Kurulum ve çalıştırma
```bash
npm ci                 # bağımlılıkları kur
npm run lint           # ESLint
npm test               # node:test ile testler
npm run check          # lint + test
npm run validate -- examples/specs/valid/post-4x5-concept.json
npm run brand -- brands/dk_koksallar/brand-kit.json
node src/cli.js glyphs path/to/font.ttf   # Türkçe glif denetimi
node src/cli.js render examples/specs/valid/dk-post-4x5-route.json   # out/ altına PNG
node src/cli.js check examples/specs/valid/dk-post-4x5-route.json    # deterministik rubrik denetimi
```
`validate` geçerli dosyada `✓` yazar ve 0 ile çıkar; geçersiz dosyada hataları yol (`/layers/2/grid` gibi) ile listeler ve 1 ile çıkar.

## Yapı
| Yol | İçerik |
|---|---|
| `schemas/design-spec-0.1.schema.json` | Tasarım spec'i (JSON Schema 2020-12) |
| `src/spec/validate.js` | Doğrulayıcı: şema + şemanın ifade edemediği kurallar |
| `src/cli.js` | `ajans` komutları: validate, brand, glyphs, render |
| `examples/specs/valid/` | Geçerli örnekler (4 adet; 3ü pilot markalarla render edilir) |
| `examples/specs/invalid/` | Reddedilmesi gereken örnekler |
| `schemas/brand-kit-0.1.schema.json` | Marka kiti şeması (renk, font, logo, ton, kaynak) |
| `src/brand/` | Marka kiti doğrulayıcı ve Türkçe glif denetimi |
| `brands/` | Pilot marka kitleri (bkz. brands/README.md) |
| `src/render/` | Renderer: spec → SVG (metin eğri olarak) → PNG; bkz. docs/adr/0002-renderer.md |
| `src/rubric/`, `config/rubric.json` | Deterministik rubrik denetimleri ve eşikleri |
| `docs/style-cards/` | Instagram incelemelerinden çıkarılan stil kartları |
| `docs/adr/` | Mimari karar kayıtları |

## Tasarım spec'i (v0.1)
Ajanlar spec yazar, renderer'lar spec okur (brief Bölüm 5). Şemaya ek olarak doğrulayıcı şunları reddeder:
- tekrarlanan katman `id`'si,
- grid sütun/satır taşması (`col + span - 1 > grid.cols`),
- `provenance` kaydı olmayan görsel (`asset://...`) — lisanssız varlık kritik hatadır,
- çizilebilir alan bırakmayan güvenli alan veya grid kenar boşluğu.

Renkler `#RRGGBB(AA)` ya da marka belirteci (`brand.ink`), fontlar yalnızca marka belirteci (`brand.display`). Bir katman `grid` ya da `box` ile yerleşir, ikisiyle birden değil.

## Deterministik rubrik denetimleri (F0-5)
`ajans check` spec'i render eder ve brief Bölüm 6'daki ölçülebilir kuralları denetler. Eşikler `config/rubric.json` dosyasındadır; boyutlar telefonda görünen boyuta (375 px genişlik) çevrilerek değerlendirilir.

| Kod | Önem | Ölçüt | Ne denetlenir |
|---|---|---|---|
| `contrast_low` | kritik | Renk | Metin rengi ile arkasındaki **gerçek pikseller** (metinler hariç render) arasındaki WCAG kontrastı, 10. yüzdelik. Normal metin ≥ 4,5:1, büyük metin ≥ 3:1 |
| `missing_glyph` | kritik | Tipografi | Fontta karşılığı olmayan karakter |
| `safe_area_violation` | kritik | Platform | Metin ve `contain` görseller (logo) güvenli alan dışında |
| `text_overlap` | kritik | Yerleşim | İki metin katmanı üst üste |
| `asset_missing` | kritik | Kalite | Görsel dosyası yok (yer tutucu çizildi) |
| `license_unknown` | kritik | Marka | Kullanılan varlığın lisansı TBD/bilinmiyor |
| `text_partial_overlap` | büyük | Yerleşim | Metin bir şekle/görsele yarım biniyor |
| `text_overflow` | büyük | Yerleşim | Metin kendi kutusundan taşıyor |
| `text_too_small` | büyük | Tipografi | Telefonda 11 px altı |
| `off_palette` | küçük | Marka | Marka paleti dışı hex renk |

Kritik hata varsa spec geçemez (çıkış kodu 1). `--json` çıktısındaki `failures` alanı spec'in `rubric.failures` biçimiyle aynıdır.

## Pilot markalar
Pilot markalar için üretilen her spec `intent.label: "concept_study"` taşır; bu çıktılar yayınlanmaz ve paylaşılmaz.
