# Conventions: Tooling, Naming, and Service Composition

## Technology Stack & Tooling

| Component | Version/Detail |
|---|---|
| TypeScript | 5.x, strict mode, NodeNext ESM |
| Node.js | >=20 |
| Fastify | 5.x |
| Runtime | Node.js (dev: `tsx`, prod: compiled `tsc` output) |
| Package manager | **yarn** (not npm) |
| Code formatter | Prettier |
| Linter | ESLint (flat config, `typescript-eslint` recommended) |

### TypeScript & ESM

- **Module system**: NodeNext (`moduleResolution: NodeNext`), which requires explicit `.js` file extensions in all imports, even for `.ts` source files.
- **Target**: ES2022 (modern async/await, nullish coalescing, etc.)
- **Strict mode**: Enabled (`strict: true` in `tsconfig.json`)

**Import examples** (`.js` extension is required):

```ts
// ✅ Correct
import { UserService } from '../users/services/user.service.js'
import { AppError } from '../../core/utils/errors.js'

// ❌ Wrong (no .js extension)
import { UserService } from '../users/services/user.service'
```

### Code Style: Prettier

`.prettierrc` (non-negotiable):

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2
}
```

What this means:
- No semicolons at line ends
- Single quotes (not double)
- Trailing commas in arrays/objects (ES5-compatible, no trailing comma after last function argument)
- 100-character line width
- 2-space indentation

Run: `yarn format`

### ESLint

`eslint.config.js` (flat config):

- Base: `typescript-eslint` recommended rules
- Disabled: `no-console` (logging is allowed)
- Warning: `@typescript-eslint/no-unused-vars` (ignore `_`-prefixed variables)

Run: `yarn lint`

## Package Manager: Yarn

This project uses **yarn**, not npm.

| Action | Command |
|---|---|
| Install dependencies | `yarn install` (or just `yarn`) |
| Add package | `yarn add {package}` |
| Remove package | `yarn remove {package}` |
| Run dev server | `yarn dev` |
| Build | `yarn build` |
| Start (prod) | `yarn start` |
| Database commands | `yarn db:generate`, `yarn db:migrate`, `yarn db:push` |
| Lint | `yarn lint` |
| Format | `yarn format` |
| Security audit | `yarn audit --level high` |

### Key Scripts (from `package.json`)

```json
{
  "scripts": {
    "dev": "node --env-file=.env --import tsx/esm --watch src/server.ts",
    "start": "node --env-file=.env dist/server.js",
    "build": "tsc",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "lint": "eslint src/",
    "format": "prettier --write src/",
    "audit": "yarn audit --level high"
  }
}
```

## Naming Conventions

### Folders

| Layer | Convention | Example |
|---|---|---|
| Modules (root) | lowercase plural | `src/modules/{name}/` (e.g., `posts`, `users`) |
| Sublayer | lowercase singular | `entities/`, `services/`, `controllers/`, `routes/`, `repositories/`, `dto/`, `jobs/` |
| Core | lowercase, grouped by function | `config/`, `database/`, `middlewares/`, `plugins/`, `utils/` |

### Files

All files use **dot-separated kebab-case** pattern: `{name}.{layer}.ts`

| File | Pattern | Example |
|---|---|---|
| Entity | `{singular}.entity.ts` | `post.entity.ts` |
| Service | `{singular}.service.ts` | `post.service.ts` |
| Controller | `{singular}.controller.ts` | `post.controller.ts` |
| Repository interface | `{singular}.repository.ts` | `post.repository.ts` |
| Prisma repository | `{singular}.prisma.repository.ts` | `post.prisma.repository.ts` |
| Mongo repository | `{singular}.mongo.repository.ts` | `post.mongo.repository.ts` |
| Request DTO | `{action}.request.dto.ts` | `create-post.request.dto.ts`, `update-post.request.dto.ts` |
| Response DTO | `{singular}.response.dto.ts` | `post.response.dto.ts` |
| Query DTO | `{singular}.query.dto.ts` | `post.query.dto.ts` |
| Routes | `{singular}.routes.ts` | `post.routes.ts` |
| Module entry | `module.ts` (no prefix) | `module.ts` |
| Public API | `index.ts` (no prefix) | `index.ts` |
| Plugins | `{name}.plugin.ts` | `jwt.plugin.ts`, `cors.plugin.ts` |
| Middleware | `{name}-handler.ts` or `{name}.ts` | `error-handler.ts`, `request-id.ts` |
| Utilities | `{name}.ts` | `slugify.ts`, `date.ts` |
| Jobs | `{action}.job.ts` | `cleanup.job.ts`, `daily-report.job.ts` |

### Classes & Interfaces

| Type | Convention | Example |
|---|---|---|
| Class | PascalCase | `PostService`, `PostController`, `PostEntity` |
| Repository interface | PascalCase with `I` prefix | `IPostRepository`, `IUserRepository` |
| Enums/types | PascalCase | `CreatePostData`, `UserRole`, `PostStatus` |
| Functions | camelCase | `createPostRepository()`, `toPostResponse()`, `loadModules()` |
| Variables | camelCase | `postService`, `postRepository` |
| Environment variables | SCREAMING_SNAKE_CASE | `DB_DRIVER`, `JWT_SECRET`, `SCHEDULER_ENABLED` |

### Routes

All routes are versioned and prefixed by module:

```
/api/v1/{module-name}/{resource}/{action}

Examples:
/api/v1/auth/register
/api/v1/auth/login
/api/v1/auth/refresh
/api/v1/users/me
/api/v1/posts
/api/v1/posts/{id}
/api/v1/posts/{id}/comments
```

## Service Composition (Service-in-Service)

When one service needs to reuse complex business logic from another service, inject the dependency via the constructor. This pattern only flows in the direction declared by `dependsOn[]` in the registry.

### Rules

1. **Direction is determined by registry**: A service can only use another service if its module has the other module in its `dependsOn[]` array.
   ```ts
   // src/registry/module.registry.ts
   { name: 'users', enabled: true, ..., dependsOn: ['auth'] }  // ✅ users may use auth
   { name: 'auth', enabled: true, ..., dependsOn: [] }        // ❌ auth cannot use users
   ```

2. **Inject via constructor, never instantiate inside a service**:
   ```ts
   // ✅ Correct
   export class UserService {
     constructor(
       private deps: {
         userRepository: IUserRepository
         authService: AuthService  // ← injected dependency
       }
     ) {}
     
     async updateEmail(userId: string, newEmail: string) {
       // ... update user ...
       if (emailChanged) {
         await this.deps.authService.revokeAllTokens(userId)  // ← use the service
       }
     }
   }
   
   // ❌ Wrong
   export class UserService {
     async updateEmail(userId: string, newEmail: string) {
       const authService = new AuthService(...)  // ❌ don't instantiate here
     }
   }
   ```

3. **Import the service only from the origin module's `index.ts`**:
   ```ts
   // ✅ Correct
   import { AuthService } from '../auth/index.js'
   
   // ❌ Wrong (internal file)
   import { AuthService } from '../auth/services/auth.service.js'
   ```

4. **Wiring happens in `module.ts`**, not in the service:
   ```ts
   // src/modules/users/module.ts
   import { AuthService, createAuthRepository } from '../auth/index.js'
   
   export default async function usersModule(fastify: FastifyInstance) {
     // Create AuthService instance (separate from auth module's own instance)
     const authRepository = createAuthRepository(fastify.db)
     const authService = new AuthService(authRepository, fastify)
     
     // Create UserService with injected authService
     const userRepository = createUserRepository(fastify.db)
     const userService = new UserService({
       userRepository,
       authService,
     })
     
     const controller = new UserController(userService)
     // ... register routes ...
   }
   ```

5. **Avoid depth > 2**: A chain of A → B → C services is acceptable, but A → B → C → D is getting too deep and suggests architectural refactoring (e.g., move some logic to `core/utils/`).

### When NOT to Use Service Composition

**Wrong use case**: Just to access another module's repository for a simple DB read.

```ts
// ❌ Wrong: use composition just to read from another table
export class UserService {
  constructor(private deps: { postService: PostService }) {}
  
  async getUserWithPostCount(userId: string) {
    const postCount = await this.deps.postService.countPostsByUser(userId)
    // ...
  }
}

// ✅ Better: inject the repository directly
export class UserService {
  constructor(private deps: { userRepository, postRepository }) {}
  
  async getUserWithPostCount(userId: string) {
    const count = await this.deps.postRepository.countByAuthor(userId)
    // ...
  }
}
```

## Parallel Copilot Config (GitHub)

FastNG has a GitHub-Copilot-facing configuration in `.github/`:
- `.github/copilot-instructions.md` — PR review guidelines (Indonesian)
- `.github/instructions/module.instructions.md` — module development standards (Indonesian)
- `.github/instructions/database.instructions.md` — database/repository patterns (Indonesian)
- `.github/instructions/api.instructions.md` — API design + error handling (Indonesian)

These cover the same architecture but are for PR-review feedback. Keep this Claude Code configuration consistent with them — don't duplicate verbatim, but align on terminology, file paths, and conventions.

## No Test Framework (Yet)

`ARCHITECTURE.md` lists `vitest` and `supertest` as the intended testing stack, but they are **not installed** in the current `package.json`. Do not assume `yarn test`, `vitest`, or `supertest` commands exist. Before suggesting or using a test command, check `package.json` to confirm the framework is actually present.

For complete references and code examples, see `tutorial/13-aturan-arsitektur.md` and `tutorial/15-service-in-service.md` (Indonesian).
