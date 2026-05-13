import { SearchStandalonePage } from "@/components/search/SearchOverlay";

export const metadata = {
  title: "검색 | 연운 緣運",
  description: "연운의 풀이와 안내자를 검색하세요.",
};

export default function SearchPage() {
  return (
    <div className="yeonunPage">
      <SearchStandalonePage />
    </div>
  );
}

