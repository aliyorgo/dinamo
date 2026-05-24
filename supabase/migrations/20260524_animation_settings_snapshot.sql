-- animation_videos: üretim anındaki ayar snapshot'ı (logo/cta/packshot)
ALTER TABLE animation_videos ADD COLUMN IF NOT EXISTS settings_snapshot JSONB;
