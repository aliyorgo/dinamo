ALTER TABLE credit_sales ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id) NULL;
ALTER TABLE credit_sales ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE credit_sales ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES credit_packages(id) NULL;
