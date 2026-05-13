-- Brand overlay preview video URL
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_overlay_preview_url TEXT;
