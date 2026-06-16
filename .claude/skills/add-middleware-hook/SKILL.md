# Skill: Add Middleware & Hooks

**Description**: Add global Fastify lifecycle hooks, extend the error handler, or create module-level middleware.

**Source tutorial**: [tutorial/10-menambah-fungsi-middleware.md](../../../tutorial/10-menambah-fungsi-middleware.md)

## Task: Extend the Global Error Handler

File: `src/core/middlewares/error-handler.ts`

The error handler processes every error in order. Insert new conditions **before** the generic `AppError` check:

```ts
fastify.setErrorHandler((error, request, reply) => {
  // 1. JWT/auth errors
  if (error.statusCode === 401) {
    return reply.code(401).send({ success: false, message: 'Unauthorized' })
  }

  // 2. Custom error types (add NEW conditions here, before the generic AppError branch)
  if (error instanceof UnprocessableError && error.errors) {
    return reply.code(422).send({
      success: false,
      message: error.message,
      errors: error.errors,
    })
  }

  // 3. Generic AppError handling
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({
      success: false,
      message: error.message,
    })
  }

  // 4. Fastify validation errors
  if (error.validation) {
    return reply.code(422).send({
      success: false,
      message: 'Validation failed',
      errors: error.validation,
    })
  }

  // 5. Unexpected errors
  request.log.error(error)
  return reply.code(500).send({
    success: false,
    message: 'Internal server error',
  })
})
```

## Task: Add Global Hooks

Add Fastify lifecycle hooks to `src/app.ts` for app-wide functionality.

### Example 1: Request Tracing

Add a unique request ID to every request:

File: `src/core/middlewares/request-id.ts`

```ts
import { FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'crypto'

export async function requestIdMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const requestId = request.headers['x-request-id'] || randomUUID()
  request.id = requestId
  reply.header('X-Request-Id', requestId)
  request.log.info(`[${requestId}] ${request.method} ${request.url}`)
}
```

Register in `src/app.ts`:

```ts
import { requestIdMiddleware } from './core/middlewares/request-id.js'

await app.register(...)  // plugins
fastify.addHook('onRequest', requestIdMiddleware)  // ← after plugins
```

### Example 2: Response Time Header

```ts
fastify.addHook('onRequest', async (request, reply) => {
  request.startTime = Date.now()
})

fastify.addHook('onSend', async (request, reply, payload) => {
  const elapsed = Date.now() - request.startTime
  reply.header('X-Response-Time', `${elapsed}ms`)
  return payload  // ← MUST return payload from onSend
})
```

### Example 3: Request Logging

```ts
fastify.addHook('onResponse', async (request, reply) => {
  request.log.info({
    method: request.method,
    url: request.url,
    statusCode: reply.statusCode,
    responseTime: reply.elapsedTime,
  })
})
```

## Hook Types Reference

| Hook | When | Can Modify? | Can Abort? | Use Case |
|---|---|---|---|---|
| `onRequest` | Earliest, before parsing | Not request body yet | Yes (via `reply.send()`) | Request IDs, audit logging |
| `preParsing` | Before body parse | Can modify raw stream | Yes | Custom decompression |
| `preValidation` | Before schema validation | Can modify parsed body | Yes | Body transform |
| `preHandler` | Before route handler | ✅ Can access `request.body` | Yes (throw error) | **Auth, authorization** |
| `preSerialization` | Before serialization | Can transform payload | No (for reading only) | Payload transform |
| `onSend` | Before sending response | ✅ **Must return payload** | Yes | Extra headers, logging, payload transform |
| `onResponse` | After response sent | No (read-only) | No | Analytics, cleanup |
| `onError` | On any error | Via reply | Yes | Pre-process error |

**Key points:**
- `onRequest` through `preHandler` can short-circuit via `reply.send()` or throw.
- `onSend` **must** return a payload (even unmodified).
- `onResponse` runs after send, can't modify response.

## Task: Add Module-Level Hooks

Apply a hook **only to a specific module's routes** via Fastify encapsulation:

File: `src/modules/posts/module.ts`

```ts
export default async function postsModule(fastify: FastifyInstance): Promise<void> {
  const repository = createPostRepository(fastify.db)
  const service = new PostService(repository, fastify)
  const controller = new PostController(service)

  await fastify.register(
    async (instance) => {
      // ✅ Module-level hook: applies ONLY to post routes
      instance.addHook('onRequest', async (request, reply) => {
        request.log.info(`[Posts] ${request.method} ${request.url}`)
      })

      await postRoutes(instance, controller)
    },
    { prefix: '/api/v1/posts' }
  )
}
```

This hook only runs for requests to `/api/v1/posts/*` — it doesn't affect other modules' routes.

## Hook Execution Order

```
onRequest → preParsing → preValidation → preHandler → [Route Handler] → preSerialization → onSend → [Response Sent] → onResponse
     ↓
  (if error, skip to onError/errorHandler)
```

## Common Patterns

### Pattern: Audit Logging

```ts
fastify.addHook('onResponse', async (request, reply) => {
  if (request.user) {
    request.log.info({
      userId: request.user.id,
      action: `${request.method} ${request.url}`,
      statusCode: reply.statusCode,
      timestamp: new Date().toISOString(),
    })
  }
})
```

### Pattern: Conditional Authorization

```ts
// ✅ Better: use preHandler + throw error
fastify.addHook('preHandler', async (request, reply) => {
  if (request.url === '/api/v1/admin/stats' && request.user?.role !== 'admin') {
    throw new ForbiddenError('Admin access required')
  }
})

// ❌ Wrong: use onRequest + reply.send (doesn't go through error handler)
fastify.addHook('onRequest', async (request, reply) => {
  if (...) reply.code(403).send(...)
})
```

Use `preHandler` for authorization because errors from earlier hooks don't go through the global error handler.

## Testing

1. Add a hook that logs something: `fastify.log.info('Hook executed')`
2. Restart server: `yarn dev`
3. Make a request: `curl http://localhost:3000/api/v1/posts`
4. Check logs for your hook's message
5. Run `yarn format` to clean up code

For complete details, see the source tutorial.
