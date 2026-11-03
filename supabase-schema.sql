create extension if not exists pgcrypto;

create table if not exists public.book_marathon_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  whatsapp_mobile text not null,
  age integer not null check (age between 1 and 120),
  gender text not null check (gender in ('male', 'female')),
  area text not null,
  category text not null check (category in ('FOLK', 'CONGREGATION')),
  devotee text not null,
  availability text not null check (availability in ('full_day', 'evenings', 'weekends')),
  language text not null default 'en'
);

alter table public.book_marathon_registrations enable row level security;
revoke all on public.book_marathon_registrations from anon, authenticated;
