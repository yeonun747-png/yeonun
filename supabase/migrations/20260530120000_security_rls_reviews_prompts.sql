-- reviews: 미발행·user_ref 노출 방지 — is_published=true만 anon/authenticated SELECT
drop policy if exists "public read reviews" on public.reviews;
drop policy if exists "public read published reviews" on public.reviews;
create policy "public read published reviews" on public.reviews
for select using (is_published = true);

-- LLM 프롬프트: anon/authenticated 직접 조회 차단 (API service_role만)
drop policy if exists "public read active service prompts" on public.service_prompts;
drop policy if exists "deny client service prompts" on public.service_prompts;
create policy "deny client service prompts" on public.service_prompts
for all using (false) with check (false);

drop policy if exists "public read active character mode prompts" on public.character_mode_prompts;
drop policy if exists "deny client character mode prompts" on public.character_mode_prompts;
create policy "deny client character mode prompts" on public.character_mode_prompts
for all using (false) with check (false);
