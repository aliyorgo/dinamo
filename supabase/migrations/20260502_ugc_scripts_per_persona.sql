-- Persona bazlı script storage
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ugc_scripts JSONB DEFAULT '{}';

-- Migrate existing ugc_script to new structure (if exists)
UPDATE briefs
SET ugc_scripts = jsonb_build_object(
  COALESCE(ugc_selected_persona_id::text, '0'),
  ugc_script
)
WHERE ugc_script IS NOT NULL AND ugc_scripts = '{}';
