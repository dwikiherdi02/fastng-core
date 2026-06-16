# FastNG Changelog

**Current Version**: 1.0.0  
**Last Updated**: 2026-06-16

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

### Deprecated
- (none yet)

### Removed
- (none yet)

### Security
- (none yet)

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
