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

## Faza 1a — Fundația ⚠️ scrisă, parțial neverificată

### Ce există

**Baza de date** — 17 tabele, 16 enum-uri, 15 helperi `app.*`, 44 de politici RLS,
7 triggere de gardă, 5 funcții RPC, matricea de permisiuni ca **date** (118 chei
`resursă:acțiune`). Migrările aplică pe un Postgres 17 curat și trec cele trei bariere.

**Aplicația** — `resolveTenant()` cu cookie tratat ca hint neîncrezut,
`createAction()` cu cele 8 straturi, clienți Supabase tipați, autentificare
(parolă, magic link, resetare, invitație), shell cu sidebar generat din
`config/navigation.ts`, `/panou` ca tablou de bord.

### Defecte găsite și corectate

Fiecare a fost verificat pe Postgres 17 **înainte și după** corecție, nu doar citit:

| Defect                                                                                                                   | Cum se manifesta                                                                                                 | Verificare                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `is_service_context()` citea `current_user` din triggere `SECURITY DEFINER`, unde acela e **proprietarul**, nu apelantul | Toate gărzile ieșeau pe prima linie; un `org_admin` își rescria `plan`, `seats_limit`, `status`, `slug`, `cui`   | măsurat: ca `authenticated` → `true` înainte, `false` după                                                                              |
| `role_permissions_update` verifica rolul în `USING` dar nu în `WITH CHECK`, iar `organization_id` nu era fixat           | org_admin în firma A, membru simplu în B → mută rândul în B și își acordă `users:create=all` = preluare completă | politica rescrisă cu predicatul repetat                                                                                                 |
| Cele 44 de politici scriau `= any ((select app.current_org_ids()))`                                                      | `ERROR: uuid = uuid[]` — subquery-ul întoarce **un rând de tip array**, nu un set                                | corectat cu `::uuid[]`, formă aleasă comparând planurile: singura cu `InitPlan` (o evaluare/instrucțiune) în loc de `Hash Semi Join`    |
| `log_audit_event` și `consume_rate_limit` erau apelate dar nu existau                                                    | auditul complet mut (inclusiv `tenant_forged`), limitarea de rată inexistentă                                    | funcțiile adăugate; `consume_rate_limit` expusă **doar** lui `service_role` — altfel oricine blochează contul altcuiva epuizându-i cota |
| Vocabularul de permisiuni diferea între cod și seed (10 chei din 20)                                                     | meniu **complet gol**, inclusiv pentru `org_admin`, fără nicio eroare                                            | aliniat; `permissions.test.ts` compară cele două liste și eșuează dacă diverg din nou                                                   |
| Parametrul de redirect: `proxy` scria `continua`, pagina citea `redirect`                                                | linkurile profunde se pierdeau tăcut după login                                                                  | o singură constantă, `PARAM_REDIRECT`                                                                                                   |
| `src/app/page.tsx` și `(app)/page.tsx` se mapau ambele la `/`                                                            | dashboard-ul era **inaccesibil**                                                                                 | mutat la `/panou`; `config/routes.ts` centralizează destinația                                                                          |

> O observație a criticii a fost **respinsă**: `created_day` ca `GENERATED` peste
> `AT TIME ZONE 'Europe/Bucharest'` ar bloca migrarea. Fals — `timezone(text,
timestamptz)` este `IMMUTABLE` în Postgres 17 (verificat în `pg_proc`), iar
> migrarea se aplică. Agentul afirmase eșecul fără să-l testeze.

### ⛔ Ce NU este verificat

**Testul de izolare între tenanți nu a rulat niciodată.** Este cel mai important
test din proiect — codul lui există (`tests/rls/`), dar are nevoie de un proiect
Supabase de test, resetabil, care nu e configurat. Până atunci, izolarea este
_proiectată_ corect și verificată static, dar nu _dovedită_ pe un tenant real.

De asemenea neverificate: fluxul de invitație end-to-end (cere GoTrue real),
trimiterea de email, cei 25 de pași de testare manuală.

### Ce s-a tăiat deliberat

Exemplul de acțiune pentru concedii: referea tabele din Faza 3a care nu există.
Faza 1a nu are module de business.

### Restant

- ⚠️ MCP Supabase indică proiectul greșit — `NOTES.md` §1.
- ⛔ Cheile Supabase reale în `.env.local`.
- ⛔ Proiectul Supabase de test → deblochează testul de izolare.
- ⛔ Migrările nu au fost aplicate niciodată pe cloud.
- ⛔ Verificarea disponibilității `pg_partman`.

---

## Faza 1b — Super-Admin · următoarea

CRUD organizații, module per organizație, membri și invitații din UI, cereri
demo, jurnal de audit, comutator de organizație, Resend în mod test.

**Regula de aur: nimic din 1b nu modifică o tabelă din 1a.**

Nu poate începe înainte de conectarea MCP-ului și de rularea, măcar o dată, a
testului de izolare.
