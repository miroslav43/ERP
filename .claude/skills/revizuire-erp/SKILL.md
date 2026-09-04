---
name: revizuire-erp
description: Revizuire multi-agent a schimbărilor din Administrativo — securitate/RLS, bază de date, domeniu, Next.js și drift de contract între straturi, cu verificare adversarială a fiecărui finding. Rulează nocturn prin .github/workflows/revizuire.yml, câte o invocare pe fiecare bucată din ziua precedentă, sau manual pe un interval de commit-uri.
---

Orchestrezi un review complet al schimbărilor recente. Tu **nu analizezi cod direct** — dispecerizezi agenți specializați, filtrezi rezultatele printr-un verificator adversarial și consolidezi raportul.

Rezultatul tău sunt **două fișiere scrise în directorul din variabila de mediu `RAPORT_DIR`**: `$RAPORT_DIR/raport.md` și `$RAPORT_DIR/findings.json`. Restul conductei (comentariu pe commit, issue, verdict, reparare automată) le citește pe astea. Formatul nu e negociabil.

**`RAPORT_DIR` e în afara arborelui de lucru git, intenționat.** Dacă ai scrie raportul în repo, jobul de reparare l-ar comite pe `main`. Dacă variabila lipsește, folosește `/tmp/revizuire` — niciodată rădăcina repo-ului.

---

## 1. Stabilește intervalul și fișierele

Intervalul îl primești în prompt ca `INTERVAL` (forma `<sha_vechi>..<sha_nou>`). Dacă lipsește sau nu e valid, cazi înapoi pe `HEAD~1..HEAD`.

```bash
git diff --name-only "$INTERVAL"
```

Verifică întâi că intervalul e utilizabil: `git rev-parse --verify "${INTERVAL%%..*}^{commit}"`. Dacă baza nu există (branch nou, force-push, istoric superficial), folosește `HEAD~1..HEAD` și notează substituția în raport.

**Exclude din analiză** — sunt generate, uriașe sau irelevante:

```
src/types/database.ts     generat cu `pnpm db:types`, ~10.000 de linii
pnpm-lock.yaml
docs/**
*.md
.claude/**
public/**
```

`src/types/database.ts` se exclude din _citire_, dar **prezența sau absența lui din diff e un semnal** pe care îl transmiți lui `revizor-baza-date` și lui `revizor-contracte`: o migrare fără regenerarea tipurilor e exact tiparul de drift.

**Dacă după excluderi nu rămâne niciun fișier:** scrie un `findings.json` gol valid (vezi §5), un `raport.md` de o linie, și oprește-te. Nu dispecerizezi agenți degeaba.

**Dacă rămân peste 60 de fișiere:** nu tăia tăcut. Prioritizează în ordinea `supabase/migrations/` → `src/lib/supabase/` → `src/lib/actions/` → `src/app/api/` → `src/domain/` → restul, analizează primele 60 și scrie explicit în raport câte fișiere au rămas neanalizate și care.

---

## 2. Dispecerizează 5 agenți ÎN PARALEL

**Un singur mesaj cu cinci apeluri de agent.** Fiecare primește: intervalul, lista fișierelor schimbate relevante ariei lui, și instrucțiunea de a-și citi singur contextul din repo.

| Agent                | Aria                                                                                                                                     | Se sare când…          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `revizor-securitate` | `src/lib/supabase/`, `src/lib/actions/`, `src/lib/crypto/`, `**/actions.ts`, `src/app/api/`, `src/proxy.ts`, `src/config/permissions.ts` | niciun fișier din arie |
| `revizor-baza-date`  | `supabase/migrations/`, `scripts/checks/`, `tests/rls/`, `src/types/database.ts`                                                         | niciun fișier din arie |
| `revizor-domeniu`    | `src/domain/`, `src/schemas/`, orice calcul pe bani/zile/ore                                                                             | niciun fișier din arie |
| `revizor-nextjs`     | `src/app/`, `src/components/`, `src/lib/queries/`, `next.config.ts`                                                                      | niciun fișier din arie |
| `revizor-contracte`  | diff-ul complet, oriunde                                                                                                                 | **niciodată**          |

`revizor-contracte` nu se sare **niciodată**, nici măcar când diff-ul atinge un singur fișier — atunci e cel mai valoros, fiindcă driftul e prin definiție în straturile pe care nimeni nu s-a uitat.

Dacă diff-ul atinge `supabase/migrations/`, spune-i explicit lui `revizor-baza-date` să compare registrul de migrări al bazei cu fișierele din repo, folosind MCP-ul Supabase dacă e disponibil. Driftul în ambele direcții — fișier neaplicat, sau SQL aplicat fără fișier — e cea mai valoroasă verificare a lui.

---

## 3. Verifică adversarial fiecare finding, ÎN PARALEL

Un singur mesaj cu câte un apel `verificator-finding` **per finding**, dându-i **doar findingul respectiv**, niciodată tot raportul.

Peste ~10 findings, împarte în loturi de 10 (mesaje secvențiale), ca să nu trimiți zeci de apeluri deodată.

Reguli:

- păstrezi doar findings-urile cu verdict `CONFIRMAT`;
- aplici severitatea corectată și corecturile pe care le întoarce verificatorul;
- numeri cele `RESPINSE` și scrii numărul în raport — transparența e ce face pragul credibil;
- **niciun finding nu ajunge în `findings.json` fără să treacă pe aici.** Fără excepție pentru `critical`/`high`: alea declanșează repararea automată pe `main`.

---

## 4. Deduplică și atribuie ID-uri

Două findings pe același `fișier:linie` cu aceeași cauză sunt unul singur — păstrează-l pe cel cu descrierea mai precisă și menționează în el ambele unghiuri.

Atribuie ID-uri stabile, pe severitate: `C-1, C-2…` pentru critical, `H-1…` high, `M-1…` medium, `L-1…` low.

Setează `reparabil_automat: false` — indiferent ce a spus agentul care l-a găsit — pentru orice finding care:

- cere aplicarea unei migrări pe baza reală, sau modificarea uneia deja aplicate;
- schimbă un contract public (semnătură exportată, formă de RPC, coloană);
- are `incredere: "low"`;
- cere o decizie de produs, nu una tehnică.

---

## 5. Scrie `$RAPORT_DIR/findings.json`

Exact această formă. E citit cu `jq` de workflow — un câmp lipsă strică conducta.

```json
{
  "commit": "<sha complet al HEAD>",
  "interval": "<intervalul folosit efectiv>",
  "fisiere_analizate": 12,
  "fisiere_neanalizate": 0,
  "respinse_la_verificare": 3,
  "barierele_sql_ruleaza": true,
  "findings": [
    {
      "id": "C-1",
      "severitate": "critical",
      "categorie": "SECURITATE",
      "fisier": "src/lib/queries/leave.ts",
      "linie": 727,
      "titlu": "rezumat de maximum 70 de caractere",
      "descriere": "ce e greșit",
      "de_ce": "consecința concretă",
      "fix": "modificarea minimă",
      "incredere": "high",
      "reparabil_automat": true
    }
  ]
}
```

`severitate` ∈ `critical | high | medium | low`.
`categorie` ∈ `SECURITATE | BAZA-DATE | DOMENIU | NEXTJS | CONTRACTE`.
`barierele_sql_ruleaza`: `false` dacă `revizor-baza-date` a raportat că jobul `migrations` din CI e roșu.

Fără findings, `"findings": []` — dar celelalte câmpuri rămân prezente.

---

## 6. Scrie `$RAPORT_DIR/raport.md`

Pentru oameni. Antetul trebuie să fie citibil dintr-o privire.

```markdown
## 🔍 Revizuire automată — `<sha scurt>`

Interval: `<interval>` · Fișiere analizate: N · Findings: X critical, Y high, Z medium, W low
Respinse la verificarea adversarială: R

### 🔴 Critical

#### C-1 · [SECURITATE] `src/lib/queries/leave.ts:727`

**Bug:** …
**De ce:** …
**Fix:** …
**Încredere:** high · **Reparabil automat:** da

### 🟠 High

### 🟡 Medium

### 🟢 Low

### ✅ Arii verificate fără probleme

- …

---

<sub>Revizuire multi-agent · 5 revizori + verificare adversarială per finding · `.claude/skills/revizuire-erp/`</sub>
```

Secțiunile de severitate fără findings se omit complet. **„Arii verificate fără probleme" se include întotdeauna** — altfel un raport gol e ambiguu între „nu s-a găsit nimic" și „nu s-a uitat nimeni".

Dacă `barierele_sql_ruleaza` e `false`, pune imediat sub antet:

> ⚠️ Barierele SQL din CI nu rulează (jobul `migrations` e roșu). Verificările de RLS, `SECURITY DEFINER` și politici au fost făcute manual de agent, nu de Postgres.

**Limită dură: 60.000 de caractere.** Peste, taie de la `Low` în sus și adaugă o linie cu ce a fost tăiat — comentariile GitHub se resping peste 65.536.

---

## Reguli absolute

- **Nu modifici cod.** Skill-ul ăsta doar analizează și raportează. Repararea e alt job, cu alte permisiuni.
- Singurele fișiere pe care le scrii sunt `$RAPORT_DIR/raport.md` și `$RAPORT_DIR/findings.json`. **Nu scrii nimic în arborele de lucru git** — nici măcar fișiere temporare.
- Nu comiți nimic, nu dai push.
- Nu raportezi ce prinde deja o unealtă deterministă: ESLint (`no-explicit-any`, `no-restricted-imports` pe `lib/supabase/admin`), `tsc` cu cele 7 verificări suplimentare, Prettier, sau barierele SQL **când rulează**.
- Nu re-raportezi cele 9 erori TS preexistente legate de RPC-urile de concediu (`aplica_drepturi_concediu`, `seteaza_zile_concediu_implicit`) — sunt o cauză rădăcină cunoscută și urmărită separat.
- Un raport gol e un rezultat valid și bun. Nu umple raportul ca să pară că ai lucrat.
