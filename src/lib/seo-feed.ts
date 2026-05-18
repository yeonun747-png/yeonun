import type { Product } from "@/lib/data/content";
import type { NoticeView } from "@/lib/notices";
import { absoluteUrl, getSiteUrl } from "@/lib/site-url";
import { escapeXmlText, toRfc822Date } from "@/lib/seo-xml";

type RssItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
};

function rssItemXml(item: RssItem): string {
  return [
    "    <item>",
    `      <title>${escapeXmlText(item.title)}</title>`,
    `      <link>${escapeXmlText(item.link)}</link>`,
    `      <description>${escapeXmlText(item.description)}</description>`,
    `      <pubDate>${escapeXmlText(item.pubDate)}</pubDate>`,
    `      <guid isPermaLink="true">${escapeXmlText(item.guid)}</guid>`,
    "    </item>",
  ].join("\n");
}

/** RSS 2.0 — 네이버·다음·구글 뉴스 피드 등록용 */
export function buildSiteRssFeed(input: { products: Product[]; notices: NoticeView[] }): string {
  const site = getSiteUrl();
  const now = toRfc822Date(new Date());
  const channelTitle = "연운 緣運";
  const channelDesc =
    "천 년의 명리학과 4명의 인연 안내자. 사주·궁합·길일·꿈해몽 등 운명 풀이 서비스 연운의 최신 콘텐츠입니다.";

  const productItems: RssItem[] = [...input.products]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 40)
    .map((p) => {
      const link = absoluteUrl(`/fortune/${p.slug}`);
      const desc = (p.quote || p.title).trim().slice(0, 280);
      return {
        title: `${p.title} · 연운`,
        link,
        description: desc || p.title,
        pubDate: toRfc822Date(p.created_at || new Date()),
        guid: link,
      };
    });

  const noticeItems: RssItem[] = input.notices.slice(0, 15).map((n) => {
    const link = absoluteUrl("/notices");
    return {
      title: `[공지] ${n.title}`,
      link,
      description: n.title,
      pubDate: now,
      guid: `${site}/notices#${n.slug}`,
    };
  });

  const items = [...productItems, ...noticeItems];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXmlText(channelTitle)}</title>`,
    `    <link>${escapeXmlText(site)}</link>`,
    `    <description>${escapeXmlText(channelDesc)}</description>`,
    "    <language>ko</language>",
    `    <lastBuildDate>${escapeXmlText(now)}</lastBuildDate>`,
    `    <atom:link href="${escapeXmlText(absoluteUrl("/feed.xml"))}" rel="self" type="application/rss+xml" />`,
    ...items.map(rssItemXml),
    "  </channel>",
    "</rss>",
  ].join("\n");
}
