import { createServiceClient } from "@/lib/supabase/service";
import {
  NotificationRecipientsManager,
  type Recipient,
} from "@/components/admin/notification-recipients-manager";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("notification_recipients")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Email Notifications</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose who gets emailed. A person set to &quot;All branches&quot; receives everything; a person set to one
          branch only receives alerts about that branch.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <b>Testing mode:</b> emails are currently sent from Resend&apos;s test address, which can only deliver to
        thannaporn.s@mimetta.co. Other addresses can be saved here, but they will not receive emails until the
        sending domain is verified in Resend.
      </div>

      {error ? (
        <p className="text-destructive">Failed to load recipients: {error.message}</p>
      ) : (
        <NotificationRecipientsManager initialRecipients={(data ?? []) as Recipient[]} />
      )}
    </div>
  );
}