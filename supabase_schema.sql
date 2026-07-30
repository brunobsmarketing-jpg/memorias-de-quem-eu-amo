-- Memora — esquema inicial do banco de dados
-- Rode este script uma vez no SQL Editor do Supabase (dashboard do projeto > SQL Editor > New query > Run)

create table if not exists app_users (
  id text primary key,
  name text,
  email text unique,
  credits integer not null default 0,
  is_paid_member boolean not null default false,
  plan_name text,
  created_at timestamptz not null default now(),
  -- Prova de que quem está chamando a API é dono desse userId (ver requireOwnership em
  -- server.ts) — sem isso, qualquer cliente podia mandar um userId alheio e mexer na conta
  -- de outra pessoa (deduzir crédito, sobrescrever vídeo/livro).
  session_token text unique
);

-- Rode esta linha também se app_users já existia antes desta coluna ser criada:
alter table app_users add column if not exists session_token text unique;

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
  duration_seconds integer not null default 30,
  caption_style jsonb,
  -- 'classic' (formato quadrado/retrato padrão do produto) ou 'vertical' (9:16, novo formato
  -- alternativo para Stories/Reels) — ver AspectRatioOption em src/types.ts.
  aspect_ratio text not null default 'classic'
);

alter table video_jobs add column if not exists aspect_ratio text not null default 'classic';

create table if not exists payments (
  id text primary key,
  user_id text not null references app_users(id) on delete cascade,
  package_id text,
  amount_brl numeric,
  credits_added integer,
  status text,
  created_at timestamptz not null default now(),
  -- id do pagamento na Mercado Pago (ou "payt:<id>" quando vier da Payt) — garante que o
  -- webhook nunca credite duas vezes o mesmo pagamento em caso de reenvio de notificação.
  external_id text,
  -- de onde veio o pagamento: 'payt' (compra inicial, vira membro pago) ou 'mercadopago'
  -- (créditos adicionais, comprados dentro do app já como membro).
  gateway text
);

alter table payments add column if not exists external_id text;
alter table payments add column if not exists gateway text;
create unique index if not exists idx_payments_external_id on payments(external_id) where external_id is not null;

create table if not exists media_assets (
  id text primary key,
  user_id text not null references app_users(id) on delete cascade,
  type text not null,
  url text not null,
  name text,
  created_at timestamptz not null default now(),
  duration_seconds integer
);

-- Livro de Memórias — mesma conta/créditos do produto de vídeo (app_users), é só outro tipo
-- de homenagem que a pessoa pode escolher criar na mesma tela.
create table if not exists memory_book_jobs (
  id text primary key,
  user_id text not null references app_users(id) on delete cascade,
  father_name text,
  photos jsonb not null default '[]',
  pages jsonb not null default '[]',
  selected_track_id text,
  selected_voice_id text,
  is_custom_voice boolean not null default false,
  custom_voice_audio_url text,
  narration_text text,
  status text not null default 'draft',
  progress integer not null default 0,
  unlocked_video_url text,
  card_url text,
  created_at timestamptz not null default now(),
  duration_seconds integer not null default 30,
  aspect_ratio text not null default 'classic'
);

alter table memory_book_jobs add column if not exists aspect_ratio text not null default 'classic';

create index if not exists idx_video_jobs_user_id on video_jobs(user_id);
create index if not exists idx_media_assets_user_id on media_assets(user_id);
create index if not exists idx_memory_book_jobs_user_id on memory_book_jobs(user_id);

-- RLS habilitado, sem policies para anon/authenticated: o navegador nunca fala direto com o Supabase,
-- só o nosso servidor Express acessa essas tabelas usando a service_role key (que ignora RLS).
alter table app_users enable row level security;
alter table video_jobs enable row level security;
alter table payments enable row level security;
alter table media_assets enable row level security;
alter table memory_book_jobs enable row level security;
