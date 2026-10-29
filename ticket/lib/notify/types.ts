// Bentuk notifikasi yang dikirim ke browser (API + SSE). Murni tipe, aman di komponen client.
export type NotificationItem = {
  id: string;
  type: "SLA_WARNING" | "SLA_BREACH" | "NEW_REPLY" | "STATUS_CHANGE" | "NEW_TICKET" | "ANNOUNCEMENT";
  title: string;
  message: string;
  /** Path internal atau null (tidak bisa diklik). */
  href: string | null;
  ticketId: string | null;
  isRead: boolean;
  createdAt: string; // ISO
};

export type NotificationPage = { items: NotificationItem[]; unread: number };
