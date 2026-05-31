-- CTA revize asset koruma: CTA-öncesi video snapshot URL'i
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS pre_cta_video_url text;
ALTER TABLE ugc_videos ADD COLUMN IF NOT EXISTS pre_cta_video_url text;
ALTER TABLE animation_videos ADD COLUMN IF NOT EXISTS pre_cta_video_url text;
