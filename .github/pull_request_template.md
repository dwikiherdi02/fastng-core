## Description
<!-- Provide a clear and concise description of the changes introduced in this PR -->

## Type of Change
- [ ] ✨ Feature
- [ ] 🐛 Bug Fix
- [ ] ♻️ Refactor
- [ ] 📝 Documentation
- [ ] 🚀 Performance Improvement

## Architecture Checklist
*Please ensure your changes adhere to the Modular Clean Architecture defined in `ARCHITECTURE.md` and `.github/copilot-instructions.md`:*

- [ ] **Layering**: Follows Controller → Service → Repository → Entity flow.
- [ ] **Business Logic**: No business logic in Controllers or Repositories (placed in Services).
- [ ] **Data Access**: No DB/ORM calls in Services (placed in Repositories).
- [ ] **Module Communication**: Only imports from other modules' `index` files (Public API).
- [ ] **Dependency Direction**: Dependencies flow inward (outer layers depend on inner).
- [ ] **Entities**: Pure domain objects with no imports from ORM, framework, or HTTP layer.
- [ ] **Error Handling**: Services throw typed domain errors; Controllers do not catch them.
- [ ] **Import Paths**: All TypeScript imports use `.js` extensions (NodeNext ESM).

## Quality Assurance
- [ ] **Security**: Checked for SQL Injection, XSS, SSRF, and sensitive data exposure.
- [ ] **Performance**: No N+1 queries or inefficient loops introduced.
- [ ] **Maintainability**: Follows SOLID principles and naming consistency.
- [ ] **Testing**: Unit/Integration tests added or updated.

## Screenshots / Logs
<!-- Add screenshots or logs if applicable -->

## Related Issues
<!-- e.g., Fixes #123 -->
