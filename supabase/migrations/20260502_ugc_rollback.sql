-- ROLLBACK: AI UGC Beta tables
-- Çalıştırma: sadece beta iptal edilirse

ALTER TABLE briefs DROP COLUMN IF EXISTS ugc_persona_id;
ALTER TABLE briefs DROP COLUMN IF EXISTS ugc_status;
ALTER TABLE briefs DROP COLUMN IF EXISTS ugc_video_id;

DROP TABLE IF EXISTS ugc_videos;
DROP TABLE IF EXISTS personas;
