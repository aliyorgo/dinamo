-- AI video pipeline state columns
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ai_video_status TEXT;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ai_video_task_id TEXT;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ai_video_error TEXT;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS product_image_url TEXT;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS root_campaign_id UUID REFERENCES briefs(id) NULL;

-- Backfill root_campaign_id
UPDATE briefs SET root_campaign_id = id WHERE root_campaign_id IS NULL AND parent_brief_id IS NULL;
UPDATE briefs b1 SET root_campaign_id = (SELECT root_campaign_id FROM briefs b2 WHERE b2.id = b1.parent_brief_id) WHERE root_campaign_id IS NULL AND parent_brief_id IS NOT NULL;

-- Brand columns on clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_primary_color TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_secondary_color TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_forbidden_colors TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_tone TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_avoid TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_notes TEXT;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ai_video_seen_at TIMESTAMP;

-- Fix foreign key constraints to allow deletion
ALTER TABLE briefs DROP CONSTRAINT IF EXISTS briefs_parent_brief_id_fkey;
ALTER TABLE briefs ADD CONSTRAINT briefs_parent_brief_id_fkey
  FOREIGN KEY (parent_brief_id) REFERENCES briefs(id) ON DELETE SET NULL;

ALTER TABLE briefs DROP CONSTRAINT IF EXISTS briefs_root_campaign_id_fkey;
ALTER TABLE briefs ADD CONSTRAINT briefs_root_campaign_id_fkey
  FOREIGN KEY (root_campaign_id) REFERENCES briefs(id) ON DELETE SET NULL;

ALTER TABLE briefs ADD COLUMN IF NOT EXISTS pipeline_type TEXT DEFAULT 'character';

ALTER TABLE clients ADD COLUMN IF NOT EXISTS ai_video_enabled BOOLEAN DEFAULT false;
