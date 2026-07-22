# Conventions: Tooling, Naming, and Service Composition

> **v4.0.0 additions** (see `tutorial/26`): scripts `db:push` and `db:migrate` are **removed**. Schema work goes through `migrate` / `migrate:install` / `migrate:status` / `migrate:rollback` / `migrate:reset` / `migrate:refresh` / `migrate:fresh` (CLI at `scripts/migrate.ts`, logic in `src/core/database/migration/`) — **each module keeps its own migration history** in `src/modules/{name}/db/migrations/`, diffed from that module's own fragment, never combined. `db:sync` now only reconciles the menu/permission catalog. `db:seed` runs each enabled module's `seeders/` (`--module=` / `--class=`). New file conventions: `{table}.json` (static seed rows, the default) and `{what}.seeder.ts` (escape hatch for dynamic/relational seed data), both inside `src/modules/{name}/seeders/`.

> **v3.1.0 additions**: package manager and dev/CLI runtime switched from **Yarn + Node/tsx** to **Bun**. `bun install` replaces `yarn install`; `bun run <script>` replaces `yarn <script>`; `dev`/`db:sync`/`db:seed` now run directly via Bun's native TypeScript/ESM support (the `tsx` devDependency was removed). `build` is unchanged (`tsc` → `dist/`), and `start` now executes the compiled output with `bun` instead of `node`. See `tutorial/25-migrasi-yarn-ke-bun.md`.

> **v2.0.0 additions**: new scripts `db:sync` (assemble per-module schema from enabled modules → `prisma db push` → sync menu/permission catalog) and `db:seed` (default roles + admin user, from `SEED_ADMIN_*` env). CLI entry points live in `scripts/db-sync.ts` and `scripts/db-seed.ts`, outside `src/` so `tsc` build ignores them. `DB_DRIVER` now also accepts `sqlserver`. New file conventions: `{name}.manifest.ts` (module menu/permission manifest) and `db/{name}.prisma` (module schema fragment). See `tutorial/18`–`tutorial/21`.

## Technology Stack & Tooling

| Component | Version/Detail |
|---|---|
| TypeScript | 5.x, strict mode, NodeNext ESM |
| Node.js | >=20 |
| Fastify | 5.x |
| Runtime | Bun (dev/CLI scripts run natively via Bun; prod `start` runs compiled `tsc` output via `bun`) |
| Package manager | **Bun** (not yarn/npm) |
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

Run: `bun run format`

### ESLint

`eslint.config.js` (flat config):

- Base: `typescript-eslint` recommended rules
- Disabled: `no-console` (logging is allowed)
- Warning: `@typescript-eslint/no-unused-vars` (ignore `_`-prefixed variables)

Run: `bun run lint`

## Package Manager: Bun

This project uses **Bun**, not yarn/npm.

| Action | Command |
|---|---|
| Install dependencies | `bun install` (or just `bun i`) |
| Add package | `bun add {package}` |
| Remove package | `bun remove {package}` |
| Run dev server | `bun run dev` |
| Build | `bun run build` |
| Start (prod) | `bun run start` |
| Database commands | `bun run migrate` (+ `migrate:install`/`:status`/`:rollback`/`:reset`/`:refresh`/`:fresh`), `bun run db:generate`, `bun run db:sync`, `bun run db:seed` |
| Lint | `bun run lint` |
| Format | `bun run format` |
| Security audit | `bun audit --audit-level=high` |

### Key Scripts (from `package.json`)

```json
{
  "scripts": {
    "dev": "bun --env-file=.env --watch src/server.ts",
    "start": "bun --env-file=.env dist/server.js",
    "build": "tsc",
    "migrate": "bun --env-file=.env scripts/migrate.ts",
    "migrate:install": "bun --env-file=.env scripts/migrate.ts install",
    "migrate:status": "bun --env-file=.env scripts/migrate.ts status",
    "migrate:rollback": "bun --env-file=.env scripts/migrate.ts rollback",
    "migrate:reset": "bun --env-file=.env scripts/migrate.ts reset",
    "migrate:refresh": "bun --env-file=.env scripts/migrate.ts refresh",
    "migrate:fresh": "bun --env-file=.env scripts/migrate.ts fresh",
    "db:generate": "prisma generate",
    "db:sync": "bun --env-file=.env scripts/db-sync.ts",
    "db:seed": "bun --env-file=.env scripts/db-seed.ts",
    "lint": "eslint src/",
    "format": "prettier --write src/",
    "audit": "bun audit --audit-level=high"
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
| Seeders (static rows) | `{table}.json` | `roles.json`, `users.json` |
| Seeders (escape hatch) | `{what}.seeder.ts` | `grants.seeder.ts`, `admin-role.seeder.ts` |
| Manifest | `{name}.manifest.ts` | `role.manifest.ts` |
| Schema fragment | `db/{name}.prisma` | `db/role.prisma` |

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

`ARCHITECTURE.md` lists `vitest` and `supertest` as the intended testing stack, but they are **not installed** in the current `package.json`. Do not assume `bun test`, `vitest`, or `supertest` commands are wired to a configured test suite. Before suggesting or using a test command, check `package.json` to confirm the framework is actually present.

For complete references and code examples, see `tutorial/13-aturan-arsitektur.md` and `tutorial/15-service-in-service.md` (Indonesian).
