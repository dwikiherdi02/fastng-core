# Skill: Add Custom Error Type

**Description**: Create a new typed error class (AppError subclass), pick an appropriate HTTP status code, and wire it into the global error handler if it carries extra fields.

**Source tutorial**: [tutorial/07-menambah-custom-error.md](../../../tutorial/07-menambah-custom-error.md)

## Step 1: Add Error Class to errors.ts

File: `src/core/utils/errors.ts`

```ts
// Existing errors...
export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404)
  }
}

// ✅ Add new error type
export class QuotaExceededError extends AppError {
  constructor(message = 'Quota exceeded') {
    super(message, 429)  // HTTP 429 Too Many Requests
  }
}

export class GoneError extends AppError {
  constructor(message = 'Resource gone') {
    super(message, 410)  // HTTP 410 Gone
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable') {
    super(message, 503)
  }
}
```

**HTTP Status Code Reference:**
- `400` — Bad Request (malformed request)
- `401` — Unauthorized (invalid/missing token)
- `403` — Forbidden (insufficient permission)
- `404` — Not Found (resource doesn't exist)
- `409` — Conflict (duplicate/constraint violation)
- `410` — Gone (resource permanently deleted)
- `422` — Unprocessable Entity (validation failed)
- `429` — Too Many Requests (rate limit exceeded, quota exceeded)
- `503` — Service Unavailable

## Step 2: Throw It from a Service

```ts
// src/modules/posts/services/post.service.ts
import { QuotaExceededError } from '../../core/utils/errors.js'

export class PostService {
  async createPost(authorId: string, data: CreatePostInput): Promise<PostEntity> {
    // Check business rule
    const postCount = await this.repository.countByAuthor(authorId)
    if (postCount >= MAX_POSTS_PER_DAY) {
      throw new QuotaExceededError('You have reached the maximum posts for today')
    }
    
    return await this.repository.create({ ...data, authorId })
  }
}
```

## Step 3: Error Handler Auto-Detects (Simple Case)

The global error handler in `src/core/middlewares/error-handler.ts` already handles all `AppError` subclasses:

```ts
fastify.setErrorHandler((error, request, reply) => {
  // AppError subclasses are detected here
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({
      success: false,
      message: error.message,
    })
  }
  
  // Unknown error
  return reply.code(500).send({ success: false, message: 'Internal server error' })
})
```

**No additional handler changes are needed** unless your error carries extra structured data (see Step 4).

## Step 4: Errors with Extra Fields (Advanced)

If your error needs to carry more than just a `message`, define the extra fields and update the error handler.

**Example: validation error with a list of field errors**

```ts
// src/core/utils/errors.ts
export class UnprocessableError extends AppError {
  errors: Array<{ field: string; message: string }>

  constructor(message = 'Unprocessable entity', errors = []) {
    super(message, 422)
    this.errors = errors
  }
}
```

**Update the global error handler** to handle this special case (place the check BEFORE the generic `AppError` check):

```ts
// src/core/middlewares/error-handler.ts
fastify.setErrorHandler((error, request, reply) => {
  // Handle custom errors with extra fields FIRST
  if (error instanceof UnprocessableError && error.errors.length > 0) {
    return reply.code(422).send({
      success: false,
      message: error.message,
      errors: error.errors,  // ← include the extra field
    })
  }

  // Generic AppError handling
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({
      success: false,
      message: error.message,
    })
  }

  // Unknown error
  return reply.code(500).send({ success: false, message: 'Internal server error' })
})
```

**Usage:**

```ts
throw new UnprocessableError('Validation failed', [
  { field: 'email', message: 'Invalid email format' },
  { field: 'age', message: 'Must be 18 or older' },
])
```

**Response:**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email format" },
    { "field": "age", "message": "Must be 18 or older" }
  ]
}
```

## Testing

1. Trigger the condition that throws your error (e.g., create 11 posts in a day if limit is 10)
2. Verify the HTTP status code matches your `statusCode` (e.g., 429)
3. Verify the response body has `{ success: false, message: '...' }`
4. Check server logs (if you added logging in the error handler)

Example with curl:

```bash
curl -X POST http://localhost:3000/api/v1/posts \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"title":"Post 11","content":"..."}'

# Response (after hitting quota):
# HTTP/1.1 429 Too Many Requests
# {"success":false,"message":"You have reached the maximum posts for today"}
```

For complete details and more examples, see the source tutorial.
