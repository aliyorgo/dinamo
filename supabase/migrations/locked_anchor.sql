ALTER TABLE briefs ADD COLUMN IF NOT EXISTS locked_anchor_video_id UUID;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS locked_anchor_persona_id INTEGER;
