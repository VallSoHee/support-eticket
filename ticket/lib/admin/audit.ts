import { prisma } from "@/lib/prisma";

// FR-8.1 — pencatat audit log. Modul ini SENGAJA hanya menyediakan create:
// tidak ada fungsi update/delete audit log di mana pun di aplikasi (FR-8.2).
// Kegagalan mencatat log tidak boleh menggagalkan aksi utama, jadi error hanya di-log.
export type AuditEntry = {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  description?: string;
};

export async function writeAudit(entry: AuditEntry) {
  try {
    // Simpan nama pelaku saat kejadian: kalau akunnya nanti dihapus, actorId jadi NULL
    // tetapi log tetap menunjukkan siapa pelakunya.
    const actor = await prisma.user.findUnique({ where: { id: entry.actorId }, select: { name: true } });
    await prisma.auditLog.create({ data: { ...entry, actorName: actor?.name ?? null } });
  } catch (e) {
    console.error("[audit] gagal mencatat audit log:", e);
  }
}
