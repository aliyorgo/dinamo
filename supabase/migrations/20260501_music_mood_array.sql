DROP INDEX IF EXISTS idx_music_mood;
ALTER TABLE music_library ALTER COLUMN mood TYPE TEXT[] USING CASE WHEN mood IS NOT NULL THEN ARRAY[mood] ELSE NULL END;
CREATE INDEX idx_music_mood ON music_library USING GIN(mood);
