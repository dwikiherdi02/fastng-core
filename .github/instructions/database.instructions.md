# Database & Repository Instructions

**Important:** All responses and feedback based on these instructions must be written in **Indonesian**.

This document outlines the standards for data access and database management in the FastNG framework.
// ...existing code...

## 1. Repository Pattern
To maintain database independence, all data access must be abstracted through repositories.

### Repository Structure
- **Interface**: Define the contract in `{name}.repository.ts` (e.g., `IUserRepository`).
- **Implementations**: Create separate files for different drivers:
    - `{name}.prisma.repository.ts` for Prisma.
    - `{name}.mongo.repository.ts` for Mongoose.
- **Factory**: The main repository file should export a factory that returns the correct implementation based on the `DB_DRIVER` environment variable.

## 2. Data Mapping
- **Repository $\rightarrow$ Service**: Repositories must map raw database models (Prisma/Mongoose) into pure **Entities** before returning them to the Service.
- **Service $\rightarrow$ Repository**: Repositories must map Entities back to database models before persisting.

## 3. Database Drivers
- **Prisma**: Use the singleton `PrismaClient` provided in `core/database/drivers/prisma.driver.ts`.
- **Mongoose**: Use the connection logic in `core/database/drivers/mongoose.driver.ts` and define schemas in `core/database/models/`.

## 4. Transactions
- For multi-repository transactions, use the transaction utility provided in `core/database/transaction.ts`.
- Ensure that the transaction context is passed correctly through the service layer to the repositories.

## 5. Rules
- **No DB in Service**: Never call `prisma.user.findUnique()` or `UserModel.find()` directly inside a Service.
- **No Framework in Entity**: Entities must not import from `@prisma/client` or `mongoose`.
