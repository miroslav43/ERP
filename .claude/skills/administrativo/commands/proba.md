---
description: Proba de scriere reală per rol pentru un modul sau o tabelă — verifică efectiv dacă fiecare rol POATE scrie ce ar trebui, nu doar că nu poate ce n-ar trebui.
argument-hint: <modul|tabelă>
allowed-tools: ["Bash", "Read", "Grep", "Glob", "Edit"]
---

Invocă skill-ul `administrativo-proba-reala` și urmează-l pas cu pas pentru
`$ARGUMENTS`.

Pe scurt, ordinea:

1. Determină tabelele scrise de modul (din migrarea lui).
2. Citește așteptarea din `role_permissions` — nu o inventa:
   ```sql
   select role, resource, action, scope from public.role_permissions
   where organization_id is null and resource = '<resursă>' order by role, action;
   ```
3. Verifică capcanele tabelelor:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/capcana.mjs" --tabela <tabela>`
4. Adaugă cazurile în `tests/rls/izolare.sql`, secțiunea `(l)` — **acolo**, nu
   într-o bancă paralelă: fișierul acela rulează în CI la fiecare PR. Azi
   verificarea `(l)` face 9 scrieri, toate ca `admin_alfa`; `manager`, `hr`,
   `employee` și `super_admin` nu sunt niciodată dovediți capabili să scrie.
5. Rulează `bash "${CLAUDE_PLUGIN_ROOT}/scripts/banc-migrare.sh"` și lipește ieșirea.

Raportează pe cele patru verdicte: `OK`, `⛔ FALS-NEGATIV`, `⛔ FALS-POZITIV`,
`⚠ REFUZ TĂCUT`. Orice `⛔` blochează livrarea. Un `⚠` care se regăsește în
`references/matrice-roluri.md` cu numărul capcanei e restanță documentată — se
raportează, nu se ascunde.
