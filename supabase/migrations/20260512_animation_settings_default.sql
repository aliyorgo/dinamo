-- animation_settings JSONB default (kolon zaten var, sadece default set)
ALTER TABLE briefs ALTER COLUMN animation_settings SET DEFAULT '{"logo_enabled": true, "cta_enabled": true, "packshot_enabled": false}'::jsonb;
