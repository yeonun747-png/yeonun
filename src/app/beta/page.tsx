import type { Metadata } from "next";

import { BetaPageClient } from "@/components/beta/BetaPageClient";
import { absoluteUrl } from "@/lib/site-url";

const OG_IMAGE_PATH = "/og/yeonun_opengraph.png";
const BETA_PATH = "/beta";
const BETA_URL = absoluteUrl(BETA_PATH);
const TITLE = "연운 베타 테스트 초대 🌸";
const DESCRIPTION =
  "4명의 인연 안내자와 처음 만나보세요. 10,000 크레딧 무료 제공 · 솔직한 의견 부탁드려요";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: BETA_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: BETA_URL,
    siteName: "연운 緣運",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: OG_IMAGE_PATH,
        width: 1730,
        height: 909,
        alt: TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE_PATH],
  },
};

export default function BetaPage() {
  return <BetaPageClient />;
}
