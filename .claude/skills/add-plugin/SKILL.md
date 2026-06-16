# Skill: Add a Core Plugin

**Description**: Create a new Fastify plugin, decorate the fastify instance, and register it in app.ts.

**Source tutorial**: [tutorial/11-menambah-fungsi-plugin.md](../../../tutorial/11-menambah-fungsi-plugin.md)

## Overview: What's a Plugin?

Fastify plugins encapsulate functionality and "decorate" the fastify instance with new features accessible app-wide. A plugin is any async function that receives `fastify` as a parameter. Wrap it with `fastify-plugin` (fp) to make decorators global; without fp, they stay encapsulated to that registration scope.

## Basic Pattern

File: `src/core/plugins/my-feature.plugin.ts`

```ts
import { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

async function myFeaturePlugin(fastify: FastifyInstance, options?: any) {
  // Do setup work (e.g., init a client, verify connection)
  console.log('Plugin initialized')
  
  // Decorate fastify with new features
  fastify.decorate('myFeature', {
    doSomething: () => 'Hello from plugin',
  })
}

// Wrap with fp() so decorators are app-wide
export default fp(myFeaturePlugin, { name: 'my-feature' })
```

Register in `src/app.ts`:

```ts
import myFeaturePlugin from './core/plugins/my-feature.plugin.js'

await app.register(myFeaturePlugin)
```

Use in a service or controller:

```ts
export class PostService {
  constructor(private fastify: FastifyInstance) {}
  
  async someMethod() {
    const result = this.fastify.myFeature.doSomething()
  }
}
```

## Example: Email Plugin (Nodemailer)

File: `src/core/plugins/email.plugin.ts`

```ts
import { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import nodemailer from 'nodemailer'

interface EmailOptions {
  host: string
  port: number
  auth: { user: string; pass: string }
}

interface Mailer {
  send(to: string, subject: string, html: string): Promise<any>
}

declare global {
  namespace FastifyInstance {
    mailer: Mailer
  }
}

async function emailPlugin(fastify: FastifyInstance) {
  // Read from env (fastify.config is registered by db.plugin)
  const transporterOptions: EmailOptions = {
    host: fastify.config.SMTP_HOST,
    port: fastify.config.SMTP_PORT,
    auth: {
      user: fastify.config.SMTP_USER,
      pass: fastify.config.SMTP_PASS,
    },
  }

  // Initialize transporter
  const transporter = nodemailer.createTransport(transporterOptions)

  // Verify connection at startup
  try {
    await transporter.verify()
    fastify.log.info('Email transporter verified')
  } catch (error) {
    fastify.log.error('Email transporter verification failed:', error)
    throw error
  }

  // Decorate fastify with mailer
  fastify.decorate('mailer', {
    send: async (to: string, subject: string, html: string) => {
      return await transporter.sendMail({ to, subject, html })
    },
  })

  // Cleanup on server close
  fastify.addHook('onClose', async () => {
    transporter.close()
  })
}

export default fp(emailPlugin, { name: 'email' })
```

Register in `src/app.ts`:

```ts
import emailPlugin from './core/plugins/email.plugin.js'

// Register AFTER env is available (after db.plugin)
await app.register(dbPlugin)
await app.register(emailPlugin)
```

Use in a service:

```ts
export class UserService {
  constructor(
    private repository: IUserRepository,
    private fastify: FastifyInstance
  ) {}

  async registerUser(data: RegisterInput): Promise<UserEntity> {
    const user = await this.repository.create(data)

    // Send welcome email
    await this.fastify.mailer.send(
      user.email,
      'Welcome!',
      `<h1>Hi ${user.username}</h1>`
    )

    return user
  }
}
```

## Example: Redis Cache Plugin

File: `src/core/plugins/cache.plugin.ts`

```ts
import { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import Redis from 'ioredis'

interface Cache {
  get<T = any>(key: string): Promise<T | null>
  set<T = any>(key: string, value: T, ttlSeconds?: number): Promise<void>
  del(key: string): Promise<void>
}

async function cachePlugin(fastify: FastifyInstance) {
  const redis = new Redis({
    host: 'localhost',
    port: 6379,
    // or: new Redis('redis://:password@localhost:6379')
  })

  // Connection events
  redis.on('connect', () => fastify.log.info('Redis connected'))
  redis.on('error', err => fastify.log.error('Redis error:', err))

  // Decorate fastify
  fastify.decorate('cache', {
    async get<T = any>(key: string): Promise<T | null> {
      const cached = await redis.get(key)
      return cached ? JSON.parse(cached) : null
    },
    async set<T = any>(key: string, value: T, ttlSeconds: number = 3600) {
      await redis.setex(key, ttlSeconds, JSON.stringify(value))
    },
    async del(key: string) {
      await redis.del(key)
    },
  } as Cache)

  // Cleanup on server close
  fastify.addHook('onClose', async () => {
    await redis.quit()
  })
}

export default fp(cachePlugin, { name: 'cache' })
```

Register in `src/app.ts`:

```ts
await app.register(cachePlugin)
```

Use in a service:

```ts
async listPosts(limit: number, offset: number): Promise<PostEntity[]> {
  const cacheKey = `posts:list:${limit}:${offset}`
  
  // Check cache first
  const cached = await this.fastify.cache.get<PostEntity[]>(cacheKey)
  if (cached) return cached
  
  // Fetch from DB
  const posts = await this.repository.findAll({ limit, offset })
  
  // Store in cache for 1 hour
  await this.fastify.cache.set(cacheKey, posts, 3600)
  
  return posts
}
```

## Type Safety: Augment FastifyInstance

For type checking, extend the FastifyInstance interface:

```ts
declare module 'fastify' {
  interface FastifyInstance {
    mailer: Mailer
    cache: Cache
  }
}
```

Add this declaration inside the plugin file, then TypeScript will recognize `fastify.mailer` and `fastify.cache` without errors.

## Plugin Registration Order

Order matters! Register plugins in dependency order:

```ts
// src/app.ts
await app.register(swaggerPlugin)       // no deps
await app.register(helmetPlugin)
await app.register(corsPlugin)
await app.register(rateLimitPlugin)
await app.register(dbPlugin)            // needed by: jwt, email, cache
await app.register(jwtPlugin)           // needed by: auth-guard
await app.register(authGuardPlugin)
await app.register(emailPlugin)         // depends on: db (for fastify.config)
await app.register(cachePlugin)         // depends on: db (optional)
await app.register(schedulePlugin)      // optional
```

## fp() vs No fp()

| Use `fp()` | No `fp()` |
|---|---|
| Global decorators (app-wide) | Local decorators (scoped) |
| Core plugins | Route-level feature plugins |
| Examples: `db`, `jwt`, `email`, `cache` | Examples: feature-specific encapsulation |

For core plugins, always use `fp()`.

## Testing a Plugin

1. Add a simple decorator: `fastify.decorate('test', () => 'works')`
2. Restart server: `yarn dev`
3. Use it: `this.fastify.test()` (should return `'works'`)
4. Check server logs for any errors during initialization
5. Run `yarn lint` and `yarn format`

For complete details, see the source tutorial.
