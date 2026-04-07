ALTER TABLE client_users ADD COLUMN IF NOT EXISTS allocated_credits INT DEFAULT 0;
