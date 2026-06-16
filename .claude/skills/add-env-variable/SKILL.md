# Skill: Add Environment Variable

**Description**: Add a new environment variable with Zod validation and fail-fast startup behavior.

**Source tutorial**: [tutorial/09-menambah-env-variable.md](../../../tutorial/09-menambah-env-variable.md)

## Step 1: Add to `.env` and `.env.example`

File: `.env`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_ENABLED=true
```

File: `.env.example` (template for other developers)

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
EMAIL_ENABLED=false
```

## Step 2: Add Zod Validation

File: `src/core/config/env.config.ts`

Add fields to the Zod schema:

```ts
import { z } from 'zod'

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  HOST: z.string().default('localhost'),
  PORT: z.coerce.number().int().positive().default(3000),
  
  // Database vars (existing)
  DB_DRIVER: z.enum(['sqlite', 'mysql', 'postgresql', 'mongodb']).default('sqlite'),
  DATABASE_URL: z.string().optional(),
  MONGODB_URI: z.string().optional(),
  
  // JWT (existing)
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  
  // Email (NEW)
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().email(),
  SMTP_PASS: z.string().min(1),
  EMAIL_ENABLED: z.string().transform(v => v === 'true').default('false'),
})
  .refine(
    data => data.DB_DRIVER !== 'mongodb' || !!data.MONGODB_URI,
    {
      message: 'MONGODB_URI is required when DB_DRIVER is mongodb',
      path: ['MONGODB_URI'],
    }
  )
  .refine(
    data => data.DB_DRIVER === 'mongodb' || !!data.DATABASE_URL,
    {
      message: 'DATABASE_URL is required for non-MongoDB drivers',
      path: ['DATABASE_URL'],
    }
  )

export type EnvConfig = z.infer<typeof envSchema>

export const env = envSchema.parse(process.env)
```

## Step 3: Consume via `fastify.config`

The env is registered as `fastify.config` by the database plugin:

```ts
// In a service
export class EmailService {
  constructor(private fastify: FastifyInstance) {}
  
  async sendEmail(to: string, subject: string, html: string) {
    if (!this.fastify.config.EMAIL_ENABLED) {
      this.fastify.log.warn('Email disabled, skipping send')
      return
    }
    
    // Send via SMTP
    const transporter = nodemailer.createTransport({
      host: this.fastify.config.SMTP_HOST,
      port: this.fastify.config.SMTP_PORT,
      auth: {
        user: this.fastify.config.SMTP_USER,
        pass: this.fastify.config.SMTP_PASS,
      },
    })
    
    await transporter.sendMail({ to, subject, html })
  }
}
```

**Never** use `process.env.X` directly in application code — always use `fastify.config.X`.

## Zod Type Reference

| Type | Code | Example |
|---|---|---|
| Required string | `z.string()` | `SMTP_HOST` |
| Optional string | `z.string().optional()` | `SECONDARY_DB_URL` |
| String with constraints | `z.string().min(32)` | `JWT_SECRET` |
| Email | `z.string().email()` | `SMTP_USER` |
| URL | `z.string().url()` | `API_BASE_URL` |
| Number | `z.coerce.number()` | `SMTP_PORT` |
| Positive integer | `z.coerce.number().int().positive()` | `PORT` |
| Enum | `z.enum(['development', 'production'])` | `NODE_ENV` |
| Boolean (from string) | `z.string().transform(v => v === 'true')` | `EMAIL_ENABLED` |
| Default value | `.default('...')` | `SMTP_PORT=587` |

## Conditional Validation

Make a variable required only if another variable has a certain value:

```ts
envSchema.refine(
  data => data.DB_DRIVER !== 'mongodb' || !!data.MONGODB_URI,
  {
    message: 'MONGODB_URI is required when DB_DRIVER is mongodb',
    path: ['MONGODB_URI'],
  }
)
```

This ensures `MONGODB_URI` is set when `DB_DRIVER=mongodb`, but allows it to be missing for other drivers.

## Fail-Fast Behavior

If validation fails at startup:

```
❌ Invalid environment variables:
DATABASE_URL: Required
JWT_SECRET: String must contain at least 32 character(s)
```

The process exits with code 1 **before** the server starts. This ensures:
- All vars are available before any request is served
- Clear error messages instead of runtime crashes
- No silent failures or undefined behavior

## Creating a Plugin That Uses Env Vars

Example: email plugin

File: `src/core/plugins/email.plugin.ts`

```ts
import fp from 'fastify-plugin'
import nodemailer from 'nodemailer'
import { FastifyInstance } from 'fastify'

async function emailPlugin(fastify: FastifyInstance) {
  if (!fastify.config.EMAIL_ENABLED) {
    fastify.log.info('Email plugin disabled')
    return
  }

  const transporter = nodemailer.createTransport({
    host: fastify.config.SMTP_HOST,
    port: fastify.config.SMTP_PORT,
    auth: {
      user: fastify.config.SMTP_USER,
      pass: fastify.config.SMTP_PASS,
    },
  })

  // Verify connection
  await transporter.verify()
  fastify.log.info('Email transporter verified')

  // Decorate fastify
  fastify.decorate('mailer', {
    send: async (to: string, subject: string, html: string) => {
      return await transporter.sendMail({ to, subject, html })
    },
  })
}

export default fp(emailPlugin, { name: 'email' })
```

Register in `src/app.ts`:

```ts
await app.register(emailPlugin)
```

## Testing

1. Restart server: `yarn dev`
2. Check logs for validation errors or success messages
3. Verify the var is accessible: `fastify.config.SMTP_HOST`
4. Remove a required var from `.env` and restart — should fail with a clear error message

For complete details, see the source tutorial.
