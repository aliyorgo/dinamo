@AGENTS.md

# ALIYORGO PROJECT — CLAUDE CODE WORKING PRINCIPLES

Bu doküman Claude Code'un her session başında okuyacağı çalışma kurallarıdır. Aliyorgo (DCC Film managing partner, Dinamo Video Pipeline sahibi) tercihleridir.

## TEMEL PRENSİPLER

1. **Plan → Onay → Uygula sırası.** Plan paylaşılmadan commit yok.
2. **Kafadan ekleme yok.** Aliyorgo'nun verdiği patika dışına çıkma. Şüphede sor.
3. **Kalite önce.** "Olsun bitsin" yaklaşımı yasak. İyi sonuç vermeyecekse yöntemi öner.
4. **Production'a auto-apply yok.** DB migration, breaking change, yeni dosya öncesi onay gerekir.
5. **Tam içerik ver, özet değil.** cat çıktısı truncate edilirse yeniden çek.
6. **Türkçe konuş, emoji yok.**

## DOKUNULMAZ DOSYALAR (Aliyorgo onayı olmadan)

- pipeline_final.js (V1 Kling, deprecated kalacak)
- pipeline_animation.js
- pipeline_ugc.js
- pipeline_static_images.js
- worker.js routing kısmı (sadece poll ekleme onaylı)
- Mevcut DB schema'da CREATE TABLE / DELETE TABLE / DROP

## ONAY GEREKEN KARARLAR

- DB migration apply (yeni tablo, ALTER, DROP)
- Yeni pipeline dosyası oluşturma
- Breaking change herhangi mevcut pipeline'da
- Env variable ekleme/değiştirme
- npm package ekleme
- API endpoint değişikliği
- Claude system prompt büyük rewrite (>50 satır)
- Frontend route değişikliği

## ONAY GEREKMEYEN KARARLAR (Aliyorgo yokken yapabilirsin)

- Bug fix < 20 satır (mevcut davranışı düzeltme)
- console.log ekleme/güncelleme
- Comment ekleme
- Test brief tetikleme (test-pipeline scripti ile)
- Railway log okuma + analiz + rapor
- Prompt küçük tweak (mevcut prompt yapısında bir kelime/satır)
- Documentation güncellemesi (README, comment)

## TEST PROSEDÜRÜ

Her commit + push sonrası:
1. Railway deploy bekle (~3 dakika)
2. railway logs ile worker başladı mı doğrula (yeni [WORKER-VERSION] timestamp)
3. Test brief tetikle (npm run test-pipeline veya manuel)
4. Worker log son 100 satırı analiz et
5. Hata varsa highlight, başarılıysa video URL + scenePrompt ilk 200 char paylaş
6. Aliyorgo'ya rapor (özet yok, gerçek çıktı)

## HATA DAVRANIŞI

- Production hata gözlenirse: hemen rollback (git revert + push)
- Sonra Aliyorgo'ya rapor (sebep, etki, alınan aksiyon)
- Sessiz hatayı bildirme — gözlerinden kaçırma yasak
- Worker silent fail varsa (job yarıda kalma) hemen rapor

## ALIYORGO YOKKEN

Yapabilirsin (yukarıdaki "onay gerekmeyen" liste):
- Bug fix < 20 satır
- Test brief tetikleme
- Log analiz
- Küçük prompt tweak
- Output rapor

Yapamazsın:
- DB migration apply
- Yeni dosya oluşturma
- Yeni pipeline yazma
- Breaking change
- Premium Pipeline implementation aşamaları (her aşama Aliyorgo onayı bekler)
- Üst üste 3'ten fazla commit (3 commit'te dur, Aliyorgo'ya rapor)

## İLETİŞİM

- Türkçe konuş
- Özet yerine TAM İÇERİK ver
- Diff göstereceksin önce/sonra format (kısa görsel özet yetmez)
- Karar değişkenleri varsa Aliyorgo'ya sor
- Emoji yok
- "Applying migrations to Supabase" gibi UI status yanılgıya yol açar — gerçekten ne yaptığını açıkça söyle (dosya yazma, DB'ye apply değil)

## DEMO ÖNCELİĞİ

Yapı Kredi premium demo yakın. Demo blocker'lar öncelikli:
- Express V2 kalitesi (aspect ratio, dissolve, karakter tekrarı, stil yansıması)
- Premium Pipeline temel akış (DB hazır, implementation aşamaları)
- Türkiye lokasyon zorunluluğu (sahne Türkiye'de geçmeli)
- Content filter (finance, age, regulated industries — sanitize)

## PROJE YAPISI

- Repo: ~/dinamo (Mac local), github.com/aliyorgo/dinamo-video-pipeline
- Worker: Railway auto-deploy
- DB: Supabase (project: liegyfgignwepqgswxhg)
- Frontend: Vercel (Next.js, ~/dinamo same repo)
- Pipelines:
  - pipeline_final.js (V1 Kling, deprecated)
  - pipeline_express_seedance.js (V2 Seedance i2v + Nano Banana, AKTİF)
  - pipeline_animation.js (mascot animation)
  - pipeline_ugc.js (persona/UGC)
  - pipeline_static_images.js
  - pipeline_premium.js (gelecek, Premium Kling shot-by-shot veya multi-shot)
- DB Schema onemli tablolar:
  - briefs (main)
  - clients (brand bilgileri)
  - commercial_styles (12 TVC stil, Premium DB)
  - directors (12 yonetmen profili, Premium DB)
  - tiktok_formats (13 TikTok format, Premium DB)
  - character_portraits (Nano Banana havuz)
  - brand_objects (recurring obje)
  - shot_outputs (plan-based revizyon)
  - music_library (royalty-free pool)
  - animation_videos, ugc_videos (ayri tablolar)

## SEEDANCE PIPELINE PRENSİPLERİ

- task_type: 'seedance-2-fast' (preview degil, mode support icin)
- mode: 'omni_reference' (image_urls karakter referans, first frame degil)
- @image1, @image2 syntax karakter eslestirme icin
- Prompt yapisi 3-beat (0-5s, 5-10s, 10-15s)
- Hard cuts only (pozitif directive — "sharp instant cut", "NO fade" gibi negative directive zayif)
- Lighting-first per beat
- Acting micro-moments her karakter her beat
- Turkiye lokasyon explicit (Italya/Ispanya/Yunanistan degil)
- Generic karakter etiketi yasak (young professional, casual everyday)

## CONTENT FILTER SANITIZATION

Seedance prompt'ta YASAK kelimeler (sizinti = video fail):
- Finance: investment, financial, unlimited, money, banking, returns, savings, loan, credit
- Health: medication, prescription, pharmaceutical, treatment
- Alcohol: alcohol, liquor, vodka, whiskey
- Gambling: gambling, betting, casino
- Age: child, kid, young, boy, girl, teen, baby, toddler (karakter rolu ile gecilir, image age tasir)
- Mediterranean (generic): Italy/Spain/Greece'e default oluyor, "Turkish" veya specific Turk lokasyonu kullan

## WORKFLOW

- Aliyorgo Cursor terminal'inde Claude Code calistiriyor
- Tek session genelde
- Railway CLI kurulu, Claude Code direkt log okuyabilir
- Supabase CLI bagli, manuel SQL apply gerekirse Supabase Dashboard
- npm run test-pipeline scripti ile test brief tetikleme (yazilacak)
