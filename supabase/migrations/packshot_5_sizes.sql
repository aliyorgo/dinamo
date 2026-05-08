-- Packshot 5 Boyut Sistemi
-- Run in Supabase Dashboard SQL Editor

ALTER TABLE clients ADD COLUMN IF NOT EXISTS packshots JSONB DEFAULT '{}'::jsonb;

-- Eski packshot_url varsa 9:16 olarak migrate et
UPDATE clients
SET packshots = jsonb_build_object('9x16', packshot_url)
WHERE packshot_url IS NOT NULL
AND (packshots IS NULL OR packshots = '{}'::jsonb);
