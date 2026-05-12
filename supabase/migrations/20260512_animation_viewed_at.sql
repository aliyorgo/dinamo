-- Animation video viewed tracking (Express/Persona pattern)
ALTER TABLE animation_videos ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
