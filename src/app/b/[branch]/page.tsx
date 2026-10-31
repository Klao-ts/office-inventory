import { notFound } from "next/navigation";
import { isBranch, BRANCH_LABELS } from "@/lib/branches";
import { ALLOWED_EMAIL_DOMAIN, getCurrentStaff, hasAccess, isAllowedEmail } from "@/lib/staff-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { GoogleSignIn } from "@/components/branch/google-sign-in";
import { RequestAccess } from "@/components/branch/request-access";
import { BranchSignOut } from "@/components/branch/branch-sign-out";
import { BranchWithdrawalForm, type ItemOption } from "@/components/branch/branch-withdrawal-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function Notice({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        <BranchSignOut />
      </CardContent>
    </Card>
  );
}

export default async function BranchPage({
  params,
  searchParams,
}: {
  params: { branch: string };
  searchParams: { error?: string };
}) {
  const branch = params.branch;
  if (!isBranch(branch)) return notFound();

  const label = BRANCH_LABELS[branch];
  const { user, email, viaGoogle, member } = await getCurrentStaff(branch);
  const googleName = String(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "");

  let content: React.ReactNode;

  if (!email || !viaGoogle) {
    content = (
      <>
        <GoogleSignIn branch={branch} branchLabel={label} domainHint={ALLOWED_EMAIL_DOMAIN} />
        {searchParams.error && (
          <p className="text-center text-sm text-destructive">Sign-in didn&apos;t complete. Please try again.</p>
        )}
        {email && !viaGoogle && (
          <p className="text-center text-sm text-muted-foreground">
            You&apos;re currently signed in with a password account ({email}). Sign in with Google to continue.
          </p>
        )}
      </>
    );
  } else if (member && hasAccess(member)) {
    // Items come from the server, filtered to THIS branch only.
    const service = createServiceClient();
    const { data: itemRows } = await service
      .from("items")
      .select("id, name, category, current_stock, minimum_threshold")
      .eq("branch", branch)
      .eq("is_active", true)
      .order("name");

    content = (
      <>
        <BranchWithdrawalForm
          branch={branch}
          branchLabel={label}
          staffName={member.full_name}
          department={member.department}
          initialItems={(itemRows ?? []) as ItemOption[]}
        />
        <div className="flex justify-center">
          <BranchSignOut />
        </div>
      </>
    );
  } else if (member?.status === "pending") {
    content = (
      <Notice
        title="Waiting for approval"
        description={`Your request to join ${label} was sent. An administrator will review it.`}
      >
        <p className="text-sm text-muted-foreground">You can close this page and come back later.</p>
      </Notice>
    );
  } else if (member?.status === "rejected") {
    content = (
      <Notice title="Request declined" description={`Your request to join ${label} was not approved.`}>
        <p className="text-sm text-muted-foreground">Please contact your administrator if this is a mistake.</p>
      </Notice>
    );
  } else if (member && !member.is_active) {
    content = (
      <Notice title="Access switched off" description={`Your access to ${label} is currently switched off.`}>
        <p className="text-sm text-muted-foreground">Please contact your administrator.</p>
      </Notice>
    );
  } else if (!isAllowedEmail(email)) {
    content = (
      <Notice
        title="Company account needed"
        description={`${email} can't request access. Please sign in with your @${ALLOWED_EMAIL_DOMAIN} account.`}
      />
    );
  } else {
    content = <RequestAccess branch={branch} branchLabel={label} email={email} name={googleName} />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-center text-2xl font-bold text-slate-900">Office Supplies · {label}</h1>
      {content}
    </main>
  );
}