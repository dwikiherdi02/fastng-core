# Documentation: Tutorial Requirements & Authoring

FastNG maintainability depends on keeping the `tutorial/` folder synchronized with actual code patterns and architecture. Every fundamental change **must** have a corresponding tutorial (new or updated).

## What Counts as "Fundamental"?

A change is **fundamental** (requires a tutorial) if it introduces:

- ✅ **New architecture pattern** (e.g., a new way to handle multi-module composition, a new layer responsibility pattern)
- ✅ **New core utility or plugin** (e.g., adding a new required feature to `core/`)
- ✅ **New module structure** (if the existing skeleton is obsolete)
- ✅ **New error handling approach** (beyond just adding an error class)
- ✅ **New authentication/authorization mechanism** (beyond just adding RBAC to existing framework)
- ✅ **New database driver support** (beyond just switching between existing drivers)
- ✅ **New scheduled job system** (if fundamentally different from toad-scheduler pattern)
- ✅ **Changes to env var handling, config loading, or startup sequence**
- ✅ **Changes to module registry or loader logic**

**Not fundamental** (no tutorial needed):
- ❌ Routine bug fix (e.g., fixing a data mapping bug in a repository)
- ❌ Adding a new module (the pattern already exists; just follow `01-menambah-modul-baru.md`)
- ❌ Adding a new error type (the pattern already exists; just follow `07-menambah-custom-error.md`)
- ❌ Refactoring existing code without changing pattern (e.g., extracting a function)
- ❌ Performance optimization that doesn't change the public interface
- ❌ Updating dependencies (unless the API changes significantly)

## Tutorial File Naming & Language

Tutorials live in `tutorial/` folder (root level). **All tutorial files MUST be in Bahasa Indonesia.**

```
tutorial/
├── 01-menambah-modul-baru.md                      ← Bahasa Indonesia
├── 02-mengaktifkan-menonaktifkan-modul.md         ← Bahasa Indonesia
├── ...existing 16 files (all Indonesian)...
├── 17-{next-topic-in-indonesian}.md               ← NEW, must be Indonesian
└── 18-{another-topic-in-indonesian}.md            ← NEW, must be Indonesian
```

**Naming convention:**
- Prefix: `NN-` (two digits, sequential: 01, 02, ..., 99)
- Title: **Bahasa Indonesia** (kebab-case), short and descriptive
- Format: `.md` (Markdown)
- Language: **ENTIRE FILE MUST BE IN BAHASA INDONESIA** (except code samples, file paths, and code identifiers)
- Example: `17-menambah-request-interceptor.md`, `18-wrapper-transaksi-database-custom.md`

**Language Rule (MANDATORY):**
```
❌ WRONG: Tutorial written in English
✅ CORRECT: Tutorial written in Bahasa Indonesia (except code/paths)

All tutorial files in the tutorial/ folder MUST use Bahasa Indonesia for:
- Section titles (Tujuan, Kapan, Prasyarat, Pengenalan, Alur, Langkah, Contoh, Aturan, Verifikasi, Referensi, Catatan, Lihat Juga)
- Explanations and prose
- Code comments (when adding tutorial-specific comments)
- Examples and descriptions

Code samples, file paths, function names, and class names remain in their original form (English).

**Rationale**: Tutorials are the team's primary learning resource. Indonesian ensures accessibility to all team members regardless of English proficiency. This is a team decision, not a suggestion.
```

## Tutorial Structure & Format

Every tutorial is written in **Bahasa Indonesia** (mirror of English source code for accessibility to broader team). Follow this structure:

```markdown
# {NN-Title-in-Indonesian}

**Tujuan**: One-line description of what this tutorial teaches.

**Kapan digunakan**: When/why a developer would follow this tutorial.

**Prasyarat**: Any dependencies (modules that must be enabled, plugins that must exist, env vars needed, etc.).

## Pengenalan (Introduction)

Paragraph or two explaining the concept, with rationale. Why is this pattern/feature needed? What problem does it solve?

## Alur/Mekanisme (Flow/Mechanism)

Step-by-step explanation of how it works, with ASCII diagrams or tables where helpful.

Example:
```
Request → [Interceptor] → [Handler] → [Response]
   ↓
   (logs, modifies, validates)
```

## Langkah-Langkah (Step-by-Step Walkthrough)

Numbered steps with file paths, code examples, and exact commands. Each step should be actionable without ambiguity.

### Langkah 1: Buat file X

Explanation + code sample + command:
```bash
bun run db:push
```

### Langkah 2: Edit file Y

Explanation + code diff/sample.

... (as many steps as needed)

## Contoh Lengkap (Full Example)

Complete, minimal, runnable example showing the pattern in action. Readers should be able to copy-paste and it works.

Example module or code snippet that combines all steps.

## Aturan/Pedoman (Rules/Guidelines)

Do's and don'ts specific to this pattern. Use tables or bullets.

| ✅ Do | ❌ Don't |
|---|---|
| Use X for Y | Use X for Z |

## Verifikasi (Verification/Testing)

How to verify the implementation works. Include:
- What to check in logs
- What API endpoint to hit
- What response to expect
- How to manually test if needed

## Referensi Kode Aktual (Code References)

Real file paths in the codebase demonstrating this pattern:
- `src/modules/auth/module.ts` — example of [pattern] at line 45
- `src/core/plugins/jwt.plugin.ts` — example of [pattern]

## Catatan (Notes)

Edge cases, gotchas, performance implications, or future improvements.

## Lihat Juga (See Also)

Links to related tutorials or rules files.
```

## Example: Completed Tutorial

File: `tutorial/03-cara-kerja-jwt-refresh-token.md` (existing, mirror it)

- **Structure**: Alur/mekanisme, tabel perbandingan token, code samples dari `AuthService`, keamanan best practices, env var config
- **Indonesian**: Fully in Indonesian, clear for any team member to understand
- **Code samples**: Real, from actual codebase (not hypothetical)
- **Verification**: How to test login/logout/refresh flow
- **Reference**: Points to `src/modules/auth/services/auth.service.ts`, `src/core/plugins/jwt.plugin.ts`

## Maintaining Tutorials

When updating a tutorial:

1. **If the pattern hasn't changed fundamentally**, update the existing tutorial (add clarifications, fix mistakes, add new examples).
2. **If the pattern has changed or been replaced**, add a new tutorial documenting the new pattern, and add a "Deprecated" section to the old one linking to the new one.
3. **Keep code samples in sync**: After code changes, verify all code samples still match the actual codebase. If not, update both the code and the tutorial.

**Never let a tutorial drift** from actual implementation — it becomes a trap for future developers.

## Who Writes Tutorials?

Ideally, whoever makes the fundamental change should write or update the tutorial (as part of the change, not as an afterthought). This ensures:
- Rationale is fresh in their mind
- They catch their own mistakes while explaining
- The team learns immediately

If a tutorial is unclear or incomplete, **treat it as a bug** and fix it promptly.

## Skill Files Reference Tutorials

Skills in `.claude/skills/` point back to tutorials, not the reverse:

```
Skill: add-module
  → "Source tutorial: tutorial/01-menambah-modul-baru.md"
  → Walkthrough with steps
  → Points reader to tutorial for full details/samples
```

This makes tutorials the **single source of truth** for deep learning, and skills the **quick checklist** for execution.

## Integration with CI/CD (Optional Future)

Future possibilities:
- Linter that checks: if a file in `src/core/` or `src/registry/` changed in a PR, require a tutorial file in the commit message or PR description.
- Automated check that tutorial code samples can be extracted and compile (catch outdated examples).
- Audit script listing all fundamental patterns in code but not in tutorials.

For now, rely on code review + developer discipline.

## Summary

**When you finish a fundamental change:**

1. ✅ Code is complete and tested
2. ✅ Create or update `tutorial/NN-{topic}.md` in Indonesian
3. ✅ Update matching `.claude/skills/{name}/SKILL.md` (if needed) to point to the tutorial
4. ✅ Update `.claude/rules/{topic}.md` (if needed) to reference the tutorial
5. ✅ Commit both code and tutorial together

**No fundamental feature ships without a tutorial.**
