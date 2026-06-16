# Versioning: Semantic Versioning & Changelog Management

FastNG uses **Semantic Versioning** ([semver.org](https://semver.org/)) to track all changes with clear rules for when to bump versions and what must accompany each release.

## Semantic Versioning Format

```
MAJOR.MINOR.PATCH
```

- **MAJOR**: Incompatible architecture changes, breaking API changes, fundamental module pattern changes
- **MINOR**: Backward-compatible feature additions (new modules, new core utilities, new error types, new plugins)
- **PATCH**: Backward-compatible bug fixes, documentation updates, refactoring, dependency updates

## Version Bumping Workflow

### Development Phase (Before Commit)

- Changes accumulate in the "Unreleased Changes" section in `VERSION.md`
- Version number stays the same
- Changes are grouped by type: Added, Changed, Fixed, Deprecated, Removed, Security

### At Commit Time (When Ready to Release)

1. Determine version bump:
   - **New architecture pattern** or **breaking change** → MAJOR
   - **New feature/module/plugin/utility** → MINOR
   - **Bug fix, docs, refactor** → PATCH

2. Move "Unreleased Changes" section to new versioned section in `VERSION.md`

3. Create fresh "Unreleased Changes" section

4. Update **Current Version** at the top of `VERSION.md`

5. **Important**: Tutorial MUST accompany any **MAJOR or MINOR** change

### Example Workflow

If current version is `1.0.0` and you add a new module (MINOR):

1. Code is complete with accompanying tutorial
2. In `VERSION.md`, move unreleased items to new `## [1.1.0] — 2026-06-20`
3. Set "Current Version" to `1.1.0`
4. Create fresh "Unreleased Changes" section with empty categories

---

## When to Bump Each Version Level

### When to MAJOR bump

- Fundamental change to module structure or registry system
- Architectural pattern change affecting all new modules
- Breaking change to layer responsibilities or dependency direction rules
- Significant refactoring of core systems (database, auth, error handling)
- Removal of a previously documented pattern or public API

**Example commits:**
```
Add: new layer interceptor pattern (changes how all modules register)
Break: service layer can no longer access request directly
Change: module registry now requires versioning declaration
```

### When to MINOR bump

- New module (with accompanying tutorial)
- New core utility/plugin (email.plugin.ts, slugify.ts, etc.)
- New error type (QuotaExceededError, GoneError, etc.)
- New database driver support (PostgreSQL, MongoDB, etc.)
- New scheduled job system or significant enhancement
- New validation pattern or authentication mechanism

**Example commits:**
```
Add tutorial: custom-middleware-pattern.md (+ implementation)
Add plugin: email.plugin.ts with nodemailer integration
Add error: QuotaExceededError (429 status code)
```

### When to PATCH bump

- Bug fix in existing code (NotFoundError not thrown, etc.)
- Documentation clarification within existing tutorial
- Refactoring without pattern change
- Dependency update
- Code style/lint fix
- Performance optimization

**Example commits:**
```
Fix: NotFoundError not thrown when repository returns null
Update tutorial: 06-menambah-dto-validasi.md (clarify pattern)
Refactor: extract slugify helper from posts module
```

---

## Rules for VERSION.md Maintenance

### 🔴 MUST

- Update `VERSION.md` with **every commit** that changes code or documentation
- Group changes by type: Added, Changed, Fixed, Deprecated, Removed, Security
- Use semantic versioning consistently (MAJOR.MINOR.PATCH)
- Include tutorial link for every MAJOR/MINOR change: `tutorial/NN-{topic}.md`
- **Tutorial MUST accompany any MAJOR or MINOR version bump** — don't commit without it

### 🟡 SHOULD

- Keep "Current Version" at top in sync with latest versioned section
- Write clear, user-focused change descriptions (not just commit messages)
- Date every released version in format: `YYYY-MM-DD`
- Group related changes together logically within each category

### 🟢 NICE-TO-HAVE

- Add theme or release notes for major releases (e.g., "Focus: multi-repo patterns")
- Link to related GitHub issues/PRs if tracking exists
- Add migration guides for MAJOR breaking changes

---

## Commit Message Format

When committing changes that affect `VERSION.md`:

```
{Type}: {description}

- code: what changed in the source code
- tutorial: tutorial/NN-{topic}.md (if MAJOR/MINOR, otherwise omit)
- version: MAJOR | MINOR | PATCH

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

### Example: MINOR (New Module)

```
Add: posts module with full CRUD operations

- code: new module at src/modules/posts/ (entity, repository, service, controller, routes)
- tutorial: tutorial/17-menambah-modul-baru.md (extended with posts example)
- version: MINOR

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

### Example: PATCH (Bug Fix)

```
Fix: NotFoundError not thrown when post not found

- code: src/modules/posts/services/post.service.ts (line 45, convert null to throw)
- version: PATCH

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

## Changelog Format in VERSION.md

### Unreleased Changes (Active Development)

```markdown
## Unreleased Changes

Changes listed here are uncommitted. Once committed, they will be moved to a version entry below.

### Added
- Feature 1
- Feature 2 (tutorial: tutorial/NN-*.md)

### Changed
- Enhancement 1

### Fixed
- Bug fix 1

### Deprecated
- Old pattern (use X instead, see tutorial/XX-*.md)

### Removed
- Old system Y

### Security
- Security fix (if applicable)
```

### Released Version Entry

```markdown
## [1.2.0] — 2026-07-15

**Theme or focus area of release** (optional)

### Added
- Feature 1 (tutorial: tutorial/NN-{topic}.md)
- Feature 2

### Changed
- Enhancement 1

### Fixed
- Bug fix 1

### Deprecated
- Old pattern (use X instead, see tutorial/XX-*.md)

### Removed
- Removed old system Y

### Security
- Security fix (CVE-XXXX if applicable)
```

---

## FAQ

### Q: Do I update VERSION.md for small commits?

**A:** Yes, always. Even small bug fixes are PATCH version bumps. Consistency in changelog tracking matters for understanding project evolution. Every commit that changes code/docs gets a VERSION.md entry.

### Q: Should VERSION.md be in git?

**A:** Yes, always. `VERSION.md` is the canonical versioning source and changelog. It must be version-controlled and committed with every change.

### Q: What if code changes require version bump but no tutorial yet?

**A:** Don't commit the code yet. Tutorial MUST be done first (for MAJOR/MINOR changes). This ensures every significant feature has documentation. PATCH commits don't require tutorials.

### Q: Can I group multiple changes into one version bump?

**A:** Yes. If you make multiple MINOR changes before committing, accumulate them all in "Unreleased Changes", then bump MINOR once. All go into the same version entry.

### Q: What if I realize a MINOR change should have been MAJOR?

**A:** If caught before commit, fix it and re-bump as MAJOR. If caught after commit, you can either revert+recommit as MAJOR (preferred), or add a note in the next version explaining the mismatch (acceptable but not ideal).

### Q: Who writes the changelog entry?

**A:** Whoever makes the commit writes the VERSION.md update. This keeps the "why" fresh in their mind and ensures accuracy.

---

## Integration with Tutorial System

- Every **MAJOR/MINOR** bump MUST have a corresponding tutorial file in `tutorial/NN-*.md`
- Tutorial must be in **Bahasa Indonesia**
- Changelog entry should link to the tutorial: `tutorial/NN-{topic}.md`
- Tutorial is the single source of truth for how the new feature/pattern works; VERSION.md is the "what changed" summary

See `@.claude/rules/documentation.md` for tutorial requirements and format.

---

## Common Version Bump Scenarios

| Scenario | Bump | Reason | Tutorial Needed? |
|---|---|---|---|
| Add new module following existing pattern | MINOR | Backward-compatible feature | Yes |
| Change module folder structure | MAJOR | Breaking change | Yes |
| Fix bug in service | PATCH | Bug fix | No |
| Update existing tutorial | PATCH | Docs update | No |
| Add new error type | MINOR | New feature | No |
| Refactor controller without changing behavior | PATCH | Code cleanup | No |
| Add new plugin to core | MINOR | New feature | Maybe (if it's a core capability worth documenting) |
| Fix typo in code | PATCH | Minor fix | No |

---

## Version History Location

`VERSION.md` is the single source of truth for all version and changelog information. Read it to understand:
- Current version number
- What's been released and when
- What changes are uncommitted (Unreleased Changes section)

For this project's full version archive, see `VERSION.md` at the root of the repository.
