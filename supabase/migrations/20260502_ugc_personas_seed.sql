-- Persona Seed Data (10 sabit kayıt)
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

ON CONFLICT (id) DO NOTHING;

-- Reset sequence
SELECT setval('personas_id_seq', 10);
