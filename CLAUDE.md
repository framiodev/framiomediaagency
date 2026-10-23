# Ajans İşletim Sistemi — Claude Code çalışma kuralları

Bu repo, tek kişilik bir ajansın kullanacağı bağımsız tasarım/içerik otomasyon programıdır (Windows, macOS, Android; bulut çekirdek).
Ayrıntılı plan: `docs/PROJE_BRIEF.md` (her oturumun başında oku).

## Ortam
- Geliştirme makinesi: Casper Excalibur G870 dizüstü, **Windows 11**, RTX 4070 (VRAM'i `nvidia-smi` ile doğrula; dizüstü 4070'ler genellikle 8 GB). Komutlar PowerShell veya WSL2'de çalışabilir; hangisini seçtiğini `docs/ortam.md` dosyasına yaz.
- Bu makine aynı zamanda 7/24 çalışan "işçi"dir (Adobe, ComfyUI). Uzun işlerde sıcaklık ve güç durumunu izle.
- macOS derlemesi bu makinede yapılamaz; CI'da macOS runner kullan.

## Kurallar
- İletişim dili Türkçe; kod, değişken adları ve commit mesajları İngilizce olabilir.
- Şu an **Faz 0** aşamasındayız (komut satırı prototipi). Sonra **Faz 0R (Referans kalitesi)** gelir; arayüz öncelik değildir. Faz 0 ve 0R bitmeden arayüze ve Tauri'ye geçme.
- Sistemin kalite hedefi: verilen referans ajansların temel tasarım dilinin en az %70-80'ini öğrenip ona çok yakın çıktı üretmek (brief Bölüm 11a).
- Her görevden önce kabul kriterini `docs/PROJE_BRIEF.md` Bölüm 11'den oku; kriteri geçmeyen işi "bitti" sayma.
- Ajanlar bir motora değil **tasarım spec'ine** yazar (Bölüm 5). Renderer'lar spec'i tüketir.
- Her model çağrısı ve render işi maliyet sayacından geçer; aylık bütçe tavanı aşılırsa dur ve kullanıcıya sor.
- Fiyatlar, model adları ve kurlar kodda sabit olmasın; yapılandırmadan okunsun.
- Dışarıya giden hiçbir şey (yayın, e-posta, mesaj, teklif) kullanıcı onayı olmadan gönderilmez.
- Bir repo/paket eklemeden önce lisansını ve bakım durumunu kontrol et, `docs/PROJE_BRIEF.md` Bölüm 4 tablosunu güncelle. Müşteri verisini eklentilere gönderirken izole et.
- Kimlik bilgileri, API anahtarları ve müşteri dosyaları repoya girmez; `.env` ve `.gitignore` kullan.
- Bilinmeyen şeyi tahmin etme; "Doğrula" işaretli maddeleri kod yazmadan önce kaynaktan teyit et ve sonucu dokümana yaz.
- Mimari kararlar `docs/adr/` altında kısa karar kaydı (ADR) olarak tutulur.

## Pilot markalar ve referanslar
- Pilot markalar (DK Köksallar, Whisk — Çayyolu matcha kafesi) **gerçek ve izinsiz** işletmelerdir. Bunlar için üretilen her çıktı "konsept çalışması" olarak etiketlenir ve **yayınlanmaz, paylaşılmaz, markaya gönderilmez**.
- DK Köksallar (şehirlerarası otobüs firması) Eylül 2026'ya kadar ESG Dijital müşterisiydi, şu an ajanssız görünüyor. Yine de izinsizdir: markayla iletişim kurma, kullanıcı söylemeden portföyde kullanma.
- Marka kitleri yalnızca kullanıcının verdiği veya halka açık varlıklardan çıkarılır; font, logo ve görsellerin kaynağını ve lisansını `provenance` alanına yaz.
- Referans ajansların (ESG Dijital, Zemberenk Medya) işlerinden yalnızca **ilke ve teknik** çıkarılır (stil kartı); yerleşim, metin veya görsel kopyalanmaz.
- Sosyal medya platformlarını otomatik kazıma (scraping) yok: toplu veri çekme betiği, dosya indirme yok. Kaynaklar: kullanıcının verdiği bağlantı/ekran görüntüleri, resmi API'ler veya kullanıcının açıkça istediği durumda tarayıcıda elle, salt okunur inceleme (beğenme, takip, mesaj yok). Çıktı stil kartıdır, kopya değil.
