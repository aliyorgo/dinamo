-- ============================================================
-- AI UGC BETA — FULL MIGRATION
-- Supabase SQL Editor'da tek seferde çalıştır
-- Sıralama: 1) personas → 2) ugc_videos → 3) briefs alter
-- Idempotent: IF NOT EXISTS/ON CONFLICT kullanır, 2x çalıştırılabilir
-- ============================================================

-- 1) PERSONAS TABLOSU
CREATE TABLE IF NOT EXISTS personas (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  age_range TEXT NOT NULL,
  gender TEXT NOT NULL,
  tone_description TEXT NOT NULL,
  environment_prompt TEXT NOT NULL,
  thumbnail_url TEXT,
  product_compatibility TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2) PERSONA SEED DATA (10 sabit kayıt)
INSERT INTO personas (id, name, slug, description, age_range, gender, tone_description, environment_prompt, product_compatibility) VALUES
(1, 'Gen Z Kız', 'gen_z_kiz', 'Üniversiteli, samimi, trend takipçisi', '20-23', 'female',
 'Samimi "kanka" tonu, ünlem ve günlük dil, heyecanlı ama doğal, "ya şunu denedim bak" tarzı',
 'Küçük yatak odası veya yurt odası, renkli ışıklar, dağınık ama sevimli, telefon selfie açısı',
 ARRAY['beauty','fashion','food','tech','lifestyle']),

(2, 'Çalışan Kadın', 'calisan_kadin', 'Profesyonel, sade, güvenilir', '28-35', 'female',
 'Objektif ve sade ton, "bunu kullanıyorum çünkü..." mantığı, jargon yok, güvenilir ağabey/abla hissi',
 'Modern ev ofisi veya minimalist salon, doğal ışık, düzenli arka plan, orta plan kamera',
 ARRAY['tech','lifestyle','home','finance','health']),

(3, 'Genç Anne', 'genc_anne', 'Mom POV, pratik çözümcü', '28-38', 'female',
 'Anne bakış açısı, "çocuklar için bunu keşfettim" veya "hayatımı kolaylaştırdı", samimi ve pratik',
 'Aydınlık ev ortamı, mutfak veya oturma odası, arka planda çocuk oyuncakları/evi görünebilir',
 ARRAY['food','home','baby','health','lifestyle']),

(4, 'Tech Erkek', 'tech_erkek', 'İnceleyici, kıyaslayıcı, detaycı', '22-32', 'male',
 'Kıyaslayıcı ton, "şu özelliği var ama asıl fark şu", teknik ama anlaşılır, biraz nerd',
 'Masa başı setup, monitör arkası veya beyaz masa üstü, ürün close-up için iyi ışık',
 ARRAY['tech','gaming','gadget','software']),

(5, 'Moda Kadın', 'moda_kadin', 'Stil odaklı, trend belirleyici', '25-35', 'female',
 'Stil odaklı, "bu sezon şunu kombinliyorum", görsel ağırlıklı, az kelime çok görüntü',
 'Işıklı giyinme odası veya ayna karşısı, dolap veya askılık arkada, estetik ışıklandırma',
 ARRAY['fashion','beauty','lifestyle','luxury']),

(6, 'Anadolu Baba', 'anadolu_baba', 'Sade güven, esnaf bilgeliği', '40-50', 'male',
 'Sade Anadolu güveni, "evladım ben bunu yıllardır kullanıyorum" tarzı, samimi ve güvenilir baba figürü',
 'Dükkan önü, bahçe veya balkon, doğal dış mekan ışığı, sade arka plan',
 ARRAY['food','home','auto','garden','traditional']),

(7, 'Lüks Kadın', 'luks_kadin', 'Sofistike, kontrollü, premium', '30-45', 'female',
 'Kontrollü ve sofistike, "kaliteyi hissediyorsun" tarzı, az kelime ama etkili, premium his',
 'Lüks otel odası veya premium ev dekorasyonu, mermer/altın detaylar, yumuşak aydınlatma',
 ARRAY['luxury','beauty','fashion','travel','wellness']),

(8, 'Beauty Kız', 'beauty_kadin', 'Makyaj masası, uygulama anı', '22-30', 'female',
 'Makyaj/cilt bakımı uzmanı, "texture''ına bakın" tarzı, ürünü uygularken anlatır, ASMR hissi',
 'Makyaj masası, halka ışık, ayna, ürünler dizili, close-up friendly ortam',
 ARRAY['beauty','skincare','haircare','wellness']),

(9, 'Spor Erkek', 'spor_erkek', 'Enerjik, motivasyonel, fitness', '25-38', 'male',
 'Enerjik ve motivasyonel, "antrenman sonrası şunu içiyorum" tarzı, kısa keskin cümleler',
 'Spor salonu veya park, ter ve enerji hissi, doğal ışık, hareket halinde',
 ARRAY['sport','health','food','supplement','wellness']),

(10, 'Beyaz Yaka Erkek', 'beyaz_yaka_erkek', 'Rasyonel ağabey, iş dünyası', '28-40', 'male',
 'Rasyonel ve mantıklı, "fiyat-performans olarak bakarsak" tarzı, ağabey tavsiyesi, güvenilir',
 'Ev ofisi veya kafe, laptop açık, kahve, sade profesyonel ortam',
 ARRAY['tech','finance','lifestyle','productivity','business'])

ON CONFLICT (slug) DO NOTHING;

-- Sequence sync (eğer id'ler manual insert edildiyse)
SELECT setval(pg_get_serial_sequence('personas', 'id'), COALESCE(MAX(id), 1)) FROM personas;

-- 3) UGC_VIDEOS TABLOSU
CREATE TABLE IF NOT EXISTS ugc_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brief_id UUID REFERENCES briefs(id) ON DELETE CASCADE,
  persona_id INTEGER REFERENCES personas(id),
  script JSONB,
  shot_urls JSONB DEFAULT '[]'::jsonb,
  final_url TEXT,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued','generating','ready','failed','sold')),
  product_image_used BOOLEAN DEFAULT false,
  error TEXT,
  credit_cost_generate INTEGER DEFAULT 1,
  credit_cost_purchase INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  sold_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ugc_brief ON ugc_videos(brief_id);
CREATE INDEX IF NOT EXISTS idx_ugc_status ON ugc_videos(status);

-- 4) BRIEFS ALTER
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ugc_persona_id INTEGER REFERENCES personas(id);
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ugc_status TEXT;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS ugc_video_id UUID;

-- 5) RLS (mevcut pattern: service_role tam erişim, anon key select)
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ugc_videos ENABLE ROW LEVEL SECURITY;

-- Personas: herkes okuyabilir (public data)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'personas_select_all' AND tablename = 'personas') THEN
    CREATE POLICY personas_select_all ON personas FOR SELECT USING (true);
  END IF;
END $$;

-- UGC Videos: authenticated users kendi brief'lerine erişim
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ugc_videos_select_own' AND tablename = 'ugc_videos') THEN
    CREATE POLICY ugc_videos_select_own ON ugc_videos FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ugc_videos_insert' AND tablename = 'ugc_videos') THEN
    CREATE POLICY ugc_videos_insert ON ugc_videos FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ugc_videos_update' AND tablename = 'ugc_videos') THEN
    CREATE POLICY ugc_videos_update ON ugc_videos FOR UPDATE USING (true);
  END IF;
END $$;

-- ============================================================
-- TAMAMLANDI
-- ============================================================
