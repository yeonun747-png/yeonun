import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Fragment } from "react";

import { BottomNav } from "@/components/BottomNav";
import { TopNav } from "@/components/TopNav";
import { CAROUSEL_CHAR } from "@/lib/characters/character-carousel-static";
import { absoluteUrl } from "@/lib/site-url";
import { verifyDailyWordShareToken } from "@/lib/today-daily-word-share-token";

const OG_IMAGE_PATH = "/og/yeonun_opengraph.png";
const SITE_NAME = "연운 緣運";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

function metadataForPayload(token: string, payload: NonNullable<ReturnType<typeof verifyDailyWordShareToken>>): Metadata {
  const title = `${payload.l}의 오늘 한 마디`;
  const description = payload.q;
  const url = absoluteUrl(`/today/share/${token}`);

  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "ko_KR",
      type: "article",
      images: [
        {
          url: OG_IMAGE_PATH,
          width: 1730,
          height: 909,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE_PATH],
    },
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const payload = verifyDailyWordShareToken(token);
  if (!payload) {
    return { title: SITE_NAME };
  }
  return metadataForPayload(token, payload);
}

export default async function TodayDailyWordSharePage({ params }: Props) {
  const { token } = await params;
  const payload = verifyDailyWordShareToken(token);
  if (!payload) notFound();

  const character = CAROUSEL_CHAR[payload.c];

  return (
    <Fragment>
      <section className="yeonunPage y-today-share-page">
        <TopNav />
        <main className="y-today-share-main">
          <p className="y-today-share-eyebrow">오늘의 한 마디</p>
          <h1 className="y-today-share-title">
            <span className="y-today-share-han" aria-hidden="true">
              {character.han}
            </span>
            {payload.l}의 오늘 한 마디
          </h1>
          <blockquote className="y-today-share-quote">&ldquo;{payload.q}&rdquo;</blockquote>
          <p className="y-today-share-foot">나만의 사주 기반 운세 · {SITE_NAME}</p>
          <Link href="/today" className="y-today-share-cta">
            나도 오늘의 한 마디 받기
          </Link>
        </main>
        <BottomNav />
      </section>
    </Fragment>
  );
}
