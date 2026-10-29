import Link from "next/link";
import { AuthHeading, FormAlert } from "@/components/auth/fields";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (token) return <ResetPasswordForm token={token} />;

  return (
    <div className="space-y-5">
      <AuthHeading title="Reset password" subtitle="This page needs a valid reset link." />
      <FormAlert tone="error">The reset link is missing or incomplete.</FormAlert>
      <Link href="/forgot-password" className="inline-block text-[14px] font-semibold text-brand">
        Request a new link
      </Link>
    </div>
  );
}
