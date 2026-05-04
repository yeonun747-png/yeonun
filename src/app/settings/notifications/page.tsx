import { NotificationSettingsClient } from "@/components/settings/NotificationSettingsClient";
import { MyTabBackdrop } from "@/components/my/MyTabBackdrop";

export const metadata = {
  title: "알림 설정 | 연운 緣運",
  description: "알림 설정",
};

export default function NotificationSettingsPage() {
  return (
    <>
      <MyTabBackdrop />
      <NotificationSettingsClient />
    </>
  );
}
