-- Marka maskot stil ikonlari (mascot_only ve mascot_hybrid icin ayri PNG)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS mascot_only_icon_url TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS mascot_hybrid_icon_url TEXT;
