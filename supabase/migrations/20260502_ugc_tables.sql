-- AI UGC Beta Tables

-- Personas (sabit 10 kayıt)
CREATE TABLE IF NOT EXISTS personas (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  age_range TEXT NOT NULL,
  gender TEXT NOT NULL,
  tone_description TEXT NOT NULL,
  environment_prompt TEXT NOT NULL,
  thumbnail_url TEXT,
  product_compatibility TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- UGC Videos
CREATE TABLE IF NOT EXISTS ugc_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brief_id UUID REFERENCES briefs(id) ON DELETE CASCADE,
  persona_id INTEGER REFERENCES personas(id),
  script JSONB,
  shot_urls JSONB DEFAULT '[]'::jsonb,
  final_url TEXT,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued','generating','ready','failed','sold')),
  product_image_used BOOLEAN DEFAULT false,
  error TEXT,
  credit_cost_generate INTEGER DEFAULT 1,
  credit_cost_purchase INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  sold_at TIMESTAMP
);

CREATE INDEX idx_ugc_brief ON ugc_videos(brief_id);
CREATE INDEX idx_ugc_status ON ugc_videos(status);

-- Briefs alter for UGC
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ugc_persona_id INTEGER REFERENCES personas(id);
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ugc_status TEXT;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ugc_video_id UUID REFERENCES ugc_videos(id);
