alter table producer_briefs add column if not exists producer_idea text;
alter table producer_briefs add column if not exists producer_idea_sent boolean default false;
alter table producer_briefs add column if not exists producer_idea_sent_at timestamptz;
