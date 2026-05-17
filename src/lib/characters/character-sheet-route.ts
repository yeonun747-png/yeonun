import type { Character } from "@/lib/data/characters";

export function characterSheetCloseHref(from: string | undefined): string {
  return from === "meet" ? "/meet" : "/";
}

export function characterContentLinkExtra(c: Character, from: string | undefined): string {
  const backToCharacter = `/characters/${c.key}?sheet=1&from=${from ?? "home"}`;
  return `&ck=${encodeURIComponent(c.key)}&back=${encodeURIComponent(backToCharacter)}`;
}
