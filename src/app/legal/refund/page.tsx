import { LegalDocSheetClient } from "@/components/legal/LegalDocSheetClient";
import { MyTabBackdrop } from "@/components/my/MyTabBackdrop";

export const metadata = {
  title: "환불정책 | 연운 緣運",
  description: "연운 환불정책 안내",
};

function resolveBackHref(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v === "string" && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/my";
}

export default async function RefundPage({
  searchParams,
}: {
  searchParams: Promise<{ back?: string | string[] }>;
}) {
  const sp = await searchParams;
  const backHref = resolveBackHref(sp.back);

  return (
    <>
      <MyTabBackdrop />
      <LegalDocSheetClient title="환불정책" ariaLabel="환불정책" backHref={backHref}>
        <main style={{ maxWidth: 520, margin: "0 auto", padding: "8px 4px 40px", lineHeight: 1.8 }}>
          <p style={{ marginTop: 0, fontSize: 12.5, color: "var(--y-mute)" }}>
            목업 단계용 페이지입니다. 정식 정책 문구는 추후 반영됩니다.
          </p>
        </main>
      </LegalDocSheetClient>
    </>
  );
}
