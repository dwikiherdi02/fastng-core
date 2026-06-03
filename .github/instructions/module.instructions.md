# Module Development Instructions

**Important:** All responses and feedback based on these instructions must be written in **Indonesian**.

This document provides guidance on creating and implementing new modules within the FastNG framework, ensuring adherence to the Modular Clean Architecture.
// ...existing code...

## 1. Module Structure
Every new module must be created under `src/modules/{module-name}/` and follow this exact directory structure:

- `index.ts`: The Public API. Only export what other modules need.
- `module.ts`: Module entry point. Registers routes and scheduled jobs.
- `entities/`: Pure domain objects. No ORM or framework imports.
- `dto/`: Data Transfer Objects.
    - `{action}.request.dto.ts`: Input validation (Zod).
    - `{name}.response.dto.ts`: Output serialization.
- `services/`: Business logic layer. Operates on Entities. Throws typed domain errors.
- `repositories/`: Data access layer.
    - `{name}.repository.ts`: Interface definition and factory.
    - `{name}.prisma.repository.ts`: Prisma implementation.
    - `{name}.mongo.repository.ts`: Mongoose implementation.
- `controllers/`: HTTP request handling. No business logic.
- `routes/`: Route definitions and schema attachment.
- `jobs/`: Scheduled tasks (if applicable), named `{action}.job.ts`.

## 2. Implementation Rules

### Layer Responsibilities
- **Controller**: Receives request $\rightarrow$ calls Service $\rightarrow$ sends response using Response DTO.
- **Service**: Contains all business logic $\rightarrow$ calls Repository $\rightarrow$ returns Entity.
- **Repository**: Handles DB queries $\rightarrow$ maps DB result to Entity.
- **Entity**: Pure domain logic.

### Module Communication
- **Strict Public API**: Never import from `src/modules/other-module/services/...`. Always import from `src/modules/other-module/index.js`.
- **Dependency Direction**: Outer layers (Controller) depend on inner layers (Service $\rightarrow$ Repository $\rightarrow$ Entity).

### Technical Requirements
- **Import Paths**: Always use `.js` extensions for TypeScript imports (e.g., `import { UserService } from './user.service.js'`).
- **Error Handling**: Services must throw typed errors from `core/utils/errors.ts`. Do not return `null` or `undefined` for "not found" cases.
- **Registry**: Every new module must be declared in `src/registry/module.registry.ts` with its `name`, `enabled` status, and `dependsOn` array.

## 3. Workflow for Adding a New Module
1. Create the folder structure in `src/modules/`.
2. Define the Entity and Repository interface.
3. Implement the Repository (Prisma/Mongo).
4. Implement the Service with business logic.
5. Create DTOs for requests and responses.
6. Implement the Controller and Routes.
7. Export the public API in `index.ts`.
8. Register the module in `src/registry/module.registry.ts`.
