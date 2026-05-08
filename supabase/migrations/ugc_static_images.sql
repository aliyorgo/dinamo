-- UGC Static Images Support
-- Run in Supabase Dashboard SQL Editor

ALTER TABLE ugc_videos ADD COLUMN IF NOT EXISTS static_images_url TEXT;
ALTER TABLE ugc_videos ADD COLUMN IF NOT EXISTS static_image_files JSONB;
ALTER TABLE ugc_videos ADD COLUMN IF NOT EXISTS static_images_job_status TEXT;
ALTER TABLE ugc_videos ADD COLUMN IF NOT EXISTS static_images_job_payload JSONB;
ALTER TABLE ugc_videos ADD COLUMN IF NOT EXISTS static_images_error TEXT;
