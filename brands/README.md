# Marka kitleri

Her marka bir klasör: `brands/<brand_id>/brand-kit.json` (şema: `schemas/brand-kit-0.1.schema.json`).
Logo ve font dosyaları müşteri varlığıdır: `brands/<brand_id>/assets/` altına konur ve **git'e girmez** (`.gitignore`).

Durumlar:
- `needs_input` — bilgiler kullanıcıdan bekleniyor; hiçbir alan tahminle doldurulmaz, sorular `open_questions` içinde.
- `draft` — kısmen dolu.
- `ready` — renk, font, logo ve ton var; her varlığın kaynağı ve bilinen bir lisansı var; font dosyaları mevcut ve Türkçe glif denetimini geçiyor; açık soru yok.

Denetim:
```bash
npm run brand -- brands/dk_koksallar/brand-kit.json
```
