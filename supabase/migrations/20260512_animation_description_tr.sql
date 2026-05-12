-- Turkce kisa aciklama kolonu
ALTER TABLE animation_styles ADD COLUMN IF NOT EXISTS description_tr TEXT;

UPDATE animation_styles SET description_tr = 'Sicak, duygulu' WHERE slug = 'pixar_3d';
UPDATE animation_styles SET description_tr = 'Dinamik, dramatik' WHERE slug = 'japanese_anime';
UPDATE animation_styles SET description_tr = 'Eglenceli, cocuksu' WHERE slug = 'kids_2d';
UPDATE animation_styles SET description_tr = 'Sade, ikonik' WHERE slug = 'pictogram';
UPDATE animation_styles SET description_tr = 'El yapimi, samimi' WHERE slug = 'paper_cutout';
UPDATE animation_styles SET description_tr = 'Sinema kalitesinde gercek' WHERE slug = 'european_illustration';
UPDATE animation_styles SET description_tr = 'Retro, neon, nostaljik' WHERE slug = 'retro_80s';
UPDATE animation_styles SET description_tr = 'Stop-motion, dokulu' WHERE slug = 'claymation';
UPDATE animation_styles SET description_tr = 'Firma maskotu' WHERE slug = 'mascot_only';
UPDATE animation_styles SET description_tr = 'Maskot ve gercek dunya' WHERE slug = 'mascot_hybrid';
