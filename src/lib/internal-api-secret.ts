/** Cloudways·cron 등 서버 간 호출용 shared secret */
export function readInternalApiSecret(): string {
  return (
    process.env.FORTUNE_COMPLETE_SECRET?.trim() ||
    process.env.CLOUDWAYS_PROXY_SECRET?.trim() ||
    ""
  );
}

export function isInternalApiRequest(request: Request): boolean {
  const expected = readInternalApiSecret();
  if (!expected) return process.env.NODE_ENV !== "production";

  const auth = request.headers.get("authorization") ?? "";
  if (auth === `Bearer ${expected}`) return true;
  const header = request.headers.get("x-yeonun-internal-secret") ?? "";
  return header === expected;
}

export function requireCloudwaysProxySecret(): string | null {
  const secret = process.env.CLOUDWAYS_PROXY_SECRET?.trim() ?? "";
  if (!secret) return null;
  return secret;
}
