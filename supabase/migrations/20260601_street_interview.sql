-- Sokak Röportajı: street_videos tablosu + clients yeni kolonlar

CREATE TABLE IF NOT EXISTS street_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID REFERENCES briefs(id) ON DELETE CASCADE,
  host_image_url TEXT,
  intro_music_url TEXT,
  host_description TEXT,
  questions JSONB,
  script JSONB,
  final_url TEXT,
  raw_video_url TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','generating','ready','failed','sold','revising','revising_claimed')),
  cta_text TEXT,
  pre_cta_video_url TEXT,
  error_message TEXT,
  revision_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_street_videos_brief ON street_videos(brief_id);
CREATE INDEX IF NOT EXISTS idx_street_videos_status ON street_videos(status);

ALTER TABLE street_videos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='street_videos_select_all' AND tablename='street_videos') THEN
    CREATE POLICY street_videos_select_all ON street_videos FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='street_videos_insert_auth' AND tablename='street_videos') THEN
    CREATE POLICY street_videos_insert_auth ON street_videos FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='street_videos_update_auth' AND tablename='street_videos') THEN
    CREATE POLICY street_videos_update_auth ON street_videos FOR UPDATE USING (true);
  END IF;
END $$;

-- clients tablosuna sokak röportajı kolonları
ALTER TABLE clients ADD COLUMN IF NOT EXISTS street_host_image_url TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS street_host_description TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_intro_music_url TEXT;
