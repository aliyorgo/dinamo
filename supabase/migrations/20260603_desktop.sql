-- Desktop: desktop_videos tablosu + clients VO kolon + admin_settings

CREATE TABLE IF NOT EXISTS desktop_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID REFERENCES briefs(id) ON DELETE CASCADE,
  concept_image_url TEXT,
  script JSONB,
  final_url TEXT,
  raw_video_url TEXT,
  voiceover_url TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','generating','ready','failed','sold','revising','revising_claimed')),
  error_message TEXT,
  revision_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_desktop_videos_brief ON desktop_videos(brief_id);
CREATE INDEX IF NOT EXISTS idx_desktop_videos_status ON desktop_videos(status);

ALTER TABLE desktop_videos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='desktop_videos_select_all' AND tablename='desktop_videos') THEN
    CREATE POLICY desktop_videos_select_all ON desktop_videos FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='desktop_videos_insert_auth' AND tablename='desktop_videos') THEN
    CREATE POLICY desktop_videos_insert_auth ON desktop_videos FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='desktop_videos_update_auth' AND tablename='desktop_videos') THEN
    CREATE POLICY desktop_videos_update_auth ON desktop_videos FOR UPDATE USING (true);
  END IF;
END $$;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS desktop_vo_enabled BOOLEAN DEFAULT true;

INSERT INTO admin_settings (key, value) VALUES
  ('credit_desktop_generate', '1'),
  ('feature_desktop_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
