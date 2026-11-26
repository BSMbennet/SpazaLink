import 'server-only';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { sniffFileType } from '@/lib/uploads';
import { optimiseImage } from '@/lib/image-optimise';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET_NAME ?? 'spazalink-media';

function client() {
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 environment variables are not configured');
  }
  return new S3Client({
    region: 'auto',
    endpoint: 'https://' + accountId + '.r2.cloudflarestorage.com',
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * Uploads a file. The file content must match the type the browser claimed (JPEG, PNG, WebP or PDF),
 * so a renamed script or other file cannot be stored as a photo or document.
 */
export async function uploadR2Object(key: string, file: File, options: { optimiseImage?: boolean } = {}): Promise<void> {
  const original = Buffer.from(await file.arrayBuffer());
  const detected = sniffFileType(original);
  if (!detected || detected !== file.type) {
    throw new Error('File content does not match an allowed type');
  }
  // Shop and product photos are shrunk to WebP and stripped of GPS data. Use a key that ends in .webp for these.
  const shrink = options.optimiseImage === true && detected !== 'application/pdf';
  const body = shrink ? await optimiseImage(original) : original;
  const contentType = shrink ? 'image/webp' : detected;
  await client().send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    // PDFs download instead of opening in the reviewer's browser.
    ContentDisposition: contentType === 'application/pdf' ? 'attachment' : 'inline',
    CacheControl: 'private, max-age=3600',
  }));
}

export async function signedR2ObjectUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: Math.max(60, Math.min(expiresIn, 3600)),
  });
}

export async function deleteR2Object(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
