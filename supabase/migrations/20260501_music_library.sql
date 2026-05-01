CREATE TABLE IF NOT EXISTS music_library (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mood TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  duration FLOAT,
  size_bytes INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  uploaded_by UUID
);

CREATE INDEX IF NOT EXISTS idx_music_mood ON music_library(mood);
CREATE INDEX IF NOT EXISTS idx_music_client ON music_library(client_id);
CREATE INDEX IF NOT EXISTS idx_music_active ON music_library(is_active);
