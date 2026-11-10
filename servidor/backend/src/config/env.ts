import dotenv from "dotenv";
import { z } from "zod";

// Carrega variáveis do arquivo .env caso exista
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z
    .string()
    .default("3000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive().max(65535)),
  OLLAMA_BASE_URL: z
    .string()
    .default("http://localhost:11434")
    .transform((val) => val.trim().replace(/\/$/, "")),
  OLLAMA_TIMEOUT: z
    .string()
    .default("600000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive()),
  OLLAMA_KEEP_ALIVE: z
    .string()
    .default("30m"),
  ALLOWED_ORIGINS: z
    .string()
    .default("*")
    .transform((val) =>
      val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ALLOWED_MODELS: z
    .string()
    .default("")
    .transform((val) =>
      val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  DATABASE_URL: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
  JWT_SECRET: z
    .string()
    .default("ollama_jwt_super_secret_key_change_me_in_prod")
    .transform((val) => val.trim()),
  SUPABASE_URL: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
  SUPABASE_ANON_KEY: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
  REQUIRE_AUTH: z
    .string()
    .default("false")
    .transform((val) => val.toLowerCase() === "true" || val === "1"),
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .default("60000")
    .transform((val) => parseInt(val, 10)),
  RATE_LIMIT_MAX_REQUESTS: z
    .string()
    .default("100")
    .transform((val) => parseInt(val, 10)),
  AI_RATE_LIMIT_WINDOW_MS: z
    .string()
    .default("60000")
    .transform((val) => parseInt(val, 10)),
  AI_RATE_LIMIT_MAX_REQUESTS: z
    .string()
    .default("20")
    .transform((val) => parseInt(val, 10)),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Falha crítica de validação das variáveis de ambiente:");
  console.error(parsed.error.format());
  throw new Error("Configurações de ambiente inválidas. Verifique o arquivo .env.");
}

export const env = parsed.data;
export type EnvConfig = z.infer<typeof envSchema>;

