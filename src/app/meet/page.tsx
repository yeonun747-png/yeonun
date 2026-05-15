import { MeetPageClient } from "@/components/meet/MeetPageClient";
import { getCharacters } from "@/lib/data/characters";

export default async function MeetPage() {
  const characters = await getCharacters();
  return <MeetPageClient characters={characters} />;
}
