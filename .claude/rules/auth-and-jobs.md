# Authentication, Authorization, and Scheduled Jobs

## JWT Authentication Flow (Reference)

FastNG uses a dual-token system: short-lived access tokens and long-lived refresh tokens stored in the database.

| | Access Token | Refresh Token |
|---|---|---|
| Lifespan | 15 minutes (configurable: `JWT_ACCESS_EXPIRES`) | 7 days (configurable: `JWT_REFRESH_EXPIRES`) |
| Stored in DB | No | Yes (in `RefreshToken` table/collection) |
| Used for | Every authenticated request | Obtaining a new access token |
| Revoked on logout | Auto-expires | Deleted from DB immediately |

**Full flow:**
1. `POST /api/v1/auth/login` → validate credentials → generate access + refresh tokens → store refresh token in DB.
2. `GET /api/v1/users/me` with `Authorization: Bearer {accessToken}` → `fastify.authenticate` verifies JWT → `request.user` populated.
3. `POST /api/v1/auth/refresh` with `{ refreshToken }` → verify JWT signature → check DB record exists → delete old token (rotation) → issue new token pair.
4. `DELETE /api/v1/auth/logout` with `{ refreshToken }` → delete from DB; access token expires naturally.

**Key security points:**
- `JWT_SECRET` must be ≥32 random characters.
- Access token TTL should be short (15 minutes).
- Refresh token rotation on every refresh (prevents stolen token abuse beyond one use).
- For MongoDB, TTL index on `RefreshToken` model auto-deletes expired records; for Prisma, implement periodic cleanup job.

For complete JWT mechanics, see `tutorial/03-cara-kerja-jwt-refresh-token.md` (Indonesian).

## Protected Routes

To require login on a route, add `fastify.authenticate` as a `preHandler`:

### Pattern 1: Per-Route (Recommended)

```ts
// src/modules/posts/routes/post.routes.ts
export default async function postRoutes(fastify, controller) {
  const auth = { preHandler: [fastify.authenticate] }
  
  // Public routes
  fastify.get('/', (request, reply) => controller.listPosts(request, reply))
  fastify.get('/:id', (request, reply) => controller.getPost(request, reply))
  
  // Protected routes
  fastify.post('/', auth, (request, reply) => controller.createPost(request, reply))
  fastify.patch('/:id', auth, (request, reply) => controller.updatePost(request, reply))
  fastify.delete('/:id', auth, (request, reply) => controller.deletePost(request, reply))
}
```

### Pattern 2: Multiple Guards

```ts
const authGuards = { preHandler: [fastify.authenticate, fastify.requireAdmin] }
fastify.delete('/:id', authGuards, (request, reply) => controller.deletePost(request, reply))
```

### Pattern 3: Whole-Block Protection

Wrap a `fastify.register()` call with a hook for blanket protection:

```ts
await fastify.register(async (instance) => {
  instance.addHook('preHandler', instance.authenticate)  // All routes in this block require auth
  
  fastify.get('/profile', (request, reply) => controller.getProfile(request, reply))
  fastify.patch('/profile', (request, reply) => controller.updateProfile(request, reply))
})
```

## Accessing Authenticated User

After `fastify.authenticate` runs, `request.user` contains the JWT payload (defined in `src/types/fastify.d.ts`):

```ts
export class PostController {
  async createPost(request: FastifyRequest, reply: FastifyReply) {
    const { id, email, role } = request.user  // ← authenticated user from JWT
    const post = await this.service.createPost(id, request.body)
    reply.code(201).send(successResponse(toPostResponse(post)))
  }
}
```

**JWT payload shape** (from auth service):
```ts
{
  id: string,        // user ID
  email: string,
  role: 'user' | 'admin',  // or custom roles
  iat: number,       // issued at (timestamp)
  exp: number        // expires at (timestamp)
}
```

## Role-Based Authorization (RBAC)

FastNG has two default roles: `user` (default) and `admin`. Roles are stored in the `User` table and encoded into the JWT at login.

### Approach 1: Inline Check in Controller

```ts
async deletePost(request: FastifyRequest, reply: FastifyReply) {
  const parsed = DeletePostSchema.safeParse(request.params)
  if (!parsed.success) throw new ValidationError('Invalid params')
  
  // ✅ Role check in controller
  if (request.user.role !== 'admin') {
    throw new ForbiddenError('Only admins can delete posts')
  }
  
  await this.service.deletePost(parsed.data.id)
  reply.send(successResponse({}))
}
```

### Approach 2: Reusable Middleware Decorator (Cleaner)

Create a plugin in `src/core/plugins/auth-guard.plugin.ts`:

```ts
import fp from 'fastify-plugin'

async function authGuardPlugin(fastify) {
  // Decorator: reusable preHandler for admin-only routes
  fastify.decorate('requireAdmin', async function (request) {
    if (request.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required')
    }
  })
  
  // Optional: role-specific decorator factory
  fastify.decorate('requireRole', (role: string) => {
    return async function (request) {
      if (request.user?.role !== role) {
        throw new ForbiddenError(`${role} access required`)
      }
    }
  })
}

export default fp(authGuardPlugin, { name: 'auth-guard' })
```

Register in `src/app.ts` after `jwt.plugin`:

```ts
await app.register(jwtPlugin)
await app.register(authGuardPlugin)  // ← after JWT
```

Then use in routes:

```ts
const adminOnly = { preHandler: [fastify.authenticate, fastify.requireAdmin] }
fastify.delete('/:id', adminOnly, (request, reply) => controller.deletePost(request, reply))
```

### Creating an Admin User (Local Testing)

**Option A: Prisma Studio (GUI)**

```bash
yarn db:studio
# Opens browser GUI, navigate to User table, edit role field to 'admin'
```

**Option B: Seed Script**

Create `src/prisma/seed.ts`:

```ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('password', 10)
  
  const user = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: { role: 'admin' },
    create: {
      email: 'admin@test.com',
      password: hashedPassword,
      role: 'admin',
    },
  })
  
  console.log('Admin user created/updated:', user)
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
```

Run: `node --env-file=.env --import tsx/esm src/prisma/seed.ts`

### Adding Custom Roles

**Step 1:** Update Prisma schema (for SQL databases):

```prisma
enum Role {
  user
  admin
  moderator
}

model User {
  id    String  @id @default(cuid())
  role  Role    @default(user)
  ...
}
```

Run: `yarn db:generate && yarn db:migrate`

**Step 2:** Add role-check decorators:

```ts
fastify.decorate('requireModerator', async function (request) {
  const isMod = ['admin', 'moderator'].includes(request.user?.role)
  if (!isMod) throw new ForbiddenError('Moderator access required')
})
```

For complete details, tutorials, and code examples, see `tutorial/04-menambah-protected-route.md` (protected routes) and `tutorial/05-menambah-role-authorization.md` (RBAC).

---

## Scheduled Jobs

FastNG uses `@fastify/schedule` (backed by `toad-scheduler`) to run periodic tasks. Jobs can be interval-based (every N hours) or cron-scheduled (at specific times).

### Job File Location & Structure

Jobs live in `src/modules/{name}/jobs/{action}.job.ts`:

```ts
// src/modules/auth/jobs/cleanup.job.ts
import { AsyncTask, SimpleIntervalJob } from 'toad-scheduler'
import { FastifyInstance } from 'fastify'

export function createCleanupJob(fastify: FastifyInstance) {
  const task = new AsyncTask(
    'cleanup-expired-tokens',  // unique id
    async () => {
      // Job logic: clean up expired refresh tokens
      if (fastify.config.DB_DRIVER === 'mongodb') {
        // Mongoose auto-deletes via TTL index; nothing to do
        fastify.log.info('Expired tokens auto-cleaned by MongoDB TTL')
      } else {
        // Prisma: manually delete
        const result = await fastify.db.refreshToken.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        })
        fastify.log.info(`Cleaned ${result.count} expired tokens`)
      }
    },
    (error) => {
      // Error handler (required best practice)
      fastify.log.error(`Cleanup job failed: ${error.message}`)
    }
  )

  return new SimpleIntervalJob(
    { hours: 1 },  // run every hour
    task,
    { id: 'cleanup-expired-tokens' }
  )
}
```

### Job Types

| Type | Constructor | Use Case |
|---|---|---|
| `SimpleIntervalJob` | `{ seconds \| minutes \| hours \| days }, task, opts` | Recurring interval (e.g., every 2 hours) |
| `CronJob` | `'cron expression', task, opts` | Specific time patterns (e.g., daily at midnight) |

### Cron Expression Format

`seconds minutes hours day-of-month month day-of-week` (all in UTC)

| Expression | Meaning |
|---|---|
| `0 0 * * *` | Daily at midnight |
| `0 * * * *` | Every hour on the hour |
| `0 6 * * 1-5` | Weekdays (Mon-Fri) at 6 AM |
| `*/15 * * * *` | Every 15 minutes |
| `0 0 1 * *` | First day of month at midnight |

### Registering a Job in a Module

Inside `src/modules/{name}/module.ts`, register the job within the `fastify.register()` callback:

```ts
import { createCleanupJob } from './jobs/cleanup.job.js'

export default async function authModule(fastify: FastifyInstance): Promise<void> {
  const repository = createAuthRepository(fastify.db)
  const service = new AuthService(repository, fastify)
  const controller = new AuthController(service)

  await fastify.register(
    async (instance) => {
      await authRoutes(instance, controller)
      
      // Register scheduled jobs (guarded by scheduler availability)
      if (instance.scheduler) {
        const cleanupJob = createCleanupJob(instance)
        instance.scheduler.addSimpleIntervalJob(cleanupJob)
        instance.log.info('Cleanup job registered')
      }
    },
    { prefix: '/api/v1/auth' }
  )
}
```

**Key points:**
- Always check `if (instance.scheduler)` before registering (scheduler may be disabled via `SCHEDULER_ENABLED` env var).
- Use `instance.scheduler.addSimpleIntervalJob()` for interval jobs.
- Use `instance.scheduler.addCronJob()` for cron jobs.
- **Never** import `@fastify/schedule` directly in a module — only use the `instance.scheduler` decorator added by the plugin.

### Controlling Scheduler

The scheduler plugin respects the `SCHEDULER_ENABLED` env var:

```env
SCHEDULER_ENABLED=true  # Default; jobs run
SCHEDULER_ENABLED=false # Scheduler disabled; jobs registered but don't execute (useful for testing)
```

### Common Job Patterns

**Example 1: Interval Job (Hourly Cleanup)**

Already shown above.

**Example 2: Daily Cron Job (Report Generation)**

```ts
import { AsyncTask, CronJob } from 'toad-scheduler'

export function createDailyReportJob(fastify: FastifyInstance) {
  const task = new AsyncTask(
    'daily-report',
    async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      // Query sales from yesterday, generate report, email it, etc.
      fastify.log.info('Daily report generated and sent')
    },
    (error) => {
      fastify.log.error(`Daily report job failed: ${error.message}`)
    }
  )

  // Run daily at midnight UTC
  return new CronJob(
    { second: 0, minute: 0, hour: 0 },  // or '0 0 * * *'
    task,
    { id: 'daily-report' }
  )
}
```

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Job doesn't run | `SCHEDULER_ENABLED=false` or not registered | Set `SCHEDULER_ENABLED=true`, check server logs for registration message |
| Job runs too often | Interval or cron expression too short | Verify interval/expression, check for duplicate registrations |
| Job errors repeatedly | Unhandled error in task | Add try/catch in task body and log errors properly, ensure error handler is defined |

For complete tutorials and code examples, see `tutorial/16-menambah-scheduled-job.md` (Indonesian).
