ALTER TABLE briefs ADD COLUMN IF NOT EXISTS static_images_url TEXT;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS static_images_generated_at TIMESTAMP;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_font_url TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_logo_position TEXT DEFAULT 'bottom';
