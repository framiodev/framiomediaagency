# ADR 0002 — Yerel renderer: spec → SVG → PNG (resvg)

Tarih: 2026-10-23 · Durum: Kabul (Faz 0)

## Bağlam
F0-4: aynı spec bit düzeyinde aynı PNG'yi vermeli, 1080×1350 render 5 sn altında olmalı. Brief Bölüm 3 Playwright veya resvg arasında seçim istiyordu.

## Karar
- Spec önce SVG'ye, sonra **@resvg/resvg-js** (MPL-2.0) ile PNG'ye çevrilir. Tarayıcı yok.
- Metin SVG'ye `<text>` olarak değil, **markanın kendi font dosyasından çıkarılmış eğriler** olarak yazılır (**fontkit**, MIT). Sistem fontu hiç yüklenmez. Böylece çıktı makineden bağımsızdır.
- fontkit değişken fontları (wght, opsz) doğrudan örnekler, GSUB/GPOS ile şekillendirir ve kerning uygular. Önce denenen opentype.js, Inter'in bazı GSUB tablolarını okuyamadı ve League Spartan'da bozuk eğri (NaN) üretti; yalnızca testlerde font üretmek için kaldı.
- Satır kaydırma basit ve açgözlüdür; `\n` satır başı, no-break space (U+00A0) kelimeleri birlikte tutar. Koordinatlar 2 ondalığa yuvarlanır.
- Desteklenen görseller: PNG, JPEG. resvg-js 2.6.2 WebP okumuyor; WebP varlıklar önce PNG'ye çevrilmeli.
- Eksik varlık gri, çarpı işaretli bir yer tutucu olarak çizilir ve uyarı verir; eksik glif, aralık dışı kalınlık ve kutusundan taşan kelime de uyarıdır.

## Neden Playwright değil
Tarayıcı render'ı font hinting, GPU ve sürüm farklarına açıktır; bit düzeyinde aynılık zor ve 100+ MB indirme gerekir. resvg CPU'da, tek pakette çalışır. CSS düzeni (flex, otomatik tirelemeli paragraf) gerekirse Faz 1'de yeniden değerlendirilir.

## Sonuçlar
- Ölçüm (Casper dizüstü): 1080×1350, logo + 4 metin katmanı ≈ 70-140 ms.
- Testler sabit bir SHA-256 ile karşılaştırır; CI hem Ubuntu'da hem Windows'ta çalıştığından platformlar arası aynılık her push'ta denetlenir.
- Bilinen sınırlar: tireleme yok, satır içi stil (kalın kelime) yok, sağdan sola yazı yok, metin kutu yüksekliğiyle kırpılmaz (F0-5'te taşma denetimi).
