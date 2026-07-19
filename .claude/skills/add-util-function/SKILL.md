# Skill: Add Utility Function

**Description**: Create a new pure utility function or extend core/utils helpers (errors.ts, response.ts).

**Source tutorial**: [tutorial/12-menambah-fungsi-utils.md](../../../tutorial/12-menambah-fungsi-utils.md)

## Decision Tree

**Is it a new error type?** → Use add-custom-error-type skill (extend `errors.ts`)

**Is it a response formatting helper?** → Add to `response.ts`

**Is it a reusable pure function?** → Create a new file in `core/utils/`

## Option 1: Extend errors.ts

Add new AppError subclasses:

File: `src/core/utils/errors.ts`

```ts
export class QuotaExceededError extends AppError {
  constructor(message = 'Quota exceeded') {
    super(message, 429)
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429)
  }
}
```

See: add-custom-error-type skill for full details.

## Option 2: Extend response.ts

Add helper functions for response formatting:

File: `src/core/utils/response.ts`

```ts
// Existing
export function successResponse<T>(data: T, meta?: Record<string, any>) {
  return { success: true, data, meta }
}

export function errorResponse(message: string) {
  return { success: false, message }
}

// NEW: Pagination helper
export function paginationMeta(total: number, limit: number, offset: number) {
  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1
  
  return {
    total,
    limit,
    offset,
    currentPage,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  }
}
```

Use in a controller:

```ts
async listPosts(request: FastifyRequest, reply: FastifyReply) {
  const { limit, offset } = request.query
  const { posts, total } = await this.service.listPosts(limit, offset)
  
  reply.send(
    successResponse(
      posts.map(toPostResponse),
      paginationMeta(total, limit, offset)
    )
  )
}
```

## Option 3: Create a New Utility File

For standalone pure functions (no Fastify, ORM, or framework dependencies).

File: `src/core/utils/slugify.ts`

```ts
/**
 * Convert a string to a URL-friendly slug.
 * Example: "Hello World!" → "hello-world"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // spaces → hyphens
    .replace(/[^\w-]/g, '')         // remove non-word chars
    .replace(/-+/g, '-')            // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '')        // remove leading/trailing hyphens
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)
}
```

File: `src/core/utils/date.ts`

```ts
/**
 * Format a date in Indonesian locale (DD/MM/YYYY).
 */
export function formatDateIndo(date: Date): string {
  return date.toLocaleDateString('id-ID')
}

/**
 * Check if a date has already passed.
 */
export function isExpired(expiresAt: Date): boolean {
  return expiresAt < new Date()
}

/**
 * Get days remaining until a date.
 */
export function daysUntil(date: Date): number {
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
```

File: `src/core/utils/validation.ts`

```ts
/**
 * Check if a string is a valid email.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Check if a password meets security requirements.
 */
export function isSecurePassword(password: string): {
  isSecure: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (password.length < 8) errors.push('Must be at least 8 characters')
  if (!/[A-Z]/.test(password)) errors.push('Must contain uppercase letter')
  if (!/[a-z]/.test(password)) errors.push('Must contain lowercase letter')
  if (!/[0-9]/.test(password)) errors.push('Must contain number')
  if (!/[!@#$%^&*]/.test(password)) errors.push('Must contain special char (!@#$%^&*)')
  
  return {
    isSecure: errors.length === 0,
    errors,
  }
}
```

## Rules for Utility Functions

✅ **May:**
1. **Pure functions** — no side effects, given the same input always produce the same output
2. **One concern per file** — `slugify.ts` only does slug stuff, `date.ts` only does date stuff
3. **Named exports** — `export function`, not `export default`
4. **No framework imports** — no Fastify, Prisma, Mongoose, ORM, or HTTP-related code
5. **Simple dependencies** — ok to depend on Node.js built-ins (`crypto`, `fs`, etc.) and small libraries

❌ **Must not:**
1. Depend on Fastify, request/reply, or service instances
2. Throw HTTP errors (AppError subclasses) — just return boolean/null or throw regular Error
3. Access databases or call repositories
4. Have side effects like logging or network calls (unless it's purely a logger util)
5. Mix multiple concerns in one file

## Using Utilities

Import by named export:

```ts
// ✅ Correct
import { slugify, isValidSlug } from '../../core/utils/slugify.js'
import { formatDateIndo, daysUntil } from '../../core/utils/date.js'

// Use in a service
export class PostService {
  async createPost(authorId: string, data: CreatePostInput): Promise<PostEntity> {
    const slug = slugify(data.title)
    
    if (!isValidSlug(slug)) {
      throw new BadRequestError('Invalid title (contains non-word characters)')
    }
    
    const post = await this.repository.create({
      ...data,
      authorId,
      slug,
    })
    
    return post
  }
}
```

## Structure

```
src/core/utils/
├── errors.ts              ← AppError + subclasses
├── response.ts            ← successResponse(), errorResponse(), pagination()
├── slugify.ts             ← slug generation + validation
├── date.ts                ← date formatting, expiry checks
├── validation.ts          ← email, password, security checks
└── number.ts              ← numeric formatting, rounding, etc.
```

Keep one concern per file for clarity and reusability.

## Testing

1. Write the pure function in a new file under `src/core/utils/`
2. Import it in a service or controller
3. Use it: `const slug = slugify('Hello World')`
4. Verify the output
5. Run `bun run lint` and `bun run format`

For complete details, see the source tutorial.
