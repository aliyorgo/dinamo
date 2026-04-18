-- AI video columns
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ai_video_archive JSONB DEFAULT '[]';
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ai_video_status TEXT;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ai_video_url TEXT;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ai_video_error TEXT;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ai_video_task_id TEXT;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS parent_brief_id UUID REFERENCES briefs(id) NULL;

-- AI generated flag on video submissions
ALTER TABLE video_submissions ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT false;

-- Ensure status column is TEXT (not enum) to support custom values
DO $$ BEGIN
  ALTER TABLE briefs ALTER COLUMN status TYPE TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
