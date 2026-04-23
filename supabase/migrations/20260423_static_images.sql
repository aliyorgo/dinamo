ALTER TABLE briefs ADD COLUMN IF NOT EXISTS static_images_url TEXT;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS static_images_generated_at TIMESTAMP;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS static_frame_pool JSONB DEFAULT '[]';
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS static_images_job_status TEXT;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS static_images_job_claimed_at TIMESTAMP;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS static_images_job_payload JSONB;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS static_images_error TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_font_url TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_logo_position TEXT DEFAULT 'bottom';
