# ADR 0001 — Faz 0 dili ve araçları

Tarih: 2026-10-23 · Durum: Kabul (Faz 0 için geçici)

## Bağlam
Brief Bölüm 3, çekirdek API dilini (TypeScript veya Rust) Faz 0 sonuna bırakıyor. Faz 0'ın hızlı bir CLI prototipine ihtiyacı var.

## Karar
- Faz 0 prototipi **Node.js 22+ / JavaScript (ESM)**; derleme adımı yok. Tip denetimi gerekirse sonra TypeScript eklenir.
- Spec şeması **JSON Schema 2020-12**; doğrulama **Ajv 8** (strict mod). Şema dile bağımsızdır; Rust tarafında da kullanılabilir.
- Test: yerleşik `node:test`. Lint: ESLint 9 (flat config).
- CI: GitHub Actions, Ubuntu + Windows, Node 22.

## Sonuçlar
Kalıcı dil kararı F0-10'da verilir (ADR olarak). Şema ve örnekler o karardan etkilenmez.
