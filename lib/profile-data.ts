import { prisma } from "@/lib/prisma";

const PROVIDER_LABEL: Record<string, string> = { google: "Google" };

/** Data profil yang sama untuk semua role: status password, metode login + tanggal bergabung. */
export async function getProfileBase(userId: string) {
  const record = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, createdAt: true, accounts: { select: { provider: true } } },
  });
  const methods = [
    ...(record?.passwordHash ? ["Email & password"] : []),
    ...(record?.accounts ?? []).map((a) => PROVIDER_LABEL[a.provider] ?? a.provider),
  ];
  return {
    hasPassword: !!record?.passwordHash,
    signIn: methods.length ? methods.join(" · ") : "—",
    memberSince: (record?.createdAt ?? new Date()).toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
  };
}
