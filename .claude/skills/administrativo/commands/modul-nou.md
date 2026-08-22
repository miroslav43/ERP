---
description: Construiește un modul nou pe cele opt straturi, în ordinea obligatorie — migrare, tipuri, scheme, citiri, acțiuni, pagini, navigație, probă de scriere reală.
argument-hint: <nume-modul> [descriere scurtă]
allowed-tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"]
---

Construiește modulul `$ARGUMENTS`, **un strat pe rând**, cu o poartă între ele:
nu treci mai departe până stratul curent nu compilează.

| # | Strat | Skill / agent | Poartă |
|---|---|---|---|
| 1 | migrare + RLS | `administrativo-migrare` · `erp-migrare-rls` | `banc-migrare.sh` verde |
| 2 | tipuri generate | — | `git diff --stat` strict aditiv pe `src/types/database.ts` |
| 3 | scheme Zod | `administrativo-actiune` | `pnpm typecheck` |
| 4 | citiri | `erp-citiri` | `pnpm typecheck` |
| 5 | acțiuni | `administrativo-actiune` · `erp-actiuni` | `audit-actiuni.mjs --diff` curat |
| 6 | pagini + formulare | `administrativo-ecran` · `erp-ui` | `pnpm build` |
| 7 | navigație + feature flag | — | `pnpm test` (`navigation.test.ts`) |
| 8 | proba de scriere reală | `administrativo-proba-reala` | toate cele 5 roluri |

**Fără fan-out.** Un singur agent activ la un moment dat. În Faza 1b a acestui
proiect, 6 agenți paraleli au produs 91 de erori de compilare, aproape toate din
căi de import inventate; în fazele 7, 3b, 6 și 10 agenții de construcție au
murit la limita de sesiune cu zero cod livrat.

Înainte de stratul 1, citește `docs/project-overview.md` §7 („Cum adaugi un
modul nou”) și rulează
`node "${CLAUDE_PLUGIN_ROOT}/scripts/capcana.mjs" --modul $ARGUMENTS`.
