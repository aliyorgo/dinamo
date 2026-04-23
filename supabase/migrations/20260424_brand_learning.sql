CREATE TABLE IF NOT EXISTS brand_learning_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  source_type TEXT NOT NULL,
  source_ids UUID[] DEFAULT '{}',
  source_snippets TEXT[] DEFAULT '{}',
  rule_text TEXT NOT NULL,
  rule_condition TEXT,
  rule_type TEXT NOT NULL DEFAULT 'positive',
  temporal BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending',
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brand_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  rule_text TEXT NOT NULL,
  rule_condition TEXT,
  rule_type TEXT NOT NULL DEFAULT 'positive',
  temporal BOOLEAN DEFAULT false,
  source_candidate_id UUID,
  manually_added BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blc_client ON brand_learning_candidates(client_id);
CREATE INDEX IF NOT EXISTS idx_blc_status ON brand_learning_candidates(status);
CREATE INDEX IF NOT EXISTS idx_br_client ON brand_rules(client_id);

ALTER TABLE brand_learning_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_blc" ON brand_learning_candidates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_br" ON brand_rules FOR ALL USING (true) WITH CHECK (true);
