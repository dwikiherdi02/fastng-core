# API & Error Handling Instructions

**Important:** All responses and feedback based on these instructions must be written in **Indonesian**.

This document defines the standards for building APIs and handling errors in the FastNG framework.
// ...existing code...

## 1. API Design
- **RESTful**: Use standard HTTP methods (GET, POST, PUT, DELETE, PATCH).
- **Versioning**: All routes must be versioned (e.g., `/api/v1/{module}/...`).
- **Validation**: Use Zod for request body and query validation. Attach the schema to the route definition for automatic Fastify validation and Swagger documentation.
- **Response Format**: Use the uniform response envelope provided by `core/utils/response.ts` (`successResponse` / `errorResponse`).

## 2. Error Handling Strategy
The framework uses a "throw-and-catch-globally" strategy.

### Service Layer
- **Throw Typed Errors**: Services must throw specific domain errors from `core/utils/errors.ts` (e.g., `NotFoundError`, `ConflictError`, `UnauthorizedError`).
- **No Nulls**: Never return `null` or `undefined` to indicate a missing resource; throw a `NotFoundError`.

### Controller Layer
- **No Try-Catch**: Controllers should **not** wrap service calls in try-catch blocks.
- **Propagation**: Let errors propagate naturally to the global error handler.

### Global Error Handler
- Located in `src/core/middlewares/error-handler.ts`.
- Maps typed domain errors to appropriate HTTP status codes.
- Ensures a consistent error response shape for the client.

## 3. DTO (Data Transfer Object) Standards
- **Request DTO**: Validates and sanitizes incoming data.
- **Response DTO**: Shapes the data sent to the client, ensuring sensitive fields (like passwords) are removed.
- **Location**: Place DTOs in the `dto/` folder of the respective module.
