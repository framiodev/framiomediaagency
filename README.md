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
```
`validate` geçerli dosyada `✓` yazar ve 0 ile çıkar; geçersiz dosyada hataları yol (`/layers/2/grid` gibi) ile listeler ve 1 ile çıkar.

## Yapı
| Yol | İçerik |
|---|---|
| `schemas/design-spec-0.1.schema.json` | Tasarım spec'i (JSON Schema 2020-12) |
| `src/spec/validate.js` | Doğrulayıcı: şema + şemanın ifade edemediği kurallar |
| `src/cli.js` | `ajans validate` komutu |
| `examples/specs/valid/` | Geçerli örnekler (3 adet) |
| `examples/specs/invalid/` | Reddedilmesi gereken örnekler |
| `schemas/brand-kit-0.1.schema.json` | Marka kiti şeması (renk, font, logo, ton, kaynak) |
| `src/brand/` | Marka kiti doğrulayıcı ve Türkçe glif denetimi |
| `brands/` | Pilot marka kitleri (bkz. brands/README.md) |
| `docs/adr/` | Mimari karar kayıtları |

## Tasarım spec'i (v0.1)
Ajanlar spec yazar, renderer'lar spec okur (brief Bölüm 5). Şemaya ek olarak doğrulayıcı şunları reddeder:
- tekrarlanan katman `id`'si,
- grid sütun/satır taşması (`col + span - 1 > grid.cols`),
- `provenance` kaydı olmayan görsel (`asset://...`) — lisanssız varlık kritik hatadır,
- çizilebilir alan bırakmayan güvenli alan veya grid kenar boşluğu.

Renkler `#RRGGBB(AA)` ya da marka belirteci (`brand.ink`), fontlar yalnızca marka belirteci (`brand.display`). Bir katman `grid` ya da `box` ile yerleşir, ikisiyle birden değil.

## Pilot markalar
Pilot markalar için üretilen her spec `intent.label: "concept_study"` taşır; bu çıktılar yayınlanmaz ve paylaşılmaz.
