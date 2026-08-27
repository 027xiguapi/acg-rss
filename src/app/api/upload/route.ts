import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isR2Configured, r2PublicUrl, uploadToR2 } from "@/lib/r2";
import { getAdminUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** Maximum accepted image size: 10 MB. */
const MAX_BYTES = 10 * 1024 * 1024;

/** Accepted image content types mapped to their file extension. */
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/**
 * Admin-only image upload: stores the file in Cloudflare R2 and returns its
 * public URL, which the client then writes into a `coverUrl` field.
 */
export async function POST(request: Request): Promise<Response> {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isR2Configured()) {
    return NextResponse.json({ error: "notConfigured" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "tooLarge" }, { status: 413 });
  }

  const extension = IMAGE_EXTENSIONS[file.type];
  if (!extension) {
    return NextResponse.json({ error: "unsupported" }, { status: 415 });
  }

  const key = `covers/bangumi/${randomUUID()}.${extension}`;
  const body = new Uint8Array(await file.arrayBuffer());

  try {
    await uploadToR2({ key, body, contentType: file.type });
  } catch (err) {
    console.error("[upload] R2 upload failed:", err);
    return NextResponse.json({ error: "uploadFailed" }, { status: 500 });
  }

  return NextResponse.json({ url: r2PublicUrl(key) });
}
