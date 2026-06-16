# Skill: Add DTO and Validation

**Description**: Create a request/response/query DTO with paired Zod schema and Fastify JSON Schema for validation and Swagger documentation.

**Source tutorial**: [tutorial/06-menambah-dto-validasi.md](../../../tutorial/06-menambah-dto-validasi.md)

## Overview: Two Schemas Per DTO

FastNG uses **two validation schemas** in every DTO file:
1. **Zod schema** — controller-side runtime validation, type inference
2. **Fastify JSON Schema** — route-level validation + Swagger docs

Both must be kept in sync manually (one is not auto-derived from the other).

| Schema | Purpose | Used By |
|---|---|---|
| Zod | Controller input parsing, `z.infer` for TS types | `controller.safeParse(request.body)` |
| JSON Schema | Fastify validation, Swagger docs | `route schema` option |

## Request DTO File

File: `src/modules/posts/dto/create-post.request.dto.ts`

```ts
import { z } from 'zod'

// ✅ Zod schema for controller-side parsing + type inference
export const CreatePostSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must be at most 200 characters'),
  content: z.string().min(1, 'Content is required'),
  published: z.boolean().optional().default(false),
})

// ✅ TypeScript type inferred from Zod schema
export type CreatePostRequest = z.infer<typeof CreatePostSchema>

// ✅ Fastify JSON Schema for route-level validation + Swagger
export const CreatePostRouteSchema = {
  body: {
    type: 'object' as const,
    required: ['title', 'content'],
    properties: {
      title: {
        type: 'string',
        minLength: 3,
        maxLength: 200,
        description: 'Post title',
      },
      content: {
        type: 'string',
        description: 'Post content',
      },
      published: {
        type: 'boolean',
        default: false,
        description: 'Whether the post is published',
      },
    },
    additionalProperties: false,
  },
  response: {
    201: {
      description: 'Post created successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            content: { type: 'string' },
            authorId: { type: 'string' },
            createdAt: { type: 'string' },
          },
        },
      },
    },
  },
}
```

### In the Controller

```ts
async createPost(request: FastifyRequest, reply: FastifyReply) {
  // Parse with Zod
  const parsed = CreatePostSchema.safeParse(request.body)
  
  // Throw ValidationError if invalid
  if (!parsed.success) {
    throw new ValidationError('Invalid post data')
  }
  
  // Use the parsed data
  const post = await this.service.createPost(request.user.id, parsed.data)
  reply.code(201).send(successResponse(toPostResponse(post)))
}
```

### In the Route

```ts
fastify.post(
  '/',
  {
    preHandler: [fastify.authenticate],
    schema: CreatePostRouteSchema,  // ← JSON Schema for validation + Swagger
  },
  (request, reply) => controller.createPost(request, reply)
)
```

## Response DTO File

File: `src/modules/posts/dto/post.response.dto.ts`

```ts
import { PostEntity } from '../entities/post.entity.js'

// ✅ Mapper function: entity → response shape
export function toPostResponse(entity: PostEntity) {
  return {
    id: entity.id,
    title: entity.title,
    content: entity.content,
    author: {
      id: entity.authorId,
      name: entity.authorName,  // if hydrated by service
    },
    createdAt: entity.createdAt.toISOString(),
    // ✅ never include sensitive fields like password
  }
}

// ✅ JSON Schema for response (used in Swagger)
export const PostResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    content: { type: 'string' },
    author: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
      },
    },
    createdAt: { type: 'string' },
  },
}
```

### In the Controller

```ts
const post = await this.service.getPost(id)
reply.send(successResponse(toPostResponse(post)))  // ← apply mapper
```

## Query Parameter DTO

File: `src/modules/posts/dto/post.query.dto.ts`

```ts
import { z } from 'zod'

// ✅ Zod schema for query params (use z.coerce for type casting)
export const PostListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().default(10),
  offset: z.coerce.number().int().nonnegative().default(0),
  published: z.enum(['true', 'false']).optional(),
})

export type PostListQuery = z.infer<typeof PostListQuerySchema>

// ✅ Fastify JSON Schema for query validation
export const PostListQueryRouteSchema = {
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'number', default: 10, minimum: 1 },
      offset: { type: 'number', default: 0, minimum: 0 },
      published: { type: 'string', enum: ['true', 'false'] },
    },
  },
}
```

### In the Controller

```ts
async listPosts(request: FastifyRequest, reply: FastifyReply) {
  // Parse query params
  const parsed = PostListQuerySchema.safeParse(request.query)
  if (!parsed.success) {
    throw new ValidationError('Invalid query parameters')
  }

  const { limit, offset } = parsed.data
  const posts = await this.service.listPosts(limit, offset)
  
  reply.send(successResponse(
    posts.map(toPostResponse),
    { limit, offset, total: posts.length }
  ))
}
```

## Update Request DTO (PATCH)

For partial updates, make fields optional and ensure "at least one field" is provided:

File: `src/modules/posts/dto/update-post.request.dto.ts`

```ts
import { z } from 'zod'

export const UpdatePostSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    content: z.string().min(1).optional(),
    published: z.boolean().optional(),
  })
  .refine(
    data => Object.values(data).some(v => v !== undefined),
    { message: 'At least one field must be provided' }
  )

export type UpdatePostRequest = z.infer<typeof UpdatePostSchema>

export const UpdatePostRouteSchema = {
  body: {
    type: 'object' as const,
    minProperties: 1,  // ← ensure at least one field
    properties: {
      title: { type: 'string', minLength: 3, maxLength: 200 },
      content: { type: 'string' },
      published: { type: 'boolean' },
    },
    additionalProperties: false,
  },
}
```

## Common Zod Patterns

| Validation | Code |
|---|---|
| Required string | `z.string()` |
| Optional string | `z.string().optional()` |
| String with error msg | `z.string({ required_error: 'Name is required' })` |
| Email | `z.string().email('Invalid email')` |
| URL | `z.string().url()` |
| Enum | `z.enum(['draft', 'published'])` |
| Array | `z.array(z.string())` |
| Number from query string | `z.coerce.number()` |
| Positive integer | `z.coerce.number().int().positive()` |
| Min/max length | `z.string().min(3).max(50)` |
| Regex validation | `z.string().regex(/^[a-z]+$/)` |
| Default value | `z.string().default('draft')` |
| Custom validation | `.refine(data => data.startDate < data.endDate)` |

## File Naming Convention

| File | Naming | Example |
|---|---|---|
| Create request | `{action}.request.dto.ts` | `create-post.request.dto.ts` |
| Update request | `{action}.request.dto.ts` | `update-post.request.dto.ts` |
| Response | `{name}.response.dto.ts` | `post.response.dto.ts` |
| Query params | `{name}.query.dto.ts` | `post.query.dto.ts` |

All live under `src/modules/{name}/dto/`.

## Testing

Use Swagger UI at `http://localhost:3000/docs`:
1. Click on a POST endpoint
2. Click "Try it out"
3. Modify the request body — Swagger highlights validation errors in real time
4. The route's JSON Schema is displayed in the "Schema" panel

For complete details and more examples, see the source tutorial.
