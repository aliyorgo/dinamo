-- Animation sticky voiceover (Persona pattern - refresh sonrasi korunur)
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS last_animation_voiceover TEXT;
