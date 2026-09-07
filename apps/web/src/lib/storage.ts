import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | undefined;

function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: process.env.S3_REGION ?? "us-east-1",
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? "",
        secretAccessKey: process.env.S3_SECRET_KEY ?? "",
      },
    });
  }
  return client;
}

export const DOCUMENTS_BUCKET =
  process.env.S3_BUCKET_DOCUMENTS ?? "scip-documents";

export async function putObject(
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** Fetch an object's bytes server-side (used to stream private docs through the app). */
export async function getObjectBuffer(
  bucket: string,
  key: string,
): Promise<{ body: Buffer; contentType: string | undefined }> {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return { body: Buffer.from(bytes), contentType: res.ContentType };
}

/** Short-lived signed URL so private documents are never publicly exposed. */
export async function presignGet(
  bucket: string,
  key: string,
  expiresIn = 300,
): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn,
  });
}
