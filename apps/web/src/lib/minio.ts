// src/lib/minio.ts
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucketName = process.env.MINIO_BUCKET;

if (!bucketName) {
  console.error(
    "❌ MINIO_BUCKET environment variable is not set. MinIO uploads will fail."
  );
}

export const minioClient = new S3Client({
  region: process.env.MINIO_REGION ?? "us-east-1",
  endpoint: process.env.MINIO_ENDPOINT, // e.g. http://localhost:9000
  forcePathStyle: true, // IMPORTANT for MinIO
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY as string,
    secretAccessKey: process.env.MINIO_SECRET_KEY as string,
  },
});

/**
 * Upload the PDF to MinIO and return a **pre-signed GET URL** that can be used
 * in the browser. We keep the bucket private and let the signature handle auth.
 *
 * NOTE: SigV4 requires `expiresIn < 7 days`, so we clamp the value.
 */
export async function uploadPdfToMinio(
  key: string,
  pdfBuffer: Buffer
): Promise<string> {
  if (!bucketName) {
    throw new Error("MINIO_BUCKET is not configured");
  }

  // 1) Upload the object
  await minioClient.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    })
  );

  // 2) Decide presigned expiry
  //    - MINIO_PRESIGNED_EXPIRES is in *seconds*
  //    - default: 1 day
  //    - hard limit: < 7 days (we'll clamp to 6 days)
  const ONE_DAY = 60 * 60 * 24; // seconds
  const SIX_DAYS = ONE_DAY * 6; // keep well under 7d SigV4 max

  let expiresIn = Number(process.env.MINIO_PRESIGNED_EXPIRES);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    expiresIn = ONE_DAY; // default 1 day
  }
  if (expiresIn >= ONE_DAY * 7) {
    expiresIn = SIX_DAYS; // clamp to 6 days
  }

  // 3) Create pre-signed URL for GET
  const signedUrl = await getSignedUrl(
    minioClient,
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
    {
      expiresIn,
    }
  );

  // We now store this *absolute* pre-signed URL in pdf_url.
  return signedUrl;
}
