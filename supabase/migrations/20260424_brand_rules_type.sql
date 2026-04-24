ALTER TABLE brand_rules ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'rule';
ALTER TABLE brand_learning_candidates ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'rule';
ALTER TABLE brand_rules ADD COLUMN IF NOT EXISTS source_type TEXT;

DROP POLICY IF EXISTS "allow_all_br" ON brand_rules;
CREATE POLICY "brand_rules_all" ON brand_rules FOR ALL USING (true) WITH CHECK (true);
