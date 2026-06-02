export function asHtmlString(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
}

