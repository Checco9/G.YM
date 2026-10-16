import type { Metadata } from "next";
import Link from "next/link";
import { NotificationSettings } from "@/components/notification-settings";
import { Icon } from "@/components/ui/icons";
import { requireUser } from "@/modules/auth/session";
import { getOverview, pushConfigured, vapidPublicKey } from "@/modules/notifications/service";

export const metadata: Metadata = { title: "Notifiche" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser();
  const overview = await getOverview(user.id);
  return (
    <div>
      <Link href="/profile" className="mb-4 inline-flex items-center gap-1 text-muted hover:text-fg">
        <Icon name="left" size={18} /> Profilo
      </Link>
      <h1 className="num mb-6 text-5xl font-semibold leading-none">Notifiche</h1>
      <NotificationSettings configured={pushConfigured()} publicKey={vapidPublicKey()} settings={overview.settings} reminders={overview.reminders} devices={overview.devices} />
    </div>
  );
}
