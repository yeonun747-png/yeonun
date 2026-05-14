import { LegalDocSheetClient } from "@/components/legal/LegalDocSheetClient";
import { TermsDocContent } from "@/components/legal/LegalDocContent";
import { MyTabBackdrop } from "@/components/my/MyTabBackdrop";

export const metadata = {
  title: "이용약관 | 연운 緣運",
  description: "연운 이용약관 안내",
};

function resolveBackHref(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v === "string" && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/my";
}

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ back?: string | string[]; history?: string | string[] }>;
}) {
  const sp = await searchParams;
  const backHref = resolveBackHref(sp.back);
  const useHistoryBack = (Array.isArray(sp.history) ? sp.history[0] : sp.history) === "1";

  return (
    <>
      <MyTabBackdrop />
      <LegalDocSheetClient title="이용약관" ariaLabel="이용약관" backHref={backHref} useHistoryBack={useHistoryBack}>
        <main style={{ maxWidth: 720, margin: "0 auto", padding: "8px 16px 40px" }}>
          <TermsDocContent />
        </main>
      </LegalDocSheetClient>
    </>
  );
}
