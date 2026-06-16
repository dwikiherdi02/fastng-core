# Documentation Checklist for Fundamental Changes

Use this checklist when you finish a fundamental change (new pattern, new core feature, architecture change).

See @.claude/rules/documentation.md for what counts as "fundamental" and tutorial format requirements.

## Pre-Implementation

- [ ] Read @.claude/rules/documentation.md to confirm if this change is "fundamental"
- [ ] If fundamental, plan for tutorial creation (will do AFTER code is done)

## Post-Implementation (After Code is Complete & Tested)

- [ ] Code change is complete and working
- [ ] All tests pass (if applicable)
- [ ] Code is lint/format clean (`yarn lint`, `yarn format`)
- [ ] Determine tutorial file name: `tutorial/NN-{topic-in-indonesian}.md`
- [ ] Create tutorial file with all sections from the template in @.claude/rules/documentation.md
  - [ ] **Tujuan** (one-line goal)
  - [ ] **Kapan digunakan** (when/why)
  - [ ] **Prasyarat** (requirements)
  - [ ] **Pengenalan** (explanation)
  - [ ] **Alur/Mekanisme** (flow diagram + explanation)
  - [ ] **Langkah-Langkah** (numbered steps with code)
  - [ ] **Contoh Lengkap** (full, runnable example)
  - [ ] **Aturan/Pedoman** (do's and don'ts)
  - [ ] **Verifikasi** (how to test)
  - [ ] **Referensi Kode Aktual** (real file paths from codebase)
  - [ ] **Catatan** (edge cases, gotchas)
  - [ ] **Lihat Juga** (related docs)

## Tutorial Validation

- [ ] Tutorial is written in Bahasa Indonesia (except code samples and file paths)
- [ ] Tutorial file is at correct location: `tutorial/NN-*.md`
- [ ] All code samples are tested (copy-paste and they work)
- [ ] All file paths in "Referensi Kode Aktual" actually exist in the codebase
- [ ] Links to other tutorials/rules use relative paths and exist
- [ ] Markdown format is valid (headings, code blocks, tables)

## Update Related Files

- [ ] If a matching skill exists (`.claude/skills/{topic}/`), update it to reference the new tutorial
  - Add: `**Source tutorial**: [tutorial/NN-*.md](../../../tutorial/NN-*.md)`
  - Update procedure steps if tutorial introduced new workflow
- [ ] If a matching rule exists (`.claude/rules/`), update it to reference the new tutorial
  - Add pointer: `For complete details, see tutorial/NN-*.md`

## Commit & Communicate

- [ ] Create a single commit including: code + tutorial + updated skills/rules
- [ ] Commit message format:
  ```
  Add tutorial: {topic-in-indonesian}
  
  - tutorial/NN-{topic}.md: {one-line summary of what it documents}
  - .claude/skills/{name}/SKILL.md: updated to reference tutorial (if applicable)
  - [any other files affected]
  ```

## Future: Keep Synchronized

- [ ] When code changes, verify tutorial examples still work
- [ ] If pattern fundamentally changes, create new tutorial (don't just edit the old one)
- [ ] Add deprecation note to old tutorial if superseded by a new one

## Notes

- **Tutorial is source of truth** — skills and rules reference it, not the reverse
- **No fundamental feature ships without a tutorial** — this is a hard rule
- **Indonesian is mandatory** — even if team members speak English, tutorials in Indonesian keep them accessible
- **Code samples must work** — "illustrative" samples should be clearly marked as such

---

For step-by-step guidance on writing a tutorial, see `.claude/skills/write-tutorial/SKILL.md`.
