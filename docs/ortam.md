# Geliştirme ortamı (F0-0)

Son kontrol: 2026-10-23 · Sağlık kontrolü: `npm run doctor`

## Makine
| Bileşen | Değer | Not |
|---|---|---|
| Model | Casper Excalibur G870 (dizüstü) | |
| İşletim sistemi | Windows 11 Home Single Language 10.0.26300 | |
| GPU | **NVIDIA GeForce RTX 4060 Laptop, 8 GB VRAM** (sürücü 610.88) | Brief'teki "RTX 4070" varsayımı **yanlış**; `nvidia-smi` ile doğrulandı. VRAM 8 GB varsayımı doğru |
| Adobe | Creative Cloud Tüm Uygulamalar: Photoshop 2026 (27.11), Premiere Pro 2026, After Effects 2026, Media Encoder 2026, Lightroom CC, Acrobat | Illustrator kurulu değil (bkz. docs/reports/f0-12-adobe.md) |

## Kabuk kararı: yerel Windows, WSL2 yok
- Adobe otomasyonu (COM, ExtendScript, UXP) Windows tarafında çalışır; WSL2 içinden erişim ek köprü gerektirir.
- Komutlar PowerShell 5.1 veya Git Bash'te çalışır. npm betikleri her ikisinde de aynıdır.
- WSL2 kurulu değil; Linux'a özgü bir araç gerekirse yeniden değerlendirilir. CI Ubuntu'da çalıştığından Linux uyumluluğu yine de denetlenir.

## Araçlar
| Araç | Sürüm | Gerekli mi | Kurulum |
|---|---|---|---|
| Node.js | 25.2.1 (proje ≥ 22 ister, CI 22 kullanır) | Evet | nodejs.org; LTS 22 önerilir |
| npm | 11.8.0 | Evet | Node ile gelir |
| Git | 2.52.0.windows.1 | Evet | git-scm.com |
| Python | 3.11.0 (+ fontTools 4.61.1) | Hayır (varlık araçları) | python.org |
| Rust | **Kurulu değil** | Faz 1 (Tauri), Faz 5 | `winget install Rustlang.Rustup`, ardından MSVC Build Tools ve WebView2 |
| FFmpeg | **Kurulu değil** | Faz 2 (video) | `winget install Gyan.FFmpeg` |
| WSL2 | Kurulu değil | Hayır | — |

## Projeyi kurma
```bash
git clone https://github.com/framiodev/framiomediaagency.git
cd framiomediaagency
npm ci
npm run doctor
npm run check
```
Marka font ve logo dosyaları git'e girmez; `brands/<id>/assets/` altına elle konur (bkz. brands/README.md). API anahtarları `.env` dosyasına yazılır (`.env.example`).

## İşçi makine notları (Bölüm 3a)
7/24 çalışma için güç planı, uyku ayarları ve sıcaklık izleme henüz yapılandırılmadı; F0-11 GPU ölçümüyle birlikte ele alınacak.
