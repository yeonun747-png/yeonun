import { BottomNav } from "@/components/BottomNav";
import { TopNav } from "@/components/TopNav";
import { TodayDailyWordsGate } from "@/components/today/TodayDailyWordsGate";
import { TodayForYouCta } from "@/components/today/TodayForYouCta";
import { TodayIljinAndLuckClient } from "@/components/today/TodayIljinAndLuckClient";
import { TodayAttendanceClient } from "@/components/today/TodayAttendanceClient";
import { TodayDailyRecordClient } from "@/components/today/TodayDailyRecordClient";
import { TodayMissionsClient } from "@/components/today/TodayMissionsClient";
import { formatKstConsultHeaderEn, formatKstConsultHeaderKo, formatKstMonthDayDot } from "@/lib/datetime/kst";
import { formatKstTodayLunarHeader } from "@/lib/datetime/kst-lunar";
import { getTodayPublicIljin, getTodayPublicLuck } from "@/lib/today-kst-public";

export default function TodayPage() {
  const now = new Date();
  const kstEn = formatKstConsultHeaderEn(now);
  const kstKo = formatKstConsultHeaderKo(now);
  const kstMd = formatKstMonthDayDot(now);
  const kstLunar = formatKstTodayLunarHeader(now);
  const iljin = getTodayPublicIljin(now);
  const luck = getTodayPublicLuck(now);

  return (
    <div className="yeonunPage y-today-page">
      <TopNav />
      <main>
        <div className="y-today-header">
          <div className="y-today-date">{kstEn}</div>
          <div className="y-today-date-ko">{kstKo}</div>
          <div className="y-today-lunar">{kstLunar}</div>
        </div>

        <TodayIljinAndLuckClient fallbackIljin={iljin} fallbackLuck={luck} between={<TodayForYouCta />} />

        <TodayDailyWordsGate kstMd={kstMd} />

        <TodayAttendanceClient />

        <TodayMissionsClient />

        <TodayDailyRecordClient />

        <div style={{ height: 80 }} />
      </main>
      <BottomNav />
    </div>
  );
}

