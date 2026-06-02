import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().default(3000),
  DB_DRIVER: z.enum(['sqlite', 'mysql', 'postgresql', 'mongodb']).default('sqlite'),
  DATABASE_URL: z.string().optional(),
  MONGODB_URI: z.string().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  CORS_ORIGIN: z.string().default('*'),
  SCHEDULER_ENABLED: z.boolean().default(true),
})

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

if (['sqlite', 'mysql', 'postgresql'].includes(env.DB_DRIVER) && !env.DATABASE_URL) {
  console.error(`❌  DATABASE_URL is required when DB_DRIVER=${env.DB_DRIVER}`)
  process.exit(1)
}

if (env.DB_DRIVER === 'mongodb' && !env.MONGODB_URI) {
  console.error('❌  MONGODB_URI is required when DB_DRIVER=mongodb')
  process.exit(1)
}

export default env
