ALTER TABLE briefs ADD COLUMN IF NOT EXISTS reference_links JSONB DEFAULT '[]'::jsonb;
