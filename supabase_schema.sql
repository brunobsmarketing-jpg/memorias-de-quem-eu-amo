-- Memórias de Quem Eu Amo — esquema inicial do banco de dados
-- Rode este script uma vez no SQL Editor do Supabase (dashboard do projeto > SQL Editor > New query > Run)

create table if not exists app_users (
  id text primary key,
  name text,
  email text unique,
  credits integer not null default 0,
  is_paid_member boolean not null default false,
  plan_name text,
  created_at timestamptz not null default now()
);

create table if not exists video_jobs (
  id text primary key,
  user_id text not null references app_users(id) on delete cascade,
  title text,
  father_name text,
  photos jsonb not null default '[]',
  tribute_text text,
  selected_voice_id text,
  is_custom_voice boolean not null default false,
  custom_voice_audio_url text,
  selected_track_id text,
  use_ai_images boolean not null default false,
  ai_generated_images jsonb not null default '[]',
  status text not null default 'draft',
  progress integer not null default 0,
  watermark_video_url text,
  unlocked_video_url text,
  card_url text,
  created_at timestamptz not null default now(),
  duration_seconds integer not null default 30
);

create table if not exists payments (
  id text primary key,
  user_id text not null references app_users(id) on delete cascade,
  package_id text,
  amount_brl numeric,
  credits_added integer,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists media_assets (
  id text primary key,
  user_id text not null references app_users(id) on delete cascade,
  type text not null,
  url text not null,
  name text,
  created_at timestamptz not null default now(),
  duration_seconds integer
);

create index if not exists idx_video_jobs_user_id on video_jobs(user_id);
create index if not exists idx_media_assets_user_id on media_assets(user_id);

-- RLS habilitado, sem policies para anon/authenticated: o navegador nunca fala direto com o Supabase,
-- só o nosso servidor Express acessa essas tabelas usando a service_role key (que ignora RLS).
alter table app_users enable row level security;
alter table video_jobs enable row level security;
alter table payments enable row level security;
alter table media_assets enable row level security;
