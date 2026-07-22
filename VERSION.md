# FastNG Changelog

**Current Version**: 4.0.0
**Last Updated**: 2026-07-22

For semantic versioning rules, guidelines, and commit format, see @.claude/rules/versioning.md.

---

## Unreleased Changes

Changes listed here are uncommitted. Once committed, they will be moved to a version entry below.

### Added
- (none yet)

### Changed
- (none yet)

### Fixed
- (none yet)

### Removed
- (none yet)

### Security
- (none yet)

---

## [4.0.0] — 2026-07-22

**Laravel-style migration CLI with per-module history + JSON-based seeders**

### Added
- **Migration CLI with per-module history, batches, and rollback** (tutorial: tutorial/26-cli-migrasi-dan-seeder-ala-laravel.md): `bun run migrate`, `migrate:install`, `migrate:status`, `migrate:rollback` (`-- --step=N`), `migrate:reset`, `migrate:refresh`, `migrate:fresh` (the last two accept `-- --seed`). **Each module owns its own migration folder** at `src/modules/{name}/db/migrations/<ts>_<name>/{migration.sql, down.sql, schema.snapshot.prisma}` — diffed from that module's own fragment (driver base block + its `db/{name}.prisma`) against its own previous snapshot, never a cross-module combined diff. Up/down scripts come from `prisma migrate diff` between datamodels, so no shadow database is needed.
- Migration repository table `_fastng_migrations` (`module`, `migration`, `batch`, `applied_at`, unique on `(module, migration)`), created by `migrate:install`, which also **baselines** an existing `db push` database per module (records its migrations without executing them).
- **Rollback-on-disable**: when a module is switched to `enabled: false`, the next `bun run migrate` automatically rolls back that module's applied migrations (`down.sql`) instead of generating a new DROP migration. Re-enabling replays them. `migrate:status` marks such migrations `Disabled`.
- **JSON-based seeders** (tutorial: tutorial/26): `src/modules/{name}/seeders/*.json` — `{ table, uniqueBy, rows, order? }`, with `{ "$env": "VAR" }` and `{ "$hash": <value> }` (bcrypt) directives for row values. Executed via `src/core/database/seeder/{json-seeder.ts,table-writer.ts}` — column mapping through Prisma's DMMF for SQL drivers, direct Mongoose collection writes for MongoDB. Scoped to tables with a single `@id` field.
- **`*.seeder.ts` escape hatch** (unchanged contract): `ModuleSeeder` (`{ name, order?, run(ctx) }`) for seed data that's dynamic (derived from live state) or relational on a composite-key table. A `seeders/` folder may mix `.json` and `.seeder.ts` files; both are auto-discovered for enabled modules and run in registry topological order. `bun run db:seed` gains `-- --module=` and `-- --class=` selectors (matching a JSON file's basename or a `*.seeder.ts`'s exported `name`).
- `src/registry/seeder.ts` (combined JSON+TS loader), `src/registry/topology.ts` (topological sort shared by the module loader, seeder loader, and migration runner), `src/core/utils/project-root.ts` (`findProjectRoot()` shared across all three).

### Changed
- **BREAKING** — schema changes no longer go through `prisma db push`, and migrations are no longer a single combined history. `bun run migrate` diffs and applies each enabled module independently via `prisma db execute`. `_fastng_migrations` — not `_prisma_migrations` — is the source of truth.
- **BREAKING** — seeding moved out of `core/` and off hand-written repository-upsert code: default roles now live in `src/modules/role/seeders/roles.json` (+ `grants.seeder.ts` for the catalog-derived grants), and the admin user in `src/modules/auth/seeders/users.json` (+ `admin-role.seeder.ts` for the role assignment).
- **BREAKING** — `ICatalogSyncRepository` is reduced to manifest catalog operations (`upsertPermission`, `upsertMenu`, `removeMenu`); `upsertRole`, `setRoleGrants`, `upsertUserWithRoles`, and `listMenusWithPermissions` were removed along with the `MenuWithPermissions` and `RoleGrant` types.
- `bun run db:sync` no longer touches the schema — it only reconciles the menu/permission catalog (and still runs automatically at the end of `migrate`, `migrate:refresh`, and `migrate:fresh`).
- `prisma generate` runs before the Prisma client is imported, avoiding a Windows `EPERM` failure when replacing a loaded query-engine DLL.
- Migration folders are committed to git as each module's migration history (`src/modules/{name}/db/migrations/`) — there is no longer a top-level `prisma/migrations/`.
- Documentation refreshed for the new architecture: README, tutorial/01, tutorial/05, tutorial/08, tutorial/18, tutorial/26, and the `add-module` / `add-auth-guard` / `switch-db-driver` skills.

### Removed
- **BREAKING** — npm scripts `db:push` and `db:migrate`. Use `bun run migrate` (and `migrate:fresh` to rebuild). Calling `prisma migrate dev` / `prisma db push` directly is no longer supported: they maintain a different history.
- `IAuthRepository.updatePassword()` — the admin seeder now overwrites the password hash through the generic JSON table-writer's upsert path instead.

---

## [3.1.0] — 2026-07-19

**Refactor code structure for improved readability and maintainability**

### Added
- Configurable API docs: `DOC_PROVIDER` env var (`swagger` default | `scalar`) selects the docs UI renderer, and `DOC_PATH` (default `/docs`, must start with `/`) customizes the path (tutorial: tutorial/24-integrasi-docs-scalar.md)

### Changed
- Package manager & dev/CLI runtime switched from Yarn + Node/`tsx` to **Bun**: `bun install` replaces `yarn install`, `bun run <script>` replaces `yarn <script>`, `dev`/`db:sync`/`db:seed` run natively via Bun (the `tsx` devDependency was removed), `start` executes compiled output via `bun` instead of `node`, and `audit` now runs `bun audit --audit-level=high`. `build` (`tsc`) is unchanged. `yarn.lock` replaced by `bun.lock` (tutorial: tutorial/25-migrasi-yarn-ke-bun.md)

### Fixed
- Added a Bun preload shim (`scripts/bun-v8-compat.ts`, registered via `bunfig.toml`) that no-ops `v8.startupSnapshot.isBuildingSnapshot()` — without it, Bun 1.3.14 crashes with `NotImplementedError` on any command importing `src/core/database/index.ts` (i.e. `dev`/`start`/`db:sync`/`db:seed`), because the statically-imported Mongoose driver transitively loads `bson`, whose static initializer calls that unimplemented API. Upstream Bun limitation, not a FastNG bug (tutorial: tutorial/25-migrasi-yarn-ke-bun.md)

---

## [3.0.0] — 2026-07-12

**RBAC module split + snake_case schema + user-level permissions + Scalar docs**

> ⚠️ **Breaking release.** Table/column names changed to snake_case, the RBAC tables moved into new modules, the manifest `permissions` shape changed, and a user-level override table was added. Run `yarn db:sync` then `yarn db:seed`.

### Added
- New modules `permission`, `menu`, `role`, `session` — each owns its own `db/*.prisma` fragment (moved out of `auth`). `dependsOn` graph: `permission → menu → role`, `session` standalone, `auth → role/menu/session`, `users → auth/role` (tutorial: tutorial/22-pemecahan-modul-rbac.md)
- User-level permission overrides (`user_menu_permissions`, effect `allow`/`deny`) — admin can grant/revoke per user on top of role grants; effective = user override wins, else role grant (tutorial: tutorial/23-hak-akses-per-user-dan-cascade-can-access.md)
- `can_access` master gate — a denied `can_access` fails every other permission on that menu; enforced in route middleware only (`fastify.requireMenuAccess(menu)` + folded into `fastify.authorize`) (tutorial: tutorial/23-*.md)
- Admin checklist APIs: `role` module `GET/POST/PUT/DELETE /api/v1/roles` + `PUT /roles/:id/permissions`; `users` module `PUT /users/:id/roles` and `GET|PUT /users/:id/permissions`; catalog reads `GET /api/v1/permissions` and `GET /api/v1/menus`
- Manifest permissions now carry a `description` (and optional `route` binding), surfaced in the admin checklist + API docs
- Scalar API reference at `/docs` via `@scalar/fastify-api-reference` (tutorial: tutorial/24-integrasi-docs-scalar.md)

### Changed
- **snake_case** database naming: Prisma models keep PascalCase but map to snake_case tables/columns via `@@map`/`@map`; Mongoose collections + fields are snake_case (Prisma client access is unchanged)
- Sessions moved from the auth repository into the dedicated `session` module (`ISessionRepository`); `AuthService` receives it via constructor
- `rbac.reader` resolves permissions via scalar step-wise joins (cross-module `@relation` removed); `hasPermission`/`getAccessibleMenus` now take `userId` for override resolution
- Manifest `permissions: string[]` → `permissions: PermissionManifest[]` (`{ code, name?, description, route? }`)
- API docs served by Scalar instead of `@fastify/swagger-ui`

### Removed
- Cross-module Prisma relations for the RBAC tables (now self-contained fragments with scalar FKs; cascades handled in the service layer)

### Security
- User-level DENY overrides let an admin instantly revoke a specific permission from one user regardless of their roles

**Migration notes:** `yarn db:sync` (snake_case tables are recreated) then `yarn db:seed`. `@fastify/swagger-ui` is no longer used — you may `yarn remove @fastify/swagger-ui`. Update any custom modules' manifests to the object `permissions` shape.

---

### Added
- (none yet)

### Changed
- (none yet)

### Fixed
- (none yet)

### Deprecated
- (none yet)

### Removed
- (none yet)

### Security
- (none yet)

---

## [2.0.0] — 2026-07-11

**Dynamic RBAC (User → Role → Menu → Permission) + Per-Module Migration/Seeding**

> ⚠️ **Breaking release.** The access-token payload, the auth database schema, and the migration workflow all changed. See the migration notes below.

### Added
- Dynamic RBAC data model: `roles`, `user_roles` (m2m), `menus` (self-referencing tree), `permissions` (global catalog), `menu_permissions`, `role_menu_permissions` (tutorial: tutorial/17-rbac-dinamis-user-role-menu-permission.md)
- Session-control auth: `sessions` table with SHA-256-hashed opaque refresh tokens, rotation, reuse detection, per-device force-logout; `GET /me/menus`, `GET /me/sessions`, `DELETE /sessions/:id` (tutorial: tutorial/20-session-control-force-logout.md)
- Per-module database migration: each module owns a `db/*.prisma` fragment; `yarn db:sync` assembles the schema from ENABLED modules and pushes it — disabled modules' tables are dropped (tutorial: tutorial/18-migrasi-seeder-per-module.md)
- Per-module menu/permission manifests (`{name}.manifest.ts`) synced bidirectionally into the catalog; `yarn db:seed` seeds default roles (`admin`/`user`) + a default admin user (tutorial: tutorial/19-manifest-menu-permission-module.md)
- `fastify.authorize(menuCode, permissionCode)` and `fastify.requireRole(...codes)` guard decorators (`src/core/plugins/auth-guard.plugin.ts`)
- Core RBAC reader (`src/core/rbac/rbac.reader.ts`) and token helpers (`src/core/utils/token.ts`)
- SQL Server (`sqlserver`) database driver support (tutorial: tutorial/21-menambah-driver-sqlserver.md)
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` env vars; `yarn db:sync` and `yarn db:seed` scripts

### Changed
- Access-token payload changed from `{ sub, username, role }` to `{ sub, sid, jti, username, roles }` (`roles` is now an array; `request.user.role` no longer exists)
- Refresh tokens are now opaque, SHA-256-hashed, stored in `sessions` (previously raw JWTs in `RefreshToken`)
- `prisma/schema.prisma` is now AUTO-GENERATED by the schema-builder; driver base blocks live in `prisma/base/*.prisma`
- `User` gained `isActive` and multi-role relations; the single `role` string column was removed
- `IAuthRepository` reworked around sessions (`createSession`/`rotateSession`/`revokeSession`/…) instead of refresh-token rows

### Removed
- `prisma/schema.mysql.prisma` / `prisma/schema.postgresql.prisma` reference copies (superseded by `prisma/base/` + assembler)
- `RefreshToken` Prisma model and `refresh-token.model.ts` Mongoose model (replaced by `sessions`)

### Security
- Refresh tokens hashed with SHA-256 before storage; rotation on every refresh with reuse detection; admin/self force-logout via the sessions table

**Migration notes:** run `yarn db:sync` then `yarn db:seed`. Update any code reading `request.user.role` to `request.user.roles` (array). Log in with the seeded admin (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

---

## [1.0.0] — 2026-06-16

**Initial Release - Complete Fastify TypeScript REST API Boilerplate**

### Added
- CLAUDE.md with modular clean architecture rules
- 7 rule files (.claude/rules/) covering: architecture, modules, database, errors/DTOs, auth/jobs, conventions, documentation
- 12 skills (.claude/skills/) for common development tasks
- Project settings (.claude/settings.json) with permission allowlist
- Documentation guidance system (.claude/guidance/)
- VERSION.md with semantic versioning and changelog tracking
- Full TypeScript migration (from JavaScript)
- Module registry system with topological sort loader
- Dual database driver support (Prisma: sqlite/mysql/postgresql, Mongoose: mongodb)
- Environment-based configuration with Zod validation
- Comprehensive error handling with typed AppError subclasses
- JWT authentication with dual-token system
- Role-based authorization (RBAC) support
- Request/response validation with paired Zod + JSON Schema
- Scheduled jobs via @fastify/schedule + toad-scheduler
- Multi-repository atomic transactions (Prisma-only)
- Service-in-service composition pattern
- Global error handler with centralized error mapping
- Swagger/OpenAPI documentation auto-generation
- 16 tutorial files in Bahasa Indonesia
