-- 연운(Yeonun) 최소 스키마 초안
-- Supabase SQL Editor에서 실행

create table if not exists public.characters (
  key text primary key,
  name text not null,
  han text not null,
  en text not null,
  spec text not null,
  greeting text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.character_personas (
  character_key text primary key references public.characters(key) on delete cascade,
  color_hex text null,
  age_impression text null,
  voice_tone text null,
  honorific_style text null,
  field_core text null,
  emotional_distance text null,
  sentence_tempo text null,
  endings text null,
  specialties jsonb not null default '[]'::jsonb,
  temperament text null,
  speech_style text null,
  emotion_style text null,
  strengths text null,
  keywords text[] not null default '{}'::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_prompts (
  key text primary key,
  title text not null,
  prompt text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cartesia 등 TTS 보이스 마스터 (external_id = Cartesia voice UUID)
create table if not exists public.tts_voices (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'cartesia',
  external_id text not null,
  label text not null,
  gender text not null default 'other' check (gender in ('female','male','other')),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table if not exists public.character_mode_prompts (
  character_key text not null references public.characters(key) on delete cascade,
  mode text not null check (mode in ('voice','fortune_text')),
  title text not null,
  prompt text not null,
  is_active boolean not null default true,
  tts_voice_id uuid null references public.tts_voices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (character_key, mode)
);

-- 기존 DB에 테이블만 있고 컬럼이 없을 때
alter table public.character_mode_prompts
  add column if not exists tts_voice_id uuid null references public.tts_voices(id) on delete set null;

create table if not exists public.categories (
  slug text primary key,
  label text not null,
  sort_order int not null default 0
);

create table if not exists public.products (
  slug text primary key,
  title text not null,
  quote text not null,
  category_slug text not null references public.categories(slug) on delete restrict,
  badge text null,
  price_krw int not null,
  character_key text not null references public.characters(key) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 홈 섹션(이번주 인연 등) / 풀이 탭 태그 / 썸네일 SVG(어드민에서 마크업 직접 관리)
alter table public.products
  add column if not exists home_section_slug text null,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists thumbnail_svg text null;
comment on column public.products.home_section_slug is 'weekly_love | lifetime | season_2026 | deep_dive — 홈 노출 섹션 구분';
comment on column public.products.tags is '풀이 카드용 해시태그(최대 3개 권장)';
comment on column public.products.thumbnail_svg is '카드 일러스트용 SVG 마크업(viewBox 포함). 비우면 앱 기본 일러스트 사용';

alter table public.products
  add column if not exists saju_input_profile text not null default 'single'
  check (saju_input_profile in ('single', 'pair'));
comment on column public.products.saju_input_profile is 'single=내 사주만, pair=상대방·자녀 등 두 번째 생시 필요(궁합·재회·택일·자녀사주 등)';

alter table public.products
  add column if not exists payment_code int,
  add column if not exists fortune_menu jsonb not null default '{"main_menus":[]}'::jsonb;
comment on column public.products.payment_code is 'PG 등에서 상품을 구분하는 4자리 숫자(1000~9999). 신규 insert 시 자동 부여.';
comment on column public.products.fortune_menu is '점사 UI용 대메뉴/소메뉴 트리(JSON).';

create unique index if not exists products_payment_code_key
  on public.products (payment_code)
  where payment_code is not null;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_slug text not null references public.products(slug) on delete cascade,
  user_mask text not null,
  stars numeric(2,1) not null default 5.0,
  body text not null,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_char_updated_at on public.characters;
create trigger trg_char_updated_at
before update on public.characters
for each row execute function public.set_updated_at();

drop trigger if exists trg_character_personas_updated_at on public.character_personas;
create trigger trg_character_personas_updated_at
before update on public.character_personas
for each row execute function public.set_updated_at();

drop trigger if exists trg_service_prompts_updated_at on public.service_prompts;
create trigger trg_service_prompts_updated_at
before update on public.service_prompts
for each row execute function public.set_updated_at();

drop trigger if exists trg_character_mode_prompts_updated_at on public.character_mode_prompts;
create trigger trg_character_mode_prompts_updated_at
before update on public.character_mode_prompts
for each row execute function public.set_updated_at();

drop trigger if exists trg_tts_voices_updated_at on public.tts_voices;
create trigger trg_tts_voices_updated_at
before update on public.tts_voices
for each row execute function public.set_updated_at();

drop trigger if exists trg_product_updated_at on public.products;
create trigger trg_product_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create or replace function public.products_assign_payment_code()
returns trigger
language plpgsql
as $$
declare
  nxt int;
begin
  if new.payment_code is not null then
    return new;
  end if;
  select coalesce(max(p.payment_code), 999) + 1 into nxt from public.products p;
  if nxt > 9999 then
    nxt := 9999;
  end if;
  new.payment_code := nxt;
  return new;
end;
$$;

drop trigger if exists products_assign_payment_code_trigger on public.products;
create trigger products_assign_payment_code_trigger
  before insert on public.products
  for each row execute function public.products_assign_payment_code();

-- RLS(초기: 공개 읽기, 어드민은 service role로 CRUD)
alter table public.characters enable row level security;
alter table public.character_personas enable row level security;
alter table public.service_prompts enable row level security;
alter table public.tts_voices enable row level security;
alter table public.character_mode_prompts enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "public read characters" on public.characters;
create policy "public read characters" on public.characters
for select using (true);

drop policy if exists "public read character personas" on public.character_personas;
create policy "public read character personas" on public.character_personas
for select using (is_active = true);

drop policy if exists "public read active service prompts" on public.service_prompts;
create policy "public read active service prompts" on public.service_prompts
for select using (is_active = true);

drop policy if exists "public read active character mode prompts" on public.character_mode_prompts;
create policy "public read active character mode prompts" on public.character_mode_prompts
for select using (is_active = true);

drop policy if exists "public read active tts voices" on public.tts_voices;
create policy "public read active tts voices" on public.tts_voices
for select using (is_active = true);

drop policy if exists "public read categories" on public.categories;
create policy "public read categories" on public.categories
for select using (true);

drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products
for select using (true);

drop policy if exists "public read reviews" on public.reviews;
create policy "public read reviews" on public.reviews
for select using (true);

-- ============ 운영 확장 스키마 ============

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  user_ref text null,
  product_slug text null references public.products(slug) on delete set null,
  status text not null default 'pending',
  amount_krw int not null default 0,
  currency text not null default 'KRW',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid null references public.orders(id) on delete set null,
  provider text not null default 'manual',
  method text not null default 'card',
  provider_tid text null,
  status text not null default 'pending',
  paid_at timestamptz null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid null references public.payments(id) on delete set null,
  amount_krw int not null default 0,
  reason text null,
  status text not null default 'requested',
  processed_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null default 'amount',
  value int not null default 0,
  starts_at timestamptz null,
  ends_at timestamptz null,
  max_uses int null,
  used_count int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text not null,
  event_id text null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received',
  processed_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.voice_sessions (
  id uuid primary key default gen_random_uuid(),
  character_key text null references public.characters(key) on delete set null,
  user_ref text null,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  duration_sec int not null default 0,
  cost_krw int not null default 0,
  summary text null,
  memory_summary text null,
  memory_updated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 기존 DB에 테이블만 있고 컬럼이 없을 때
alter table public.voice_sessions add column if not exists memory_summary text null;
alter table public.voice_sessions add column if not exists memory_updated_at timestamptz null;

create table if not exists public.voice_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.voice_sessions(id) on delete cascade,
  role text not null,
  text text null,
  audio_url text null,
  created_at timestamptz not null default now()
);

create table if not exists public.voice_usage (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.voice_sessions(id) on delete cascade,
  provider text not null default 'manual',
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  audio_seconds int not null default 0,
  cost_estimate numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.fortune_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  model text not null default 'claude-4.6-sonnet',
  system_prompt text not null,
  schema jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fortune_requests (
  id uuid primary key default gen_random_uuid(),
  user_ref text null,
  product_slug text null references public.products(slug) on delete set null,
  order_id uuid null references public.orders(id) on delete set null,
  status text not null default 'queued',
  model text not null default 'claude-4.6-sonnet',
  prompt_version_id uuid null references public.fortune_prompt_versions(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fortune_results (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.fortune_requests(id) on delete cascade,
  status text not null default 'completed',
  html text not null,
  summary text null,
  raw_stream_url text null,
  completed_at timestamptz null,
  created_at timestamptz not null default now()
);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
drop trigger if exists trg_coupons_updated_at on public.coupons;
create trigger trg_coupons_updated_at before update on public.coupons for each row execute function public.set_updated_at();
drop trigger if exists trg_voice_sessions_updated_at on public.voice_sessions;
create trigger trg_voice_sessions_updated_at before update on public.voice_sessions for each row execute function public.set_updated_at();
drop trigger if exists trg_fortune_requests_updated_at on public.fortune_requests;
create trigger trg_fortune_requests_updated_at before update on public.fortune_requests for each row execute function public.set_updated_at();
drop trigger if exists trg_fortune_prompt_versions_updated_at on public.fortune_prompt_versions;
create trigger trg_fortune_prompt_versions_updated_at before update on public.fortune_prompt_versions for each row execute function public.set_updated_at();

alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.coupons enable row level security;
alter table public.webhook_events enable row level security;
alter table public.voice_sessions enable row level security;
alter table public.voice_turns enable row level security;
alter table public.voice_usage enable row level security;
alter table public.fortune_requests enable row level security;
alter table public.fortune_results enable row level security;
alter table public.fortune_prompt_versions enable row level security;

drop policy if exists "public read active coupons" on public.coupons;
create policy "public read active coupons" on public.coupons
for select using (is_active = true);

