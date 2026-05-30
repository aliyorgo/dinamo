-- Trend CTA revize için asset saklama
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS kling_video_url text;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS voiceover_blocks jsonb;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS cta_text text;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS revision_count integer DEFAULT 0;
