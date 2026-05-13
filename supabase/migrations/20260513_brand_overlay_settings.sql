-- Brand Overlay Studio - merkezi overlay ayarlari
-- Yapi: { "express": { "9:16": { "logo": {...}, "cta": {...} }, "1:1": {...} }, "animation": {...}, "persona": {...}, "static_image": {...} }
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_overlay_settings JSONB DEFAULT '{}'::jsonb;

-- Processing placeholder videolari (marka-ozel yukleme ekrani)
-- Yapi: { "express": "https://...", "animation": "https://...", "persona": "https://..." }
ALTER TABLE clients ADD COLUMN IF NOT EXISTS processing_placeholder_videos JSONB DEFAULT '{}'::jsonb;
