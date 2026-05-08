-- Locked Persona Appearance
-- Run in Supabase Dashboard SQL Editor
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS locked_persona_appearance JSONB DEFAULT '{}'::jsonb;
