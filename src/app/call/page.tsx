import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** 레거시 /call → OpenAI Realtime 음성 상담(/call-dcc) */
export default function CallPage() {
  redirect("/call-dcc");
}
