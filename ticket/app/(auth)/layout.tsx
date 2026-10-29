import { Suspense, type ReactNode } from "react";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { AuthShell } from "@/components/auth/AuthShell";

// Shell (header, ilustrasi, footer) & kartu ada di layout, jadi tidak re-mount saat
// pindah Sign in <-> Sign Up. Suspense dibutuhkan karena AuthPanel memakai useSearchParams.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <AuthPanel>{children}</AuthPanel>
      </Suspense>
    </AuthShell>
  );
}
