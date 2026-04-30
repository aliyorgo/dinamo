ALTER TABLE creators ADD COLUMN IF NOT EXISTS unavailable_dates JSONB DEFAULT '[]'::jsonb;
