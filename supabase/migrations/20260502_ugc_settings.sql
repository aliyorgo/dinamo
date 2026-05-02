-- AI UGC Settings columns
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ugc_settings JSONB;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ugc_brand_defaults JSONB;
