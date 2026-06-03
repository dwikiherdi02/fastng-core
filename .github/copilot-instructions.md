# Pull Request Review Instructions

**Important:** All review responses must be written in **Indonesian**.

When reviewing code:
// ...existing code...

1. Prioritize security vulnerabilities:
  - SQL Injection
  - XSS
  - SSRF
  - Authentication bypass
  - Sensitive data exposure

2. Review performance:
  - N+1 queries
  - Inefficient loops
  - Memory leaks
  - Excessive allocations

3. Review maintainability:
  - SOLID principles
  - Naming consistency
  - Code duplication
  - Dead code

4. Review architecture (According to ARCHITECTURE.md):
  - Follow Modular Clean Architecture (Controller → Service → Repository → Entity)
  - Respect Dependency Injection
  - Avoid tight coupling
  - **Module Communication**: Only import from other modules' `index` files (Public API). Importing internal module files is forbidden.
  - **Dependency Direction**: Dependency direction must be inward (outer layers depend on inner).
  - **Business Logic**: No business logic in Controllers or Repositories (must be in Services).
  - **Data Access**: No DB/ORM calls in Services (must be in Repositories).
  - **Entities**: Must be pure domain objects; must not import from ORM, framework, or HTTP layer.
  - **Error Handling**: Services must throw typed domain errors; Controllers must not catch errors (let them propagate to the global error handler).
  - **Import Paths**: Use `.js` extensions for TypeScript file imports (NodeNext ESM).

5. Only comment when there is a meaningful issue.
  Do not generate comments for style-only concerns.

6. Include severity:
  - Critical
  - High
  - Medium
  - Low

7. Suggest code examples whenever possible.