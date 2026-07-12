# FastNG Changelog

**Current Version**: 3.0.0  
**Last Updated**: 2026-07-12

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
