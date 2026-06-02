# Architecture Plan

## Overview

This project follows a **Modular Clean Architecture** pattern, combining principles from
Domain-Driven Design (DDD) and Clean Architecture. The codebase is organized into
self-contained modules, each with its own layered structure (Controller → Service →
Repository → Entity). Modules can declare dependencies on other modules and can be
enabled or disabled via a central registry without touching application code.

This architecture is implemented for TypeScript services using Fastify + Node.js.

---

## Architecture Style

| Aspect | Decision |
|---|---|
| Pattern | Modular Clean Architecture |
| Module communication | Public API only (`index` file per module) |
| Dependency direction | Inward only — outer layers depend on inner, never reverse |
| Cross-module coupling | Loose — via exported public API, no direct internal imports |
| Module lifecycle | Enabled / disabled via central registry |
| Dependency resolution | Topological sort at load time |

---

## Global Folder Structure

```
FastNG/
├── prisma/
│   ├── schema.prisma              # Schema aktif (default: SQLite)
│   ├── schema.mysql.prisma        # Referensi schema MySQL
│   └── schema.postgresql.prisma   # Referensi schema PostgreSQL
│
├── src/
│   ├── core/                      # Shared infrastructure — no dependency on any module
│   │   ├── config/
│   │   │   └── env.config.ts      # Zod env schema, fail-fast on invalid vars
│   │   ├── database/
│   │   │   ├── drivers/
│   │   │   │   ├── prisma.driver.ts    # PrismaClient singleton
│   │   │   │   └── mongoose.driver.ts  # Mongoose connect/disconnect
│   │   │   ├── models/                 # Mongoose schemas + TypeScript types (MongoDB only)
│   │   │   │   ├── user.model.ts
│   │   │   │   └── refresh-token.model.ts
│   │   │   └── index.ts               # connectDb() / disconnectDb() by DB_DRIVER
│   │   ├── middlewares/
│   │   │   └── error-handler.ts       # Global error → HTTP status mapping
│   │   ├── plugins/                   # Fastify plugins (wrapped with fastify-plugin)
│   │   │   ├── db.plugin.ts           # DB connect + fastify.db decorator
│   │   │   ├── jwt.plugin.ts          # @fastify/jwt + fastify.authenticate decorator
│   │   │   ├── cors.plugin.ts
│   │   │   ├── helmet.plugin.ts
│   │   │   ├── rate-limit.plugin.ts
│   │   │   ├── swagger.plugin.ts      # OpenAPI spec + Swagger UI at /docs
│   │   │   └── schedule.plugin.ts     # @fastify/schedule + fastify.scheduler decorator
│   │   └── utils/
│   │       ├── errors.ts              # NotFoundError, ConflictError, UnauthorizedError, dll
│   │       └── response.ts            # successResponse() / errorResponse()
│   │
│   ├── modules/                       # Feature modules — each is self-contained
│   │   ├── auth/
│   │   │   ├── module.ts              # Entry point — registers routes
│   │   │   ├── index.ts              # Public API — only file other modules may import
│   │   │   ├── entities/
│   │   │   │   └── auth.entity.ts
│   │   │   ├── dto/
│   │   │   │   ├── register.request.dto.ts
│   │   │   │   ├── login.request.dto.ts
│   │   │   │   └── auth.response.dto.ts
│   │   │   ├── repositories/
│   │   │   │   ├── auth.prisma.repository.ts
│   │   │   │   ├── auth.mongo.repository.ts
│   │   │   │   └── auth.repository.ts  # IAuthRepository interface + factory by DB_DRIVER
│   │   │   ├── services/
│   │   │   │   └── auth.service.ts
│   │   │   ├── controllers/
│   │   │   │   └── auth.controller.ts
│   │   │   └── routes/
│   │   │       └── auth.routes.ts
│   │   │       └── jobs/              # Scheduled jobs (SimpleIntervalJob, CronJob)
│   │   │
│   │   ├── users/
│   │   │   ├── module.ts
│   │   │   ├── index.ts
│   │   │   ├── entities/
│   │   │   │   └── user.entity.ts
│   │   │   ├── dto/
│   │   │   │   ├── update-profile.request.dto.ts
│   │   │   │   └── user.response.dto.ts
│   │   │   ├── repositories/
│   │   │   │   ├── user.prisma.repository.ts
│   │   │   │   ├── user.mongo.repository.ts
│   │   │   │   └── user.repository.ts  # IUserRepository interface + factory
│   │   │   ├── services/
│   │   │   │   └── user.service.ts
│   │   │   ├── controllers/
│   │   │   │   └── user.controller.ts
│   │   │   └── routes/
│   │   │       └── user.routes.ts
│   │   │       └── jobs/              # Scheduled jobs (SimpleIntervalJob, CronJob)
│   │   │
│   │   └── welcome/
│   │       ├── module.ts
│   │       ├── index.ts
│   │       ├── controllers/
│   │       │   └── welcome.controller.ts
│   │       └── routes/
│   │           └── welcome.routes.ts
│   │
│   ├── registry/
│   │   ├── module.registry.ts         # Declares all modules: name, enabled, dependsOn[]
│   │   └── module.loader.ts           # Dep validation + topological sort + register
│   │
│   ├── types/
│   │   └── fastify.d.ts               # Module augmentation: FastifyInstance + FastifyJWT types
│   │
│   ├── app.ts                         # Builds Fastify instance (plugins + modules)
│   └── server.ts                      # Entry point — starts HTTP server
│
├── .env                               # Local environment variables (git-ignored)
├── .env.example                       # Template env vars
├── .gitignore
├── .prettierrc
├── eslint.config.js
├── package.json
└── README.md
```

---

## Layer Responsibilities

```
HTTP Request
     │
     ▼
 [ Route ]        Maps URL + HTTP method to a controller.
     │             Attaches request/response DTO as schema.
     ▼
 [ Controller ]   Receives request, calls service, sends response.
     │             No business logic. Uses Response DTO to shape output.
     ├── [ Request DTO ]   Validates and sanitizes incoming payload.
     └── [ Response DTO ]  Serializes outgoing data to client.
          │
          ▼
     [ Service ]   Contains all business logic.
          │         Operates exclusively on Entity objects.
          │         Throws domain errors — never returns error objects.
          ▼
     [ Repository ]  Handles all data access (DB, cache, external API).
          │            Maps ORM / raw query result → Entity before returning.
          │            Maps Entity → ORM model before persisting.
          ▼
     [ Entity ]    Pure domain object. No ORM, no HTTP, no framework.
          │         May contain domain methods (e.g. user.isActive()).
          ▼
     [ Model ]     ORM schema or query definition (Prisma, Mongoose, etc.)
          │
          ▼
     [ Database ]
```

---

## Module System

### Registry Schema

Each entry in the module registry declares:

```
{
  name:      string       — unique module identifier
  enabled:   boolean      — toggle without code change
  path:      string       — path to module entry point
  dependsOn: string[]     — names of modules that must be enabled first
}
```

### Loader Behavior

1. Filter registry to `enabled: true` entries
2. Validate all `dependsOn` references are also enabled — throw on unmet dependency
3. Sort modules topologically by dependency graph
4. Register modules in resolved order

### Module Communication Rules

- A module may only import from another module's `index` file (public API)
- Direct import of internal module files from outside is forbidden
- Circular dependencies between modules are forbidden
- If two-way communication is needed, use an event/hook/mediator pattern instead

### Module Structure Contract

Every module must expose an `index` file that explicitly declares its public API.
Only what is exported from `index` is considered stable and consumable by other modules.
Everything else inside the module is private.

---

## Cross-Cutting Concerns

| Concern | Location | Notes |
|---|---|---|
| Authentication | `modules/auth` → exported middleware | Consumed by other modules via public API |
| Authorization | Per-route preHandler in each module | Role/permission check before controller |
| Validation | DTO layer per module | Input validated at route, output shaped at controller |
| Error handling | `core/middlewares/errorHandler` | Catches all thrown errors globally |
| Logging | `core/utils/logger` | Structured log (JSON in production) |
| Response format | `core/utils/response` | Uniform `{ success, data, meta }` envelope |
| Scheduling | `core/plugins/schedule.plugin.ts` | Periodic jobs via `@fastify/schedule` + `toad-scheduler` |

---

## Dependency Graph (Example)

```
core          ← all modules may depend on core
  │
  └── auth          dependsOn: []
        │
        └── user          dependsOn: [auth]
              │
              └── product       dependsOn: [auth, user]
```

Disabling `auth` will cause the loader to reject `user` and `product` at startup.

---

## Environment & Configuration

- All configuration read from environment variables at startup
- Environment schema is validated at boot — application exits immediately on missing or
  invalid values (fail-fast)
- No hardcoded values in application code
- Module-specific config lives inside the module (`{module}.config`)
- Shared/global config lives in `core/config/`

---

## Error Handling Strategy

- Services throw typed domain errors (e.g. `NotFoundError`, `ConflictError`)
- Controllers never catch errors — they propagate to the global error handler
- Global error handler maps error type to HTTP status code and uniform response shape
- Unexpected errors return `500` and are fully logged server-side

---

## API Design

- RESTful HTTP API
- Versioned routes: `/api/v1/{module}/...`
- Request body and response shape validated and documented via schema (e.g. JSON Schema,
  Zod)
- API documentation auto-generated from schemas (e.g. Swagger / OpenAPI)

---

## Implementation Reference (TypeScript / Node.js)

> This section defines the implementation stack for this project.

### Language & Runtime

- **Language**: TypeScript 5 (strict mode, NodeNext ESM)
- **Runtime**: [Node.js](https://nodejs.org) >= 20
- **Dev execution**: `tsx` with `--import tsx/esm` — no build step needed during development
- **Production**: compiled to `dist/` via `tsc`, then run with `node`
- **Import paths**: use `.js` extension even for `.ts` source files (NodeNext ESM convention — tsx resolves `.js` → `.ts` transparently at dev time)

### Framework

- **HTTP Framework**: [Fastify](https://fastify.dev)
  - Chosen for: schema-based validation, plugin encapsulation, high performance

### Ecosystem (Packages)

#### Core Framework & Server
| Package | Purpose |
|---|---|
| [fastify](https://fastify.dev) | HTTP framework |
| [@fastify/autoload](https://github.com/fastify/fastify-autoload) | Auto-register plugins and routes |
| [@fastify/sensible](https://github.com/fastify/fastify-sensible) | Sane HTTP error helpers |

#### Security & Auth
| Package | Purpose |
|---|---|
| [@fastify/jwt](https://github.com/fastify/fastify-jwt) | JWT sign & verify |
| [@fastify/cors](https://github.com/fastify/fastify-cors) | CORS headers |
| [@fastify/rate-limit](https://github.com/fastify/fastify-rate-limit) | Rate limiting |
| [@fastify/helmet](https://github.com/fastify/fastify-helmet) | HTTP security headers |
| [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | Password hashing (pure JS, no native deps) |

#### Validation
| Package | Purpose |
|---|---|
| [zod](https://zod.dev) | Schema validation for DTO and env |
| [@fastify/swagger](https://github.com/fastify/fastify-swagger) | OpenAPI spec generation |
| [@fastify/swagger-ui](https://github.com/fastify/fastify-swagger-ui) | Swagger UI |

#### Database
| Package | Purpose |
|---|---|
| [prisma](https://www.prisma.io) | ORM + migration |
| [@prisma/client](https://www.prisma.io/docs/orm/reference/prisma-client-reference) | Type-safe DB client |

#### Logging
| Package | Purpose |
|---|---|
| [pino](https://getpino.io) | Structured logger (built into Fastify) |
| [pino-pretty](https://github.com/pinojs/pino-pretty) | Human-readable logs in development |

#### Scheduling
| Package | Purpose |
|---|---|
| [@fastify/schedule](https://github.com/fastify/fastify-schedule) | Periodic job scheduler plugin |
| [toad-scheduler](https://github.com/kibertoad/toad-scheduler) | Job scheduler engine (SimpleIntervalJob, CronJob) |

#### Testing
| Package | Purpose |
|---|---|
| [vitest](https://vitest.dev) | Unit & integration testing |
| [supertest](https://github.com/ladjs/supertest) | HTTP integration testing |

#### Tooling
| Package | Purpose |
|---|---|
| [dotenv](https://github.com/motdotla/dotenv) | Load `.env` file |
| [typescript](https://www.typescriptlang.org) | TypeScript compiler (`tsc`) |
| [tsx](https://github.com/privatenumber/tsx) | Zero-build TypeScript dev execution |
| [typescript-eslint](https://typescript-eslint.io) | TypeScript-aware ESLint rules |
| [eslint](https://eslint.org) | Linting |
| [prettier](https://prettier.io) | Code formatting |

> Full Fastify ecosystem: https://fastify.dev/ecosystem/

---

## AI Agent Notes

> This section is intended to help AI agents (Copilot, Cursor, Claude, etc.) understand
> the conventions of this codebase.

- **Never** import directly from inside another module — always use its `index` file
- **Never** put business logic in a controller or repository
- **Never** put ORM/DB calls in a service — delegate to repository
- **Never** let an entity import from ORM, framework, or HTTP layer
- **Always** throw a typed error from service — never return `null` for not-found cases
- **Always** add a new feature inside its own module folder following the existing layer structure
- **Always** export new public APIs via the module's `index` file
- **Always** declare a new module in `registry/module.registry.ts` before using it
- **Import paths** in TypeScript source always use `.js` extension (NodeNext ESM — tsx resolves them to `.ts` at dev time)
- **Types**: export repository interfaces (`IAuthRepository`, `IUserRepository`) from `repositories/X.repository.ts` and re-export via `index.ts` as `export type { ... }`
- When adding a module that depends on another, add it to `dependsOn[]` in the registry
- **Scheduled jobs**: Jobs must be registered in `module.ts` using `fastify.scheduler.addSimpleIntervalJob()` or `fastify.scheduler.addCronJob()` — never import scheduler directly from `@fastify/schedule`
- **Job files**: Place job definitions in `src/modules/{module}/jobs/` folder with naming convention `{action}.job.ts`
- DTO files: `{action}.request.dto` for input, `{name}.response.dto` for output
- Entity files contain domain logic only — treat them as pure functions / value objects
