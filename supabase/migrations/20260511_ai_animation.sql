-- ══════════════════════════════════════════════════════════════════════════════
-- AI ANIMATION — DB MIGRATION
-- Çalıştır: Supabase SQL Editor'da manuel
-- ══════════════════════════════════════════════════════════════════════════════

-- 1) animation_styles — 8 stil tanımı
CREATE TABLE IF NOT EXISTS animation_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'seedance',
  task_type TEXT NOT NULL DEFAULT 'seedance-2-fast-preview',
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  prompt_template TEXT,                        -- Opus system prompt (stil-spesifik, admin iter eder)
  icon_path TEXT,                              -- public/animation/styles/{slug}.png
  mood_hints TEXT[] DEFAULT '{}',              -- stil-spesifik mood (Opus prompt'a beslenir)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8 stil INSERT
INSERT INTO animation_styles (slug, label, model, task_type, sort_order, icon_path, mood_hints, prompt_template) VALUES
('pixar_3d',               'PIXAR 3D',                 'seedance', 'seedance-2-fast-preview', 1, '/animation/styles/pixar_3d.png',               ARRAY['warm','playful','emotional'],       'PLACEHOLDER — Pixar 3D stil prompt. Karakter odaklı, ısı, ışık, duygusal hook. Multi-shot 8 saniye.'),
('japanese_anime',         'JAPANESE ANIME',            'seedance', 'seedance-2-fast-preview', 2, '/animation/styles/japanese_anime.png',         ARRAY['dramatic','energetic','epic'],       'PLACEHOLDER — Japanese Anime stil prompt. Dinamik kamera, dramatik, hız çizgileri. Multi-shot 8 saniye.'),
('kids_2d',                'KIDS 2D CELL',              'seedance', 'seedance-2-fast-preview', 3, '/animation/styles/kids_2d.png',                ARRAY['playful','fun','bouncy'],            'PLACEHOLDER — Kids 2D Cell stil prompt. Naive, klasik karikatür komedi (Tom & Jerry / Snoopy tonu). Multi-shot 8 saniye.'),
('pictogram',              'PICTOGRAM',                 'seedance', 'seedance-2-fast-preview', 4, '/animation/styles/pictogram.png',              ARRAY['minimal','corporate','clean'],       'PLACEHOLDER — Pictogram stil prompt. Minimal, ironik, geometrik metafor. Multi-shot 8 saniye.'),
('paper_cutout',           'PAPER CUT-OUT',             'seedance', 'seedance-2-fast-preview', 5, '/animation/styles/paper_cutout.png',           ARRAY['warm','handmade','whimsical'],       'PLACEHOLDER — Paper Cut-out stil prompt. Masalsı, el yapımı butik. Multi-shot 8 saniye.'),
('european_illustration',  'EUROPEAN ILLUSTRATION',     'seedance', 'seedance-2-fast-preview', 6, '/animation/styles/european_illustration.png',  ARRAY['elegant','lifestyle','premium'],     'PLACEHOLDER — European Illustration stil prompt. Sade, akvarel, premium lifestyle. Multi-shot 8 saniye.'),
('retro_80s',              'RETRO 80s',                 'seedance', 'seedance-2-fast-preview', 7, '/animation/styles/retro_80s.png',              ARRAY['retro','synth','neon'],              'PLACEHOLDER — Retro 80s stil prompt. Neon, VHS, synth-narrator. Multi-shot 8 saniye.'),
('claymation',             'CLAYMATION',                'seedance', 'seedance-2-fast-preview', 8, '/animation/styles/claymation.png',             ARRAY['quirky','tactile','handmade'],       'PLACEHOLDER — Claymation stil prompt. Kil topu fiziği, oyuncak hissi, Aardman tonu. Multi-shot 8 saniye.')
ON CONFLICT (slug) DO NOTHING;

-- 2) animation_videos — üretim kayıtları (ugc_videos paralelinde)
CREATE TABLE IF NOT EXISTS animation_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID NOT NULL REFERENCES briefs(id),
  style_slug TEXT NOT NULL REFERENCES animation_styles(slug),
  shots_json JSONB,                            -- Opus'tan gelen shot listesi
  script TEXT,                                 -- voiceover text (enforceMaxWords sonrası)
  music_mood TEXT,                             -- Opus'un önerdiği mood (debug + Seedance prompt)
  cta_text TEXT,
  final_url TEXT,
  raw_video_url TEXT,
  voiceover_url TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','generating','ready','sold','failed')),
  error_message TEXT,
  version INT NOT NULL DEFAULT 1,
  feedback_summary TEXT,
  generating_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  credit_cost_generate INT DEFAULT 1,
  credit_cost_purchase INT DEFAULT 1,
  used_concept JSONB,                          -- debug/audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_animation_videos_brief ON animation_videos(brief_id);
CREATE INDEX IF NOT EXISTS idx_animation_videos_status ON animation_videos(status);
CREATE INDEX IF NOT EXISTS idx_animation_videos_generating ON animation_videos(generating_started_at) WHERE generating_started_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_animation_videos_style ON animation_videos(style_slug);

-- 3) briefs tablosuna animation alanları
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS animation_settings JSONB;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS last_animation_style TEXT;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS animation_status TEXT;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS animation_feedbacks JSONB DEFAULT '[]';

-- 4) Kredi ayarları
INSERT INTO admin_settings (key, value) VALUES ('credit_ai_animation_generate', '1') ON CONFLICT (key) DO NOTHING;
INSERT INTO admin_settings (key, value) VALUES ('credit_ai_animation', '1') ON CONFLICT (key) DO NOTHING;

-- 5) Feature flag
INSERT INTO admin_settings (key, value) VALUES ('animation_global_enabled', 'false') ON CONFLICT (key) DO NOTHING;

-- 6) RLS
ALTER TABLE animation_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE animation_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "animation_styles_public_read" ON animation_styles FOR SELECT USING (true);
CREATE POLICY "animation_videos_all" ON animation_videos FOR ALL USING (true) WITH CHECK (true);
