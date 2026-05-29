import "server-only";

import { supabaseServer } from "@/lib/supabase/server";

function parseSlugArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((s): s is string => typeof s === "string" && s.trim().length > 0))];
}

export async function getNoticeReadSlugs(userId: string): Promise<string[]> {
  const sb = supabaseServer();
  const { data, error } = await sb.from("profiles").select("notice_read_slugs").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return parseSlugArray(data?.notice_read_slugs);
}

export async function markNoticeReadForUser(userId: string, slug: string): Promise<string[]> {
  const trimmed = slug.trim();
  if (!trimmed) return getNoticeReadSlugs(userId);

  const existing = await getNoticeReadSlugs(userId);
  if (existing.includes(trimmed)) return existing;

  const next = [...existing, trimmed];
  const sb = supabaseServer();
  const { error } = await sb.from("profiles").update({ notice_read_slugs: next }).eq("id", userId);
  if (error) throw new Error(error.message);
  return next;
}

export async function mergeNoticeReadSlugs(userId: string, slugs: string[]): Promise<string[]> {
  const incoming = parseSlugArray(slugs);
  if (!incoming.length) return getNoticeReadSlugs(userId);

  const existing = await getNoticeReadSlugs(userId);
  const merged = [...new Set([...existing, ...incoming])];
  if (merged.length === existing.length) return existing;

  const sb = supabaseServer();
  const { error } = await sb.from("profiles").update({ notice_read_slugs: merged }).eq("id", userId);
  if (error) throw new Error(error.message);
  return merged;
}
