-- ============================================================
-- AI UGC BETA — ROLLBACK
-- Beta iptal edilirse bu dosyayı Supabase SQL Editor'da çalıştır
-- Sıralama önemli: önce FK'lar, sonra tablolar
-- ============================================================

-- 1) Briefs alter — kolonları kaldır
ALTER TABLE briefs DROP COLUMN IF EXISTS ugc_persona_id;
ALTER TABLE briefs DROP COLUMN IF EXISTS ugc_status;
ALTER TABLE briefs DROP COLUMN IF EXISTS ugc_video_id;

-- 2) UGC Videos tablosu sil (CASCADE ile FK'lar otomatik gider)
DROP TABLE IF EXISTS ugc_videos CASCADE;

-- 3) Personas tablosu sil
DROP TABLE IF EXISTS personas CASCADE;

-- 4) Storage bucket (opsiyonel — thumbnail'ler kalsın istersen silme)
-- DELETE FROM storage.objects WHERE bucket_id = 'persona-thumbnails';
-- DELETE FROM storage.buckets WHERE id = 'persona-thumbnails';

-- ============================================================
-- ROLLBACK TAMAMLANDI
-- ============================================================
