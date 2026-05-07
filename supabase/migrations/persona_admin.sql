-- Persona Admin System Migration
-- Run in Supabase Dashboard SQL Editor

-- 1) personas tablosuna yeni kolonlar
ALTER TABLE personas ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT true;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Mevcut 10 persona için default değerler
UPDATE personas SET is_active = true, is_global = true WHERE is_active IS NULL;
UPDATE personas SET display_order = id WHERE display_order = 0;

-- 2) client_personas tablosu
CREATE TABLE IF NOT EXISTS client_personas (
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  persona_id INTEGER REFERENCES personas(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('exclusive', 'excluded')),
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (client_id, persona_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_client_personas_client ON client_personas(client_id);
CREATE INDEX IF NOT EXISTS idx_client_personas_persona ON client_personas(persona_id);

-- 3) Doğrulama
SELECT id, name, is_active, is_global, display_order FROM personas ORDER BY display_order;
