# Version 1.0.0 (Initial Release)

## Project Information

- **Project Name**: fastng-core
- **Version**: 1.0.0
- **License**: MIT
- **Type**: ES Module

## Tech Stack

### Runtime & Language
- **Node.js**: >= 20
- **TypeScript**: 5 (strict mode, NodeNext ESM)

### HTTP Framework
- **Fastify**: 5.8.5

### Database
- **ORM (Relational)**: Prisma 6.8.2 (SQLite, MySQL, PostgreSQL)
- **ODM (MongoDB)**: Mongoose 9.6.3

### Validation & Security
- **Validation**: Zod 3.24.4
- **Authentication**: JWT (@fastify/jwt 10.1.0) + bcryptjs 3.0.3

### API Documentation
- **Swagger**: @fastify/swagger 9.5.0 + @fastify/swagger-ui 5.2.3

### Logging
- **Pino**: built-in Fastify logger with pino-pretty

### Scheduling
- **Scheduler**: @fastify/schedule 6.0.0 + toad-scheduler 4.0.1

### Development
- **Build**: tsx 4.19.0 (zero-build dev server)

## Architecture

**Modular Clean Architecture** combining Domain-Driven Design (DDD) and Clean Architecture principles.

### Key Features
- Self-contained modules with layered structure (Controller → Service → Repository → Entity)
- Multiple database driver support (can be switched via environment variable)
- Centralized module registry with enable/disable capability
- Topological sort for dependency resolution at load time
- Loose coupling between modules via public API
- **Periodic job scheduling** with @fastify/schedule (SimpleIntervalJob, CronJob)

## Core Components

### Core Layer
- **Config**: Environment configuration with Zod validation
- **Database**: Multi-driver support (Prisma + Mongoose)
- **Middlewares**: Global error handler
- **Plugins**: CORS, Helmet, Rate Limit, Swagger, JWT, Database connection, **Schedule**
- **Utils**: Custom error handling and response formatting

### Modules
- **Auth**: Authentication module (register, login, refresh token)
- **Users**: User management module (CRUD, profile update)
- **Welcome**: Basic health check endpoint

## Development Scripts

- `dev`: Run development server with auto-reload
- `start`: Run production build
- `build`: Compile TypeScript to JavaScript
- `db:generate`: Generate Prisma client
- `db:migrate`: Run Prisma migrations
- `db:push`: Push schema to database
- `lint`: ESLint for src/ directory
- `format`: Prettier formatting for src/

## API Endpoints

- **Swagger UI**: `/docs`
- **Health Check**: `/welcome`
- **Auth**: `/auth/register`, `/auth/login`, `/auth/refresh-token`
- **Users**: User management routes (protected)

## New Features (v1.0.0)

### Scheduled Jobs
- Added `@fastify/schedule` plugin for periodic job scheduling
- Support for `SimpleIntervalJob` (interval-based) and `CronJob` (cron expression-based)
- Environment variable `SCHEDULER_ENABLED` to toggle scheduler
- Tutorial guide: `tutorial/16-menambah-scheduled-job.md`

## Status

✅ Initial Release - Version 1.0.0
