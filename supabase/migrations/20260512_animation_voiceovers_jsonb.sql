-- Stil basina voiceover persist (JSONB)
-- Yapi: { "mascot_hybrid": "metin...", "japanese_anime": "metin..." }
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS animation_voiceovers JSONB DEFAULT '{}'::jsonb;

-- Mevcut last_animation_voiceover degerini migrate et (geriye uyumlu)
UPDATE briefs
SET animation_voiceovers = jsonb_build_object(last_animation_style, last_animation_voiceover)
WHERE last_animation_style IS NOT NULL
  AND last_animation_voiceover IS NOT NULL
  AND last_animation_voiceover != ''
  AND (animation_voiceovers IS NULL OR animation_voiceovers = '{}'::jsonb);
