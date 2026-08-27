import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

/**
 * Cloudflare R2 is S3-compatible; we address it through its S3 endpoint
 * (`https://<account-id>.r2.cloudflarestorage.com`) with `region: "auto"`.
 * All credentials come from environment variables — uploads simply report
 * "not configured" when they are missing.
 */
function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

/** Put one object into the configured R2 bucket. */
export async function uploadToR2({
  key,
  body,
  contentType,
}: {
  key: string;
  body: Uint8Array;
  contentType: string;
}): Promise<void> {
  const config = getR2Config();
  if (!config) {
    throw new Error(
      "Cloudflare R2 is not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)"
    );
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/** Public URL for an uploaded object, based on the R2_PUBLIC_URL base. */
export function r2PublicUrl(key: string): string {
  const base = (process.env.R2_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) {
    throw new Error("R2_PUBLIC_URL is not configured");
  }
  return `${base}/${key}`;
}
