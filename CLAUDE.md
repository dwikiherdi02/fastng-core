# FastNG: Modular Clean Architecture REST API Boilerplate

FastNG is a Fastify + TypeScript REST API boilerplate built on Modular Clean Architecture: Route → Controller → Service → Repository → Entity. Supports dual database drivers (Prisma: sqlite/mysql/postgresql, Mongoose: mongodb) selected via `DB_DRIVER` env var. Modules are registered in a central registry and loaded via topological sort respecting declared `dependsOn[]` relationships.

## Key Documentation

@.claude/rules/architecture.md — Layer responsibilities and per-layer do/don't rules  
@.claude/rules/modules.md — Module structure, registry system, and loader semantics  
@.claude/rules/database.md — Dual-driver model, repository pattern, transactions  
@.claude/rules/errors-and-dto.md — Error system, DTO pattern (Zod + JSON Schema)  
@.claude/rules/auth-and-jobs.md — JWT/auth, protected routes, RBAC, scheduled jobs  
@.claude/rules/conventions.md — Tooling, naming, service composition, package manager  
@.claude/rules/documentation.md — Tutorial authoring guidelines; mandatory for fundamental changes  
@.claude/rules/versioning.md — Semantic versioning (MAJOR/MINOR/PATCH), changelog, commit format  

## Non-Negotiable Rules

**Architecture & Code:**
- **Cross-module imports**: Only via the target module's `index.ts` (public API). Never import another module's internal files. `core/` never imports from `modules/`.
- **Entity**: Pure domain object. No imports from ORM (Prisma/Mongoose), Fastify, or any framework. May have domain logic methods.
- **Repository**: DB access only. Returns `Entity | null`, never throws domain errors (throw `NotFoundError` in the service instead). Responsible for mapping ORM ↔ Entity.
- **Service**: Contains all business logic and orchestration. Throws typed `AppError` subclasses. Never returns `null` for "not found" — must throw instead. Never directly touches `request`/`reply`/`fastify.*` or holds a raw DB client (always via injected repository).
- **Controller**: Parses input (Zod `safeParse`), calls service, formats output (`successResponse()`). No business logic, no try/catch — let errors propagate to the global handler.
- **Route**: Defines HTTP method/path/schema (JSON Schema for Swagger), attaches `preHandler` guards (e.g. `fastify.authenticate`). No business logic.
- **Registry**: Every new module must be declared in `src/registry/module.registry.ts` with `name`, `enabled` (boolean), `path` (ending in `.js` extension), and `dependsOn[]` (array of module names). Loader validates `dependsOn` are enabled at boot.
- **Import paths**: All TypeScript imports use `.js` extension (NodeNext ESM) even though source is `.ts`. Example: `import { UserService } from '../users/services/user.service.js'`.
- **Repository factory pattern**: `create{Name}Repository(fastify.db)` checks `env.DB_DRIVER === 'mongodb'` to return Mongoose or Prisma implementation; both conform to the same `I{Name}Repository` interface.
- **Multi-repository writes**: Only via `withTransaction(db, callback)` from `core/database/transaction.ts` (Prisma-only; throws for MongoDB). Each participating Prisma repository must expose `withClient(tx): I{Name}Repository`.
- **Service composition**: Service-in-service reuse only flows in the direction declared by `dependsOn[]`. Inject via constructor in `module.ts`, never `new ServiceX()` inside another service. Import only from the origin module's `index.ts`.
- **Package manager**: Use `yarn`, not `npm`.

**Documentation & Versioning (Mandatory for All Changes):**
- **Update VERSION.md with every commit**: Track changes in `VERSION.md` using semantic versioning (MAJOR.MINOR.PATCH). Fundamental changes must include new tutorial(s); version bump determines changelog entry. See `VERSION.md` for versioning rules and commit format.
- **Create/update tutorial on fundamental changes**: Any new feature, pattern, or architectural change that is fundamental (not a routine bug fix) **must** have a corresponding tutorial file in `tutorial/NN-*.md` written in **Bahasa Indonesia**. See @.claude/rules/documentation.md for what counts as "fundamental", language requirement, and template format.
- **Tutorial is single source of truth**: The tutorial file is the definitive reference. Skills and rules files reference tutorials, not the reverse. Keep tutorials up-to-date in Indonesian.
- **Tutorial must accompany MAJOR/MINOR bumps**: No code commit for new patterns/features ships without tutorial. Tutorial MUST be done BEFORE commit.

## File Map

**Module structure**: `src/modules/{name}/{index.ts, module.ts, entities/, dto/, repositories/{name}.repository.ts + .prisma.repository.ts + .mongo.repository.ts, services/, controllers/, routes/, jobs/}`

**Registry & loader**: `src/registry/module.registry.ts` (module declarations), `src/registry/module.loader.ts` (topological sort)

**Errors & responses**: `src/core/utils/errors.ts` (AppError subclasses), `src/core/middlewares/error-handler.ts` (global error handler), `src/core/utils/response.ts` (successResponse/errorResponse)

**Plugins**: `src/core/plugins/*.plugin.ts` (registered in `src/app.ts` in dependency order)

**Config & DB**: `src/core/config/env.config.ts` (Zod env schema), `src/core/database/transaction.ts` (multi-repo transaction utility)

**Versioning & Changelog**: `VERSION.md` (pure changelog tracking), `@.claude/rules/versioning.md` (semantic versioning rules and guidelines)

## Task-Specific Procedures

For step-by-step walkthroughs of common tasks (add a new module, switch DB driver, add a scheduled job, etc.), consult the matching skill under `.claude/skills/`. Each skill points to the corresponding `tutorial/NN-*.md` file for full code samples and rationale.

## Tooling & Conventions

**TypeScript**: 5.x, strict mode, NodeNext ESM (`moduleResolution: NodeNext`, all imports include `.js` extension)  
**Node**: >=20  
**Framework**: Fastify 5  
**Package manager**: yarn (not npm)  
**Code style**: Prettier (`semi: false`, `singleQuote: true`, `trailingComma: 'es5'`, `printWidth: 100`, `tabWidth: 2`), ESLint flat config (typescript-eslint recommended, `no-console: off`)  
**npm scripts**: `yarn dev` (watch mode), `yarn build`, `yarn start` (prod), `yarn lint`, `yarn format`, `yarn db:generate` / `db:migrate` / `db:push`, `yarn audit`  
**Documentation language**: All tutorial files in `tutorial/` folder MUST be written in **Bahasa Indonesia** (code samples/paths/identifiers remain in English). This ensures team accessibility regardless of English proficiency.  
**⚠️ No test framework installed yet**: vitest and supertest are listed in ARCHITECTURE.md as aspirational. Do not assume `yarn test`, `vitest`, or `supertest` commands exist in the current setup.
