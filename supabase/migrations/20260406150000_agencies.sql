-- Ajans tablosu
CREATE TABLE agencies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  contact_email TEXT,
  commission_rate DECIMAL(5,4) DEFAULT 0.15,
  total_earnings DECIMAL(12,2) DEFAULT 0,
  invoiced_amount DECIMAL(12,2) DEFAULT 0,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  demo_credits INT DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ajans ödeme talepleri
CREATE TABLE agency_payment_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL,
  amount DECIMAL(12,2),
  credit_package_id UUID REFERENCES credit_packages(id) NULL,
  credits_requested INT NULL,
  status TEXT DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ajans fatura kayıtları
CREATE TABLE agency_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  invoice_date DATE,
  invoice_number TEXT,
  is_paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mevcut tablolara kolon ekle
ALTER TABLE clients ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id) NULL;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id) NULL;
