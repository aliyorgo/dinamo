-- Express V2 (Seedance) engine support
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS express_engine TEXT DEFAULT 'kling';
