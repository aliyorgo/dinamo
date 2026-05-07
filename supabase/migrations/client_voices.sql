-- Client Voices System Migration
-- Run in Supabase Dashboard SQL Editor

CREATE TABLE IF NOT EXISTS client_voices (
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  voice_id TEXT NOT NULL,
  voice_name TEXT,
  gender TEXT CHECK (gender IN ('male', 'female')),
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('exclusive', 'excluded')),
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (client_id, voice_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_client_voices_client ON client_voices(client_id);
CREATE INDEX IF NOT EXISTS idx_client_voices_voice ON client_voices(voice_id);
