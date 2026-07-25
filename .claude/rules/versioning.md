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

**There is no "Unreleased Changes" section.** Every change goes straight into a real, numbered version entry in `VERSION.md`. The only question is whether that entry is a *new* one or an *existing uncommitted* one.

### Step 1 — Classify the change

Judge by the **intent** of the change, not by its size:

- **New architecture pattern** or **breaking change** → MAJOR
- **New feature/module/plugin/utility** → MINOR
- **Bug fix, docs, refactor, dependency bump** → PATCH

### Step 2 — Is the top version entry already committed to git?

Check whether the newest entry in `VERSION.md` exists in the last commit:

```bash
git show HEAD:VERSION.md    # compare against the working copy
# or simply:
git status --short VERSION.md   # modified & top entry absent from HEAD ⇒ uncommitted entry
```

| Situation | What to do |
|---|---|
| Top entry **is** in `HEAD` (all released) | **Create a new version entry** — bump from the top entry by the level from Step 1 |
| Top entry is **not yet committed** | **Append into that same entry** (see Step 3) |

### Step 3 — Appending to an uncommitted entry (level comparison)

When an uncommitted version entry already exists, new changes are folded into it — do **not** create a second entry. Then compare levels (`MAJOR > MINOR > PATCH`):

- **New change is lower than or equal to the existing level** → version number stays as-is; just add the bullets under the right category.
- **New change is higher than the existing level** → recompute the version number from the **last committed version** using the higher level, and rename the entry.

Also refresh the entry's date to today whenever you touch it.

#### Level-comparison examples

Last committed version: `4.1.0`.

| Uncommitted entry | New change | Result |
|---|---|---|
| `4.2.0` (MINOR) | PATCH | stays `4.2.0`, bullet added under **Fixed** |
| `4.2.0` (MINOR) | MINOR | stays `4.2.0`, bullet added under **Added** |
| `4.2.0` (MINOR) | MAJOR | renamed to `5.0.0` (recomputed from `4.1.0`) |
| `4.1.1` (PATCH) | MINOR | renamed to `4.2.0` (recomputed from `4.1.0`) |
| `5.0.0` (MAJOR) | MINOR or PATCH | stays `5.0.0` |

**Never** recompute from the uncommitted number itself — always from the last committed version. `4.2.0` + a MAJOR change is `5.0.0`, not `6.0.0`.

### Step 4 — Sync the header

Update **Current Version** at the top of `VERSION.md` to match the top entry, and set **Last Updated** to today.

**Important**: a tutorial MUST accompany any **MAJOR or MINOR** entry — including when a PATCH-level entry gets promoted to MINOR/MAJOR by a later change.

### Example Workflow

Current version `1.0.0`, all committed. You add a new module (MINOR):

1. Code is complete with accompanying tutorial
2. Add `## [1.1.0] — 2026-06-20` at the top of `VERSION.md` with the change bullets
3. Set **Current Version** to `1.1.0`

Then, before committing, you also fix a bug (PATCH):

4. `1.1.0` is still uncommitted and PATCH < MINOR → keep `1.1.0`, add the bullet under **Fixed**

Then, still before committing, you break the module registry contract (MAJOR):

5. MAJOR > MINOR → rename the entry to `2.0.0` (recomputed from the committed `1.0.0`), keep all existing bullets, add the breaking-change bullet, and set **Current Version** to `2.0.0`

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

- Update `VERSION.md` with **every change** to code or documentation — write it directly into a numbered version entry, never into a staging/"unreleased" area
- Fold new changes into the top entry while it is still uncommitted; only create a new entry once the top one is in `HEAD`
- When folding in, re-evaluate the entry's level: keep the number if the new change is lower/equal, recompute it from the last committed version if the new change is higher
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

There is exactly one entry shape — a numbered version. An entry that isn't committed yet uses the same format as a released one; it simply may still be renamed or extended until it lands in `HEAD`.

### Version Entry

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

**A:** Yes — that's the default. As long as the top entry is still uncommitted, every further change is folded into it. The number only moves if one of those changes is a *higher* level than what the entry currently reflects.

### Q: Why no "Unreleased Changes" section?

**A:** It was redundant bookkeeping: the entry had to be renamed and moved at commit time anyway. Writing the numbered entry immediately means `VERSION.md` always shows the real version the working tree represents, and git already tells you what is and isn't released.

### Q: How do I know whether the top entry is committed?

**A:** `git show HEAD:VERSION.md` and look for the entry heading. If it isn't there, the entry is uncommitted and you append into it. Amending a commit doesn't change this — once an entry is in `HEAD`, treat it as released.

### Q: What if I realize a MINOR change should have been MAJOR?

**A:** If the entry is still uncommitted, just rename it — recompute from the last committed version (that's exactly the Step 3 rule). If it's already committed, either revert+recommit as MAJOR (preferred), or add a note in the next version explaining the mismatch (acceptable but not ideal).

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
- What the pending change set is (the top entry, if it isn't in `HEAD` yet — compare with `git show HEAD:VERSION.md`)

For this project's full version archive, see `VERSION.md` at the root of the repository.
