import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().default(3000),
  DB_DRIVER: z.enum(['sqlite', 'mysql', 'postgresql', 'sqlserver', 'mongodb']).default('sqlite'),
  DATABASE_URL: z.string().optional(),
  MONGODB_URI: z.string().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  CORS_ORIGIN: z.string().default('*'),
  DOC_PROVIDER: z.enum(['scalar', 'swagger']).default('swagger'),
  DOC_PATH: z
    .string()
    .regex(/^\//, 'DOC_PATH must start with a "/"')
    .default('/docs'),
  SCHEDULER_ENABLED: z.boolean().default(true),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@fastng.local'),
  SEED_ADMIN_USERNAME: z.string().default('admin'),
  SEED_ADMIN_PASSWORD: z.string().default('password'),
})

// Drivers backed by Prisma (require a DATABASE_URL). MongoDB uses MONGODB_URI instead.
export const PRISMA_DRIVERS = ['sqlite', 'mysql', 'postgresql', 'sqlserver'] as const

export type Env = z.infer<typeof envSchema>

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌  Invalid environment variables:')
  for (const issue of parsed.error.issues) {
    console.error(`   ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

const env = parsed.data

if ((PRISMA_DRIVERS as readonly string[]).includes(env.DB_DRIVER) && !env.DATABASE_URL) {
  console.error(`❌  DATABASE_URL is required when DB_DRIVER=${env.DB_DRIVER}`)
  process.exit(1)
}

if (env.DB_DRIVER === 'mongodb' && !env.MONGODB_URI) {
  console.error('❌  MONGODB_URI is required when DB_DRIVER=mongodb')
  process.exit(1)
}

export default env
