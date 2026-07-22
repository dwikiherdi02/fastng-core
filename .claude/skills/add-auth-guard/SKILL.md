# Skill: Add Authentication & Authorization Guards

**Description**: Add JWT authentication to routes and/or implement role-based authorization (RBAC) checks.

**Source tutorials**: [tutorial/04-menambah-protected-route.md](../../../tutorial/04-menambah-protected-route.md) and [tutorial/05-menambah-role-authorization.md](../../../tutorial/05-menambah-role-authorization.md)

## Task: Require Login on a Route

### Option 1: Per-Route (Most Common)

```ts
// src/modules/posts/routes/post.routes.ts
export default async function postRoutes(fastify, controller) {
  const auth = { preHandler: [fastify.authenticate] }
  
  // Public route (no auth required)
  fastify.get('/', (request, reply) => controller.listPosts(request, reply))
  
  // Protected route (login required)
  fastify.post('/', auth, (request, reply) => controller.createPost(request, reply))
  fastify.patch('/:id', auth, (request, reply) => controller.updatePost(request, reply))
  fastify.delete('/:id', auth, (request, reply) => controller.deletePost(request, reply))
}
```

The `auth` object with `preHandler: [fastify.authenticate]` is spread into the route options (before the handler function). The `fastify.authenticate` middleware verifies the JWT and populates `request.user` if valid.

### Option 2: Multiple Guards

Combine authentication with role checks:

```ts
const adminAuth = { preHandler: [fastify.authenticate, fastify.requireAdmin] }
fastify.delete('/:id', adminAuth, handler)
```

### Option 3: Whole-Block Protection

Wrap routes in a scope with a global hook:

```ts
await fastify.register(async (instance) => {
  instance.addHook('preHandler', instance.authenticate)  // All routes protected
  
  fastify.patch('/profile', (request, reply) => controller.updateProfile(request, reply))
  fastify.delete('/account', (request, reply) => controller.deleteAccount(request, reply))
})
```

## Task: Check User Role (RBAC)

### Option 1: Inline Check in Controller

```ts
export class PostController {
  async deletePost(request: FastifyRequest, reply: FastifyReply) {
    if (request.user.role !== 'admin') {
      throw new ForbiddenError('Only admins can delete posts')
    }
    
    await this.service.deletePost(request.params.id)
    reply.send(successResponse({}))
  }
}
```

Simple, direct, but not reusable.

### Option 2: Reusable Role-Check Decorator (Better)

**Create a plugin** (`src/core/plugins/auth-guard.plugin.ts`):

```ts
import { FastifyInstance, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { ForbiddenError } from '../utils/errors.js'

async function authGuardPlugin(fastify: FastifyInstance) {
  // Decorator: check for admin role
  fastify.decorate('requireAdmin', async function (request: FastifyRequest) {
    if (request.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required')
    }
  })

  // Optional: role-specific factory
  fastify.decorate('requireRole', (role: string) => {
    return async function (request: FastifyRequest) {
      if (request.user?.role !== role) {
        throw new ForbiddenError(`${role} access required`)
      }
    }
  })
}

export default fp(authGuardPlugin, { name: 'auth-guard' })
```

**Register in `src/app.ts`** (after JWT plugin):

```ts
import authGuardPlugin from './core/plugins/auth-guard.plugin.js'

await app.register(jwtPlugin)
await app.register(authGuardPlugin)  // ← must be after JWT
```

**Use in routes**:

```ts
const adminOnly = { preHandler: [fastify.authenticate, fastify.requireAdmin] }
fastify.delete('/:id', adminOnly, (request, reply) => controller.deletePost(request, reply))
```

## Task: Create an Admin User for Local Testing

### Option A: Prisma Studio GUI

```bash
bun run db:studio
```

Opens a browser GUI. Navigate to the `User` table, find or create a user, and manually set the `role` field to `'admin'`.

### Option B: Seed Script

Create `src/prisma/seed.ts`:

```ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10)

  const user = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: { role: 'admin' },
    create: {
      email: 'admin@test.com',
      password: hashedPassword,
      username: 'admin',
      role: 'admin',
    },
  })

  console.log('✅ Admin user created/updated:', user)
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

## Task: Add Custom Roles Beyond Admin/User

### Step 1: Update Database Schema

For Prisma (SQL):

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

Run: `bun run migrate`

For MongoDB, update your Mongoose schema with an enum:

```ts
const userSchema = new Schema({
  role: { type: String, enum: ['user', 'admin', 'moderator'], default: 'user' }
})
```

### Step 2: Add Role-Check Decorators

```ts
async function authGuardPlugin(fastify: FastifyInstance) {
  fastify.decorate('requireModerator', async function (request: FastifyRequest) {
    const isMod = ['admin', 'moderator'].includes(request.user?.role)
    if (!isMod) throw new ForbiddenError('Moderator access required')
  })
}
```

### Step 3: Use in Routes

```ts
const modOnly = { preHandler: [fastify.authenticate, fastify.requireModerator] }
fastify.patch('/moderate/:id', modOnly, handler)
```

## Accessing Authenticated User Data

After `fastify.authenticate` runs, `request.user` is populated (from JWT payload):

```ts
export class PostController {
  async createPost(request: FastifyRequest, reply: FastifyReply) {
    const { id, email, role } = request.user  // From JWT
    
    const post = await this.service.createPost(id, request.body)
    reply.code(201).send(successResponse(toPostResponse(post)))
  }
}
```

**JWT payload shape** (from auth service):
- `id`: user ID
- `email`: user email
- `role`: `'user'` | `'admin'` (or custom roles)
- `iat`: issued at (timestamp)
- `exp`: expires at (timestamp)

## Add Swagger Security Annotation

For protected routes, add a security annotation so Swagger UI shows a lock icon:

```ts
fastify.post(
  '/',
  {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Posts'],
      security: [{ BearerAuth: [] }],  // ← lock icon in Swagger
      body: CreatePostRouteSchema.body,
      response: CreatePostRouteSchema.response,
    },
  },
  (request, reply) => controller.createPost(request, reply)
)
```

## Testing

1. Get a token: `POST http://localhost:3000/api/v1/auth/login` → copy `accessToken`
2. Use Swagger UI: click "Authorize" button, paste token
3. Or use curl: `curl -H "Authorization: Bearer {token}" http://localhost:3000/api/v1/posts`
4. Unauthenticated request → `401 Unauthorized`
5. Insufficient role → `403 Forbidden`

For complete details and more examples, see the source tutorials.
