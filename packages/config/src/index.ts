import { z } from "zod";

/**
 * Validated environment. Import `loadConfig()` at process start; it throws a
 * clear error listing every missing/invalid variable so the app refuses to boot
 * with bad configuration rather than failing mysteriously later.
 */
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.string().url(),
  PUBLIC_URL: z.string().url(),

  DATABASE_URL: z.string().min(1),
  DATABASE_ADMIN_URL: z.string().min(1),

  REDIS_URL: z.string().min(1).optional(),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET_DOCUMENTS: z.string().min(1),
  S3_BUCKET_CERTIFICATES: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .string()
    .transform((v) => v === "true")
    .default("true"),

  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),

  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

export type AppConfig = z.infer<typeof schema>;

let cached: AppConfig | undefined;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached) return cached;
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper: forget the cached config. */
export function resetConfigCache(): void {
  cached = undefined;
}
