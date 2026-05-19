# Architecture Plan

## Overview

This project follows a **Modular Clean Architecture** pattern, combining principles from
Domain-Driven Design (DDD) and Clean Architecture. The codebase is organized into
self-contained modules, each with its own layered structure (Controller → Service →
Repository → Entity). Modules can declare dependencies on other modules and can be
enabled or disabled via a central registry without touching application code.

This architecture is implemented for JavaScript/TypeScript services using Fastify.

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
│   │   │   └── env.config.js      # Zod env schema, fail-fast on invalid vars
│   │   ├── database/
│   │   │   ├── drivers/
│   │   │   │   ├── prisma.driver.js    # PrismaClient singleton
│   │   │   │   └── mongoose.driver.js  # Mongoose connect/disconnect
│   │   │   ├── models/                 # Mongoose schemas (MongoDB only)
│   │   │   │   ├── user.model.js
│   │   │   │   └── refresh-token.model.js
│   │   │   └── index.js               # connectDb() / disconnectDb() by DB_DRIVER
│   │   ├── middlewares/
│   │   │   └── error-handler.js       # Global error → HTTP status mapping
│   │   ├── plugins/                   # Fastify plugins (wrapped with fastify-plugin)
│   │   │   ├── db.plugin.js           # DB connect + fastify.db decorator
│   │   │   ├── jwt.plugin.js          # @fastify/jwt + fastify.authenticate decorator
│   │   │   ├── cors.plugin.js
│   │   │   ├── helmet.plugin.js
│   │   │   ├── rate-limit.plugin.js
│   │   │   └── swagger.plugin.js      # OpenAPI spec + Swagger UI at /docs
│   │   └── utils/
│   │       ├── errors.js              # NotFoundError, ConflictError, UnauthorizedError, dll
│   │       └── response.js            # successResponse() / errorResponse()
│   │
│   ├── modules/                       # Feature modules — each is self-contained
│   │   ├── auth/
│   │   │   ├── module.js              # Entry point — registers routes
│   │   │   ├── index.js              # Public API — only file other modules may import
│   │   │   ├── entities/
│   │   │   │   └── auth.entity.js
│   │   │   ├── dto/
│   │   │   │   ├── register.request.dto.js
│   │   │   │   ├── login.request.dto.js
│   │   │   │   └── auth.response.dto.js
│   │   │   ├── repositories/
│   │   │   │   ├── auth.prisma.repository.js
│   │   │   │   ├── auth.mongo.repository.js
│   │   │   │   └── auth.repository.js  # Factory: returns impl by DB_DRIVER
│   │   │   ├── services/
│   │   │   │   └── auth.service.js
│   │   │   ├── controllers/
│   │   │   │   └── auth.controller.js
│   │   │   └── routes/
│   │   │       └── auth.routes.js
│   │   │
│   │   ├── users/
│   │   │   ├── module.js
│   │   │   ├── index.js
│   │   │   ├── entities/
│   │   │   │   └── user.entity.js
│   │   │   ├── dto/
│   │   │   │   ├── update-profile.request.dto.js
│   │   │   │   └── user.response.dto.js
│   │   │   ├── repositories/
│   │   │   │   ├── user.prisma.repository.js
│   │   │   │   ├── user.mongo.repository.js
│   │   │   │   └── user.repository.js  # Factory
│   │   │   ├── services/
│   │   │   │   └── user.service.js
│   │   │   ├── controllers/
│   │   │   │   └── user.controller.js
│   │   │   └── routes/
│   │   │       └── user.routes.js
│   │   │
│   │   └── welcome/
│   │       ├── module.js
│   │       ├── index.js
│   │       ├── controllers/
│   │       │   └── welcome.controller.js
│   │       └── routes/
│   │           └── welcome.routes.js
│   │
│   ├── registry/
│   │   ├── module.registry.js         # Declares all modules: name, enabled, dependsOn[]
│   │   └── module.loader.js           # Dep validation + topological sort + register
│   │
│   ├── app.js                         # Builds Fastify instance (plugins + modules)
│   └── server.js                      # Entry point — starts HTTP server
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

## Implementation Reference (JavaScript / Node.js)

> This section defines the implementation stack for this project.

### Language & Runtime

- **Language**: JavaScript (ESModule)
- **Runtime**: [Node.js](https://nodejs.org) >= 20

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
| [bcrypt](https://github.com/kelektiv/node.bcrypt.js) | Password hashing |

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

#### Testing
| Package | Purpose |
|---|---|
| [vitest](https://vitest.dev) | Unit & integration testing |
| [supertest](https://github.com/ladjs/supertest) | HTTP integration testing |

#### Tooling
| Package | Purpose |
|---|---|
| [dotenv](https://github.com/motdotla/dotenv) | Load `.env` file |
| [tsx](https://github.com/privatenumber/tsx) | Run TypeScript / ESM without build step |
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
- **Always** declare a new module in `registry/module.registry` before using it
- When adding a module that depends on another, add it to `dependsOn[]` in the registry
- DTO files: `{action}.request.dto` for input, `{name}.response.dto` for output
- Entity files contain domain logic only — treat them as pure functions / value objects
