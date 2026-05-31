-- CTA revize: eksik kolonlar + status constraint güncelleme
ALTER TABLE ugc_videos ADD COLUMN IF NOT EXISTS cta_text text;
ALTER TABLE animation_videos ADD COLUMN IF NOT EXISTS revision_count integer DEFAULT 0;

-- Status constraint: 'revising' + 'revising_claimed' ekleme
ALTER TABLE ugc_videos DROP CONSTRAINT IF EXISTS ugc_videos_status_check;
ALTER TABLE ugc_videos ADD CONSTRAINT ugc_videos_status_check CHECK (status IN ('queued','generating','ready','failed','sold','revising','revising_claimed'));

ALTER TABLE animation_videos DROP CONSTRAINT IF EXISTS animation_videos_status_check;
ALTER TABLE animation_videos ADD CONSTRAINT animation_videos_status_check CHECK (status IN ('queued','generating','ready','sold','failed','revising','revising_claimed'));
