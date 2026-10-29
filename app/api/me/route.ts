import { authorizeApi } from "@/lib/auth/guards";

// Contoh pemakaian guard API (semua role login boleh). Endpoint yang dibatasi role
// tinggal memanggil authorizeApi("ADMIN") dst. sebagai baris pertama handler.
export async function GET() {
  const guard = await authorizeApi();
  if (!guard.ok) return guard.response;
  return Response.json({ user: guard.user });
}
