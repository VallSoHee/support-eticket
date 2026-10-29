import path from "node:path";

/**
 * Folder penyimpanan lampiran, di luar /public supaya file hanya bisa diakses lewat
 * route /api/uploads/[id] yang mengecek login & kepemilikan. Ubah lewat env UPLOAD_DIR
 * (di produksi arahkan ke volume/disk persisten).
 */
export const uploadDir = () => process.env.UPLOAD_DIR || path.join(process.cwd(), "storage", "uploads");
