---
description: Poarta de final — lanțul complet de verificare CU build, auditul acțiunilor pe diff, driftul de permisiuni și triajul pe cele 11 clase de defecte repetate.
argument-hint: (fără argumente — deduce din git diff)
allowed-tools: ["Bash", "Read", "Grep", "Glob"]
---

Rulează, în ordine, și raportează fiecare pas cu ieșirea lui reală:

```bash
git status --short
node "${CLAUDE_PLUGIN_ROOT}/scripts/verifica-permisiuni.mjs"
node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-actiuni.mjs" --diff
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

`pnpm verify` **nu** include `build`, iar build-ul e singurul care prinde
granița server/client (un fișier `"use server"` care exportă o constantă).
Nu-l înlocui.

Dacă diff-ul atinge `supabase/migrations/`:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/banc-migrare.sh"
```

Apoi treci diff-ul prin cele 11 clase de defecte repetate (A–K, descrise în
agentul `erp-santinela-tenant`). Dacă diff-ul atinge migrări sau `actions.ts`,
lansează agentul `erp-santinela-tenant` pentru un review adversarial.

**Nu declara nimic „gata” fără ieșirea comenzilor lipită.** Istoricul acestui
proiect are un commit „livrat” în care toate porțile automate treceau, iar un
`org_admin` nu putea insera un angajat.
