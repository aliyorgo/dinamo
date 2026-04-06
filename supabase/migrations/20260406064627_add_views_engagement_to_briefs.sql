alter table briefs add column if not exists views integer default 0;
alter table briefs add column if not exists engagement_rate numeric default 0;
alter table briefs add column if not exists public_link text default '';
