-- CS 검색용: 소셜 이메일이 비어 있으면 Auth synthetic 로그인 이메일과 동일하게 저장
update public.yeonun_social_users
set email = lower(provider || '.' || provider_id || '@oauth.yeonun.kr')
where (email is null or btrim(email) = '')
  and provider is not null
  and provider_id is not null;
