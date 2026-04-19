-- Hybrid/AI Express/MVC yapısı
-- brief_type: hangi tip brief olduğunu belirtir
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS brief_type TEXT DEFAULT 'primary';
-- Değerler: 'primary' (ana brief), 'mvc_child' (alt format), 'express_clone' (AI klon)

-- MVC formatı: alt brief'in video formatı
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS mvc_format TEXT;
-- '6sn', '15sn', 'bumper', 'story' gibi

-- MVC adet: kaç adet üretilecek
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS mvc_quantity INTEGER DEFAULT 1;

-- MVC sırası: çocuk brief'lerin sırası
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS mvc_order INTEGER;

-- Backfill: mevcut brief'lerin tiplerini belirle

-- Ana brief'ler → primary
UPDATE briefs SET brief_type = 'primary'
WHERE parent_brief_id IS NULL
AND campaign_name NOT LIKE '% — Full AI%'
AND (brief_type IS NULL OR brief_type = 'primary');

-- AI klonları → express_clone
UPDATE briefs SET brief_type = 'express_clone'
WHERE campaign_name LIKE '% — Full AI%';

-- Alt brief'ler (reorder) → mvc_child
UPDATE briefs SET brief_type = 'mvc_child'
WHERE parent_brief_id IS NOT NULL
AND campaign_name NOT LIKE '% — Full AI%';

ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ai_feedbacks JSONB DEFAULT '[]';
