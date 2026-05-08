-- Used Appearance tracking for lock feature
ALTER TABLE ugc_videos ADD COLUMN IF NOT EXISTS used_appearance JSONB;
