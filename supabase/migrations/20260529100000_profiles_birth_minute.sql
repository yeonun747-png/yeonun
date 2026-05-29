-- 출생 분(0–59): 만세력 시주 정밀도. birth_branch_key(시진)와 함께 저장.

alter table public.profiles
  add column if not exists birth_minute smallint
  check (birth_minute is null or (birth_minute >= 0 and birth_minute <= 59));

comment on column public.profiles.birth_minute is '출생 분(0–59). birth_time_unknown이면 null.';
