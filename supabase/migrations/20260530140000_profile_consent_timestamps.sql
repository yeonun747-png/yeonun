-- 프로필 동의 시각 (PIPA 명시 동의 기록)
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists saju_consent_at timestamptz;

comment on column public.profiles.terms_accepted_at is '이용약관·개인정보처리방침 동의 시각';
comment on column public.profiles.saju_consent_at is '사주(명식) 정보 수집·이용 동의 시각';
