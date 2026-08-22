# Claude Code — configurație și mod de lucru pe acest proiect

Acest document răspunde la o singură întrebare: **dacă mâine deschizi acest
proiect cu un cont nou de Claude, ce trebuie să știi/recreezi ca să lucrezi la
fel ca până acum?** E complementar cu [`project-overview.md`](project-overview.md)
(ce conține proiectul) — acesta e despre cum e configurat _Claude însuși_.

Trei straturi de configurare se ating unul pe altul: **contul** (global, pe
mașină — nu vine cu proiectul), **proiectul** (fișiere din repo, vin cu `git
clone`) și **memoria** (per-proiect, per-mașină — nu vine cu `git clone`).

---

## 1. Ce vine cu proiectul (în git, portabil)

### `CLAUDE.md` → `AGENTS.md`

`CLAUDE.md` de la rădăcină conține un singur `@AGENTS.md` — o directivă de
import. Conținutul real e în `AGENTS.md`:

> Acest Next.js NU e cel din datele de antrenament — API-uri, convenții și
> structura de fișiere pot diferi. Citește ghidul relevant din
> `node_modules/next/dist/docs/` înainte de a scrie cod.

**Important**: acest fișier e **regenerat automat de `next dev`** (vezi
`node_modules/next/dist/server/lib/generate-agent-files.js`) — dacă apare ca
modificare necomisă în `git status`, nu e o greșeală a ta; comite-l ca atare,
scoaterea lui din diff doar îl recreează la următorul `next dev`.

### `.mcp.json` — serverul MCP Supabase

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=nybmhorngsajoqaxjlbr&features=docs,account,database,debugging,development,functions,branching,storage"
    }
  }
}
```

Conectează Claude Code direct la proiectul Supabase real
(`nybmhorngsajoqaxjlbr`, regiunea **aws-1-eu-west-1** — vezi `NOTES.md` §1).
Prin el rulează `execute_sql`, `generate_typescript_types`, `get_advisors`,
`list_migrations` etc. — folosite masiv pentru inspecție și verificări directe
pe baza vie. **Aplicarea migrărilor NU trece prin MCP** — vezi §4 pct. 3.

La un cont nou, acest fișier vine automat cu `git clone` — dar Claude Code
cere autorizare/autentificare OAuth către Supabase la prima folosire a
serverului (dialogul apare în terminal/browser).

### `.claude/settings.local.json` (local, NU vine cu `git clone`)

```json
{
  "enabledMcpjsonServers": ["supabase"],
  "enableAllProjectMcpServers": true
}
```

Confirmă că serverul MCP din `.mcp.json` e activat pentru acest proiect
specific. **Verificat cu `git ls-files .claude/`: acest fișier și
`RESUME.md` NU sunt urmărite de git** — nu apar în `.gitignore` explicit, dar
n-au fost niciodată adăugate la commit. La un `git clone` proaspăt, folderul
`.claude/` local NU există deloc — Claude Code îl recreează singur la prima
folosire (dialogul de autorizare MCP recreează `settings.local.json`).

### `.claude/RESUME.md`

Punct de reluare scris automat de Claude Code când o sesiune e întreruptă
(ex. rate-limit). Conține id-ul sesiunii și comanda `claude --resume <id>`.
Nu e ceva de întreținut manual — se rescrie singur.

---

## 2. Ce NU vine cu proiectul (per cont, per mașină)

### Setările globale ale contului (`~/.claude/settings.json`)

Nu sunt în repo și nu se transferă cu `git clone`. La data acestui document,
configurația globală a contului curent are:

- **Model**: `opusplan` (Opus pentru planificare/Plan Mode, modelul de bază
  pentru restul — modelul EFECTIV activ într-o sesiune poate diferi de
  numele setării, în funcție de disponibilitate; sesiunea curentă rulează pe
  Sonnet 5, deși setarea globală e `opusplan`) · **Effort**: `xhigh` ·
  **TUI**: fullscreen.
- **Plugin-uri activate** (toate din marketplace-ul oficial
  `claude-plugins-official`, verificate direct din
  `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/*/.claude-plugin/plugin.json`):

  | Plugin                     | Ce face                                                                                                                                                                 |
  | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `superpowers`              | Skill-uri de proces (vezi lista completă mai jos)                                                                                                                       |
  | `feature-dev`              | Workflow de dezvoltare cu agenți specializați: explorare cod, design arhitectură, review de calitate                                                                    |
  | `frontend-design`          | Skill pentru implementare UI/UX                                                                                                                                         |
  | `code-review`              | Review automat de PR-uri, mai mulți agenți, scor de încredere                                                                                                           |
  | `security-guidance`        | Avertismente pe bază de tipare la editare + review de diff la Stop + reviewer agentic de commit (injecție, XSS, SSRF, secrete hardcodate, 25+ clase de vulnerabilități) |
  | `claude-code-setup`        | Analizează codul și recomandă automatizări (hook-uri, skill-uri, servere MCP, subagenți)                                                                                |
  | `claude-md-management`     | Auditează/menține fișierele `CLAUDE.md`                                                                                                                                 |
  | `ralph-loop`               | Bucle AI auto-referențiale — rulează Claude repetat cu același prompt până se termină task-ul                                                                           |
  | `chrome-devtools-mcp`      | Server MCP pentru Chrome DevTools                                                                                                                                       |
  | `context7`                 | Documentație la zi pentru librării/framework-uri, la cerere                                                                                                             |
  | `clangd-lsp`, `playwright` | LSP pentru C/C++; framework de teste E2E                                                                                                                                |

- **Auto Mode — context de mediu** (folosit de clasificatorul de siguranță
  care decide ce acțiuni cer confirmare explicită): proiect Supabase
  `nybmhorngsajoqaxjlbr`, fără remote git configurat (repo tratat ca privat),
  secrete în `.env.local` (niciodată comise), date sensibile reale = CNP/IBAN
  angajaților (criptate) + cheile din `HR_ENCRYPTION_KEYS`/
  `TENANT_COOKIE_SECRET`/`RESEND_API_KEY` — acesta e motivul pentru care
  aplicarea unei migrări noi pe baza live a cerut confirmare explicită în
  chat în loc să treacă automat.
- **Fără `hooks` configurate explicit** — `~/.claude/settings.json` nu are
  nicio cheie `hooks` (verificat direct în fișier). Comportamentul
  asemănător unui hook pe care îl poți observa (avertismente la editare,
  review la Stop) vine din plugin-ul `security-guidance` de mai sus, intern
  pachetului, nu dintr-o configurare vizibilă/editabilă de utilizator.

**La un cont nou**, aceste setări NU există implicit. Dacă vrei
comportamentul identic (același model/effort, aceleași plugin-uri), trebuie
recreate manual în `~/.claude/settings.json` al noului cont — nu e ceva ce
poți „importa" din acest proiect.

### Servere MCP dincolo de Supabase — legate de CONT, nu de proiect

Pe lângă `supabase` (din `.mcp.json`, specific acestui repo), o sesiune poate
avea acces la unelte precum Gmail, Google Calendar, Google Drive, Notion,
Chrome DevTools, `claude-in-chrome`, `context7` — **niciuna din ele nu vine
din configurația acestui proiect**. Verificat direct: intrarea acestui
proiect în `~/.claude.json` (`projects["/Users/maleticimiroslav/ERP
Adminio"].mcpServers`) e goală (`{}`). Acele unelte sunt **integrări la
nivel de cont Claude.ai** (aplicații conectate) — apar în orice proiect
deschis cu acel cont, nu doar în acesta, și **NU se transferă cu `git
clone`** — un cont nou trebuie să-și reconecteze singur acele integrări din
claude.ai, dacă le vrea.

### Regulile globale (`~/.claude/rules/`)

Fișiere Markdown citite automat de Claude Code la fiecare sesiune, indiferent
de proiect (nu doar acesta). Structură pe trei limbaje, `common/` +
suprascrieri per limbaj:

| Fișier                   | Conține                                                                                                                                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `common/coding-style.md` | Imutabilitate (nu muta obiecte, întoarce copii noi), „many small files" (200-400 rânduri tipic, 800 maxim), gestionare explicită a erorilor, validare la graniță                                                        |
| `common/git-workflow.md` | Format de mesaj de commit (`tip: descriere`), workflow de PR, „Plan First → TDD → Code Review → Commit"                                                                                                                 |
| `common/testing.md`      | Acoperire minimă 80%, unit+integrare+E2E, TDD obligatoriu                                                                                                                                                               |
| `common/performance.md`  | Strategie de alegere a modelului (Haiku pt. agenți ușori, Sonnet pt. dezvoltare, Opus pt. decizii arhitecturale), gestionarea ferestrei de context                                                                      |
| `common/patterns.md`     | Repository pattern, format standard de răspuns API                                                                                                                                                                      |
| `common/hooks.md`        | PreToolUse/PostToolUse/Stop — ce pot face hook-urile                                                                                                                                                                    |
| `common/agents.md`       | Descrie un tabel de agenți (`planner`, `architect`, `tdd-guide`, `code-reviewer`, `security-reviewer`, `build-error-resolver`, `e2e-runner`, `refactor-cleaner`, `doc-updater`) presupuși a trăi în `~/.claude/agents/` |
| `common/security.md`     | Listă de verificări obligatorii înainte de commit, protocol de răspuns la o problemă de securitate                                                                                                                      |
| `typescript/*.md`        | Suprascrieri TS/JS ale fișierelor de mai sus (imutabilitate cu spread, Zod pentru validare, Playwright pentru E2E, interzicerea `console.log`)                                                                          |
| `python/*.md`            | Echivalentul pentru Python — **nu se aplică acestui proiect** (100% TypeScript)                                                                                                                                         |

**De unde vin de fapt aceste reguli — descoperire importantă**: `diff` direct
confirmă că `~/.claude/rules/` e o COPIE byte-identică a folderului `rules/`
din pluginul comunitar **`everything-claude-code`**
(`~/.claude/plugins/marketplaces/everything-claude-code/rules/`). Verificat
în `~/.claude/plugins/installed_plugins.json`: acest plugin a fost instalat
la **`scope: "project"`, în februarie 2026, pentru un proiect COMPLET
NEÎNRUDIT** —
`/Users/maleticimiroslav/Downloads/Test/PythonOrderFetch/powerbody_shopify`
(un proiect Python/Shopify, nimic de-a face cu Administrativo). Regulile nu
au fost scrise pentru acest proiect ERP — sunt un rest dintr-o instalare de
plugin pentru alt proiect, care ajunge totuși să se aplice AICI pentru că
`~/.claude/rules/` e citit **global**, indiferent de proiectul din care a
provenit conținutul.

**Aceeași sursă explică discrepanța agenților**: `common/agents.md` descrie 9
agenți (`planner`, `architect`, `tdd-guide`, `code-reviewer`,
`security-reviewer`, `build-error-resolver`, `e2e-runner`, `refactor-cleaner`,
`doc-updater`) — toate corespund exact fișierelor din
`everything-claude-code/agents/*.md` (plus câteva specifice Go/Python,
`go-build-resolver.md`, `go-reviewer.md`, `python-reviewer.md`,
`database-reviewer.md`, nemenționate în regulă). Fiindcă acel plugin e
instalat doar la scope „project" pentru proiectul Shopify neînrudit,
definițiile lui de agenți **nu au fost niciodată materializate** în
`~/.claude/agents/` — director care, verificat direct, **nu există** pe acest
cont. Agenții numiți în regulă **nu sunt disponibili** aici — nu invoca
`Agent` cu `subagent_type` egal cu unul din aceste nume. Agenții REALI,
disponibili prin unealta `Agent` pe acest proiect, sunt cei încorporați în
Claude Code + plugin-ul `feature-dev`: `Explore`, `Plan`, `general-purpose`,
`claude-code-guide`, `statusline-setup`, `feature-dev:code-architect`,
`feature-dev:code-explorer`, `feature-dev:code-reviewer` — verifică lista
exactă din system-reminder-ul sesiunii curente, poate varia.

**Concluzie practică**: dacă vrei ca un cont nou să respecte EXACT aceste
reguli, ele nu sunt un artefact intenționat al acestui proiect — decide
explicit dacă le vrei păstrate (copiază `~/.claude/rules/`) sau dacă preferi
să le cureți ca resturi dintr-un proiect neînrudit. Regulile de fond care
CHIAR au fost stabilite pentru Administrativo trăiesc în memoria de proiect
(§3) și în acest document, nu în `~/.claude/rules/`.

### Skill-urile din pachetul `superpowers`

Plugin-ul `superpowers` instalează skill-ul `using-superpowers`, care
comandă: _„dacă există fie și 1% șansă ca un skill să se aplice, invocă-l."_
Lista concretă de skill-uri instalate (verificată direct în
`~/.claude/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/`,
versiunea `6.3.0`):

`using-superpowers`, `brainstorming`, `writing-plans`, `executing-plans`,
`test-driven-development`, `systematic-debugging`,
`dispatching-parallel-agents`, `subagent-driven-development`,
`requesting-code-review`, `receiving-code-review`, `using-git-worktrees`,
`finishing-a-development-branch`, `writing-skills`,
`verification-before-completion`.

Verifică versiunea curentă înainte de a presupune că lista de mai sus e încă
exactă — plugin-urile se actualizează.

---

## 3. Memoria — specifică ACESTUI proiect, NU vine cu `git clone`

Claude Code ține o memorie auto-construită per-proiect, la:

```
~/.claude/projects/-Users-maleticimiroslav-ERP-Adminio/memory/
```

Calea e derivată din calea absolută a proiectului pe disc — **la un cont nou
pe aceeași mașină, memoria există deja și se citește automat** (dacă folderul
de sistem al noului cont e același `~/.claude/`). **La un cont nou pe altă
mașină**, memoria NU există și trebuie copiată manual (sunt fișiere
Markdown simple) sau reconstruită din interacțiuni noi.

Conținutul actual (rezumat — sursa exactă e în fișierele individuale, la
calea absolută `~/.claude/projects/-Users-maleticimiroslav-ERP-Adminio/memory/`,
indexate din `MEMORY.md` din același folder). **Nu sunt linkuri relative** —
folderul de memorie trăiește în afara acestui repo (în directorul intern al
Claude Code), deci nu poate fi referit portabil dintr-un document din git;
calea de mai sus e absolută, pentru mașina/contul curent.

| Fișier                                | Tip      | Esență                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fara-agenti-implementare-directa.md` | feedback | Fără `Agent`/`Workflow` pe acest proiect — implementare directă, cu `Write`/`Edit`, verificată obligatoriu cu `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. Motiv: rundele cu agenți consumau 1,1–1,8M tokeni/rundă, mureau la limita de sesiune, livrau cod cu erori grosolane (chei cu caractere greșite, octeți NUL brut, coloane inventate). Excepție: dacă utilizatorul cere explicit agenți sau spune „ultracode". |
| `commit-push-dupa-feature.md`         | feedback | Commit + push automat după orice feature finalizat și verificat, fără să mai ceară voie de fiecare dată. Rămân excepție acțiunile cu adevărat riscante (force-push, ștergere de branch).                                                                                                                                                                                                                                             |
| `plan-mode-focus-ingust.md`           | feedback | În Plan Mode, fișierul de plan trebuie să conțină STRICT cererea curentă — dacă exista deja un plan vechi în fișier, se suprascrie complet, nu se adaugă la final.                                                                                                                                                                                                                                                                   |
| `bug_scriere_cnp_iban_angajat.md`     | project  | Bug cunoscut, NEREZOLVAT: formularul de angajat scrie CNP/IBAN prin `.upsert()` direct pe `employee_sensitive_data`, tabelă fără GRANT pentru `authenticated` — eșuează cu 42501, mesaj generic care induce în eroare. Reparația corectă: rescrie `salveazaDateSensibile` (`angajati/actions.ts`) să apeleze RPC-ul `hr_write_sensitive`, exact ca la citire.                                                                        |
| `onboarding_companie_wizard.md`       | project  | Wizard-ul de înrolare companie (super-admin, 6 pași) + activarea `employee_tax_exemptions` în motorul de salarizare — sursa de adevăr, nu reconstrui din memorie, citește `nou/actions.ts` (`onboardeazaOrganizatie`).                                                                                                                                                                                                               |

**Cum se actualizează**: Claude scrie/actualizează aceste fișiere automat pe
parcursul conversațiilor, când observă corecții sau confirmări explicite ale
utilizatorului. Nu necesită întreținere manuală — dar dacă vrei să _ștergi_
o memorie greșită, cere explicit („uită faptul că...").

---

## 4. Convenții de lucru stabilite (dincolo de memoria formală)

Din istoricul acestui proiect, dincolo de fișierele de memorie de mai sus:

1. **Verificare obligatorie înainte de a considera un task terminat**:
   `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (sau `pnpm verify`,
   care omite build-ul — vezi observația de mai jos). Build-ul e singurul care
   prinde greșelile de graniță server/client (import client într-o componentă
   server etc.) — memoria `fara-agenti-implementare-directa` insistă explicit
   pe el.
2. **Sesiuni concurente pe același repo**: acest proiect a fost lucrat, în
   paralel, de mai multe sesiuni Claude Code diferite (uneori ale altor
   persoane reale, ex. commit-uri de la `RazvanPervulescu-APS`). Protocol
   verificat și stabil: `git status --short` înainte de orice `git add`
   larg, `git fetch origin main` + inspectarea commit-urilor noi înainte de
   push, niciodată `git add -A`/`.` orb, redenumirea propriilor migrări la o
   coliziune de nume (niciodată a fișierului altcuiva), `git merge` normal
   (nu rebase) când upstream-ul are commit-uri noi.
3. **Migrări pe baza de date live**: aplicate prin `psql`, cu fișierul trimis
   byte-exact (`NOTES.md` §1 dă comanda completă, prin pooler). NICI prin
   `supabase db push` din CLI, NICI prin `apply_migration` din MCP: ambele cer
   ca SQL-ul să treacă prin model ca text, iar 104 KB de DDL retranscris e
   exact locul în care apare o eroare subtilă imposibil de observat. MCP-ul
   rămâne pentru inspecție: `execute_sql`, `list_migrations`, `get_advisors`,
   `generate_typescript_types`. Schimbările de schemă live pot cere confirmare
   explicită a utilizatorului în chat (clasificatorul Auto Mode le tratează
   ca acțiuni ireversibile pe un sistem distribuit) — nu presupune că un
   „da" anterior acoperă o migrare nouă, cere din nou dacă apare blocajul.
   După aplicare, regenerează `src/types/database.ts` cu
   `mcp__supabase__generate_typescript_types` + scriptul de patch (vezi
   antetul fișierului generat: 3 corecții manuale pe argumente opționale ale
   RPC-urilor `hr_write_sensitive`/`log_audit_event`/`submit_demo_request`,
   care s-ar pierde la o regenerare brută).
4. **Plan Mode**: pentru task-uri punctuale, fișierul de plan conține DOAR
   task-ul curent — nu tot planul istoric al proiectului. Pentru task-uri de
   proiect nou/re-planificare majoră, poate conține un plan pe etape complet.
5. **Testarea directă pe baza vie** înainte de a considera o migrare nouă
   „gata": inserare de test cu date sigure (id-uri/date în viitorul
   îndepărtat, ex. `2099-01-05`), verificare, apoi ștergere explicită a
   rândurilor de test — nu se lasă artefacte de test în date reale.

---

## 5. Rețetă: pornirea unei sesiuni Claude Code identice, de la zero

1. Instalează Claude Code CLI, autentifică-te cu contul dorit.
2. `cd` în proiect (calea contează pentru cheia memoriei — vezi §3).
3. La prima folosire a unei unelte `mcp__supabase__*`, autorizează conexiunea
   OAuth către Supabase când ți se cere.
4. Dacă vrei același comportament de model/plugin-uri: copiază
   `~/.claude/settings.json` de pe contul vechi (sau recreează manual din §2).
5. Regulile din `~/.claude/rules/` sunt, verificat, un rest neintenționat
   dintr-un plugin instalat pentru alt proiect (§2) — decide EXPLICIT dacă le
   vrei (copiază folderul) sau le lași deoparte; nu presupune că fac parte
   din configurația „corectă" a acestui proiect doar pentru că există.
6. Dacă memoria nu există deja la calea din §3 (cont nou pe altă mașină):
   copiază manual folderul de memorie, sau lasă-l să se reconstruiască din
   interacțiuni noi (Claude o va recrea pe măsură ce observă corecții).
7. Citește, în ordine: acest fișier → [`project-overview.md`](project-overview.md)
   → `NOTES.md` (rădăcina proiectului) → `PROGRESS.md` (rădăcina proiectului,
   **parțial învechit**, vezi avertismentul din `project-overview.md` §9) →
   `docs/design/ecrane/capcane.md` (capcane cunoscute din schemă).
8. Rulează `pnpm install && pnpm verify` ca sanity-check că mediul local e
   funcțional înainte de a începe orice modificare.
