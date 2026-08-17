# PROGRESS

Stadiul livrării, pe faze. Planul complet: [`docs/design/00-PLAN-APROBAT.md`](docs/design/00-PLAN-APROBAT.md).
Valorile legale de confirmat și configurările restante: [`NOTES.md`](NOTES.md).

---

## Faza 0 — Setup ✅ livrată

**Criteriul de acceptare era:** un PR gol trece CI verde; migrările aplică pe o
bază goală în câteva secunde.

### Ce există și funcționează

- **Proiect** Next.js 16.3.1 · React 19.2 · TypeScript 5.9 `strict` + 7 verificări
  suplimentare (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, ...) ·
  Tailwind v4 · pnpm 10.33.
- **`src/config/env.ts`** — validare Zod care oprește aplicația la boot, nu la
  primul request. Verifică inclusiv că fiecare cheie de criptare are exact 32 de
  octeți și că `HR_ENCRYPTION_ACTIVE_KEY` are corespondent.
- **`src/lib/format/`** — funcții pure, **30 de teste verzi**:
  - `money.ts` — `1.234,56 lei`, rotunjire aritmetică la ban (nu „half to even",
    care ar fi dat `2,67` pentru `2.675`), citirea intrării utilizatorului
    tolerantă la punct/virgulă/spațiu neîntrerupt.
  - `date.ts` — `dd.MM.yyyy` și `Europe/Bucharest`. Ziua calendaristică se
    procesează **ca șir**, fără a construi vreun `Date`, ca să nu se deplaseze
    cu o zi. Testat pe granița de zi (22:30 UTC = ziua următoare la București),
    pe granița de lună și pe ora de vară/iarnă.
- **Design system** — paleta navy/crem din specificație ca variabile CSS, gata de
  suprascriere per organizație. Font Inter cu subsetul `latin-ext`, obligatoriu
  pentru ș/ț **cu virgulă** (nu cu sedilă).
- **ESLint** — `no-restricted-imports` blochează importul clientului
  `service_role` oriunde în afara Server Actions, Route Handlers și scripturi;
  `no-explicit-any` la nivel de eroare.
- **CI** (`.github/workflows/ci.yml`) — două joburi: calitate (typecheck, lint,
  formatare, teste, build) și migrări pe **Postgres 17 curat**, cu cele trei
  bariere.

### Cele trei bariere — verificate, nu doar scrise

Rulate pe Postgres, întâi pe o schemă construită **deliberat greșit**, apoi pe
una curată. În continuare rulează exclusiv în CI, pe un Postgres 17 efemer:

| Barieră                                   | Prinde                                                                        | Verificat                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1 · `scripts/checks/security-definer.sql` | funcții `SECURITY DEFINER` fără `search_path = ''`                            | ✅ eșec (cod 3) pe `search_path = public`; trece pe `= ''`     |
| 2 · `scripts/checks/policies-explain.sql` | politici RLS care referă coloane inexistente; corp de funcție rupt            | ✅ trece pe schemă curată; `plpgsql_check` sărit dacă lipsește |
| 3 · `scripts/checks/rls-enabled.sql`      | tabelă fără RLS · fără `FORCE` în afara listei albe · RLS fără nicio politică | ✅ eșec (cod 3) pe fiecare din cele trei cazuri                |

> Bariera 1 a fost **greșită la prima scriere**: accepta `search_path = public`,
> care nu este sigur, fiindcă `pg_temp` rămâne căutat înaintea lui. Defectul a
> ieșit la iveală exact pentru că bariera a fost testată împotriva unei funcții
> vulnerabile construite intenționat, nu doar rulată pe o bază goală.

### Comenzi

```bash
pnpm verify      # typecheck + lint + teste — de rulat înainte de fiecare commit
pnpm dev         # server de dezvoltare
pnpm test        # doar testele unitare (logica pură)
pnpm test:rls    # izolarea între tenanți (necesită proiectul Supabase de test)
```

### Restant din Faza 0

- ⚠️ MCP Supabase indică proiectul greșit — vezi `NOTES.md` §1.
- ⛔ Cheile Supabase reale în `.env.local` (blocat de MCP).
- ⛔ Proiectul Supabase dedicat testelor.
- ⛔ Verificarea disponibilității `pg_partman`.

**Decizie:** fără Supabase local și fără Docker. Bazele reale sunt în cloud.
Postgres nativ rămâne local, doar ca banc de probă pentru DDL înainte de push;
verificarea autoritară este CI-ul, pe Postgres 17. Detalii: `NOTES.md` §1.

---

## Faza 1a — Fundația · următoarea

Migrarea `0001_kernel.sql`, helperii `app.*`, politicile RLS, `resolveTenant()`,
`createAction()`, autentificarea și testul generic de izolare între tenanți.
**Zero ecrane de administrare** — acelea vin în 1b.

Nu poate începe înainte de conectarea MCP-ului la proiectul corect.
