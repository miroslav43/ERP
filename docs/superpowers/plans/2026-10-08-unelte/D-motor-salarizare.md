## D. Motorul de salarizare din aplicație: facilitatea de 200 de lei (și scrierea rândurilor de salariu)

**Scop:** motorul din `src/domain/payroll` aplică singur suma neimpozabilă de la salariul minim (OUG 89/2025 art. III), parametrizată pe perioade cu început și sfârșit. Calculatorul public îl refolosește fără dublură, iar fluturașul, PDF-ul și D112 arată rândul. Pe drum se repară și un defect mai grav, găsit la diagnostic: funcția SQL care scrie rândurile de salariu aruncă 13 coloane calculate, printre ele `rest_de_plata`.

**De ce:**

- Auditul din 8 oct 2026 a rulat `calculatePayrollEntry` (motorul chemat de `src/app/(app)/salarizare/actions.ts:467`) cu setările publice. La 4.325 lei brut, motorul dă **net 2.616**, iar unealta dă **2.699**. Diferența de 83 de lei/lună/salariat vine din cei 200 de lei neimpozabili, pe care îi adaugă doar `src/lib/unelte/salariu.ts:64-94`, „peste” motor. `grep` după `neimpozabil|89/2025|4600` în `src/domain/payroll`, `src/lib/queries/payroll.ts`, `actions.ts` și în migrări găsește numai diurna. Fraza de pe `/unelte` „sunt aceleași funcții care lucrează în aplicație” e deci doar pe jumătate adevărată.
- Diagnosticul meu read-only din 8 oct 2026, prin MCP `execute_sql`:
  - **(a)** `payroll_entries` are 16 rânduri, toate ale firmei `demo`: iulie și august 2026, perioade `aprobat`. **Zero** sunt la salariul minim, deci niciun stat de plată real nu e greșit azi din cauza facilității.
  - **(b)** Firma `wise` (31 de contracte active) are o perioadă **octombrie 2026 în `draft`, fără rânduri încă**. Primul ei calcul va trece prin ambele defecte.
  - **(c)** `pg_get_functiondef('public.payroll_scrie_rezultate')` din producție **nu conține** `rest_de_plata`, `baza_cas`, `indemnizatie_co` (`position(...) = 0`). Toate cele 16 rânduri au `baza_cas = 0` cu `cas > 0`.
  - Cele 13 coloane: `baza_cas`, `baza_cass` (0054), `avantaje_natura`, `rest_de_plata` (0055), `indemnizatie_co`, `indemnizatie_cm_angajator`, `indemnizatie_cm_fnuass`, `zile_cm_angajator`, `zile_cm_fnuass`, `baza_zilnica_cm`, `ore_supl_compensate` (0057), `diurna_neimpozabila`, `diurna_impozabila` (0060). Toate există în bază cu `default 0` și sunt trimise de `actions.ts:605-680`. Funcția (ultima definiție: `0146_bani_si_timp.sql:74`) le citește prin `jsonb_populate_record`, dar n-o face nici în UPDATE, nici în INSERT.
  - `src/app/api/export/salarizare/bancar/route.ts:122` plătește `rest_de_plata`, iar fluturașul PDF tipărește același câmp. Rândurile demo au valori corecte doar fiindcă backfill-ul din 0055 (comis pe 22 aug) a rulat după calculul lor (18–19 aug). **Primul calcul real produce un fișier bancar cu 0 lei pe fiecare om.**
- Sursa primară: OUG 89/2025, forma consolidată la 16.08.2026 (legislatie.just.ro, doc. 305817), descărcată cu `curl` pe 8 oct 2026. Din art. III:
  - **alin. (1):** 300 lei/lună în ian.–iun. 2026 (plafon 4.300) și 200 lei/lună în iul.–dec. 2026 (plafon 4.600), scutiți de impozit și de contribuții. Condiții:
    - CIM cu normă întreagă, „la locul unde se află funcția de bază”;
    - salariul de bază egal cu minimul lunii;
    - venit brut fără tichete, vouchere și indemnizație de hrană.
    - Derogarea e de la art. 78, 139 alin. (1), 140, 157 alin. (1) și 220^4 alin. (1) Cod fiscal. Art. 77 (deducerea personală) nu e printre ele.
  - **alin. (2):** un salariu de bază diminuat în 2026 pierde facilitatea.
  - **alin. (4):** suma se diminuează după fracțiunea de lună.
  - **alin. (5):** salariul minim folosit ca bază minimă la timp parțial scade cu aceeași sumă.
  - **alin. (6):** se aplică doar veniturilor din 2026.
- Salariul minim: 4.050 lei până la 30.06.2026 (preambulul OUG 89/2025; HG 1.506/2024, abrogată de HG 146/2026 art. 2) și 4.325 lei din 1.07.2026 (HG 146/2026 art. 1, MO 196/13.03.2026).
- Reverificat de verificator, cu `curl`, pe 8 oct 2026 la ~20:40: art. III alin. (1)–(6) din doc. 305817 (consolidare 16.08.2026) și HG 146/2026 art. 1–2 (doc. 308231) corespund literal rezumatului de mai sus. Alin. (5) privește art. 146 alin. (5^6)–(5^9) și art. 168 alin. (6^1), adică baza minimă la timp parțial. Alin. (4) lit. a) (salariul la minim doar o parte din lună) nu e acoperit de plan și e ⚠ în `NOTES.md`.

**Decizii luate**

1. **Facilitatea stă în domeniu, ca etapă pură, într-un tabel de perioade versionat în cod. Nu stă în bază.** Locul e `src/domain/payroll/etape/facilitate-salariu-minim.ts`, cu `valabilDeLa`/`valabilPana`, salariul minim al perioadei, suma, plafonul și temeiul.
   - De ce nu în bază: e o derogare națională, cu dată de expirare, nu o setare a firmei. Un rând nou (o eventuală prelungire în 2027) cere oricum un act normativ citit și un test.
   - O tabelă ar fi cerut migrare, UI și seed per firmă.
   - E singura excepție de la regula „nimic hardcodat” din `NOTES.md` §3, și se notează acolo.
   - Condiția a) se compară cu salariul minim din tabel, nu cu `payroll_settings.salariu_minim_brut`: o firmă care a uitat să-și actualizeze setarea în iulie nu trebuie să-și piardă tăcut facilitatea.
2. **Luna vine ca dată, nu din ceas.** Câmpul nou opțional e `PayrollCalcInput.lunaVenituri` („AAAA-LL”).
   - Acțiunea îl ia din perioadă, așa că decembrie 2026, recalculat în ianuarie 2027, păstrează suma.
   - Absent, motorul se poartă exact ca azi. Cele peste 500 de teste existente rămân neatinse, fiindcă niciunul nu-l trimite.
3. **Ce scoate suma din baze și ce lasă neatins:**
   - Suma iese din `bazaCas`, `bazaCass`, din baza de impozit (moștenită din `bazaCasFinala`) și din baza CAM.
   - Nu iese din `brut`: omul o primește.
   - **Deducerea personală se calculează pe brutul întreg**, fiindcă art. 77 nu e derogat. Testul la 4.600 o arată: 735 lei, nu 822.
4. **Alin. (5) se aplică tuturor**, nu doar beneficiarilor. În lunile cu facilitate, `minim` din `aplicaMinimContributii` scade cu suma. Altfel, baza de 4.125 a unui salariat la minim ar fi ridicată înapoi la 4.325 chiar de motor.
5. **Diminuarea pe fracțiunea de lună (alin. (4) lit. c)):** fracția = (zile lucrate + zile CO) / zile lucrătoare. Zilele de CM nu intră. Suma se rotunjește la ban. Ambele alegeri sunt ⚠ pentru contabil.
6. **Funcția de bază: aceeași presupunere ca la deducerea personală.** Schema nu are câmpul, iar `employees.is_primary` înseamnă altceva (fișa principală a unui cont).
   - `EmployeeContractSnapshot.functieDeBaza?: boolean` are implicitul `true`. Când e `false`, motorul taie și deducerea, și suma; așa unealta nu mai golește grila de deduceri în afara motorului.
   - Aplicația nu trimite câmpul, dar fiecare aplicare a facilității lasă un avertisment informativ (`SAL_FACILITATE_SALARIU_MINIM`) care cere verificarea funcției de bază și a alin. (2).
7. **Normă întreagă = norma zilnică din contract ≥ norma organizației.** Minorii cu 6 h, care legal au normă întreagă, pierd azi suma. Comportamentul e fixat de un test și marcat ⚠, ca schimbarea lui să fie o decizie, nu un accident.
8. **Suma se păstrează în `calc_breakdown` (pasul `sumaNeimpozabila`), nu într-o coloană nouă.** Fluturașul de pe ecran, PDF-ul, e-mailul și D112 o citesc prin `sumaNeimpozabilaDinBreakdown()`. Repararea facilității nu depinde astfel de o migrare care cere confirmare pe producție. Migrarea (D2) repară doar scrierea coloanelor existente.
9. **D112:** `A_5` (baza CAM) = brut − suma scutită. Fiecare asigurat cu facilitate primește o atenționare **neblocantă**: tipul de asigurat (nomenclatorul a fost redenumit la 1.11.2/1.11.3 prin Ordinul ANAF–CNPP–CNAS–ANOFM 605/95/928/2.314/2026, MO 463/2 iun 2026, după presă) și rubrica dedicată nu sunt generate. Nu inventez codul: aplicația generează azi doar secțiunea A, iar ordinul nu l-am citit pe sursă primară. Antetul `x-atentionari` intră în lista citită de `ButonDescarcare`; azi nu-l vede nimeni (vault-ul salarizării o spune explicit).
10. **Calculatorul public:** `dinBrut(brut, persoane, functieDeBaza, luna = LUNA_REFERINTA_PUBLICA)`, cu `LUNA_REFERINTA_PUBLICA = "2026-07"`. Valorile publice sunt explicit cele din iul.–dec. 2026. Expirarea și alegerea semestrului țin de secțiunea calculatorului, care consumă interfața de aici. `FACILITATE_SALARIU_MINIM` și `SALARIU_MINIM_BRUT_2026_IULIE` devin derivate din tabelul motorului, deci cifrele trăiesc într-un singur loc.
11. **Ordinea taskurilor e dictată de urgență:** D2 (rest de plată 0) înaintea facilității, ca firma `wise` să nu calculeze octombrie pe codul vechi. D2 se oprește înaintea aplicării pe producție.
12. **Nicio rescriere de date de producție.** Diagnosticul (D1) e numai `SELECT`. Azi nu există state reale afectate. Dacă la execuție apar, decizia de recalculare sau rectificativă e a utilizatorului.

**Harta fișierelor**

| Fișier | Responsabilitate | Task |
| --- | --- | --- |
| (MCP `execute_sql`, doar SELECT) | inventarul statelor afectate | D1 |
| `supabase/migrations/0187_salarizare_scrie_toate_coloanele.sql` (Create) | `payroll_scrie_rezultate` cere, actualizează și inserează toate cele 54 de chei | D2 |
| `tests/rls/proba-bani-si-timp.sql` (Modify) | rândul probei poartă cheile noi; (6) verifică `rest_de_plata` și `baza_cas` | D2 |
| `src/app/(app)/salarizare/actions-calcul.test.ts` (Modify) | poarta TS↔SQL: fiecare cheie trimisă e cerută, actualizată și inserată | D2 |
| `src/domain/payroll/etape/facilitate-salariu-minim.ts` (Create) | perioadele, condițiile, diminuarea, citirea din breakdown | D3 |
| `src/domain/payroll/etape/facilitate-salariu-minim.test.ts` (Create) | testele etapei | D3 |
| `src/domain/payroll/erori.ts` (Modify) | codul `SAL_FACILITATE_SALARIU_MINIM` în catalog | D3 |
| `src/domain/payroll/calc.ts` (Modify) | `lunaVenituri`, `functieDeBaza`, `sumaNeimpozabila`, baze, CAM, minim diminuat | D4 |
| `src/domain/payroll/calc.facilitate.test.ts` (Create) | vectorii motorului | D4 |
| `src/components/payroll/fluturas.tsx` (Modify) | eticheta pasului `sumaNeimpozabila` | D4 |
| `NOTES.md` (Modify) | ⚠ de confirmat de contabil | D4 |
| `src/app/(app)/salarizare/actions.ts` (Modify, l. 465-468) | trimite luna perioadei la motor | D5 |
| `src/app/(app)/salarizare/actions-calcul.test.ts` (Modify) | facilitatea ajunge în rândul scris; ceasul nu contează | D5 |
| `src/lib/unelte/salariu.ts` (Modify) | unealta refolosește motorul, fără dublură | D6 |
| `src/content/legal/salarizare-publica.ts` (Modify) | `FACILITATE_SALARIU_MINIM` derivat din domeniu; `LUNA_REFERINTA_PUBLICA` | D6 |
| `src/lib/unelte/salariu.paritate.test.ts` (Create) | paritatea unealtă↔motor | D6 |
| `src/lib/pdf/linii-fluturas.ts` (Modify) | rândul în PDF | D7 |
| `src/lib/pdf/linii-fluturas.test.ts` (Modify) | testele rândului | D7 |
| `src/app/api/export/salarizare/fluturas/route.ts` (Modify) | citește `calc_breakdown` | D7 |
| `src/app/(app)/salarizare/actions.ts` (Modify, l. 241-243) | `COLOANE_FLUTURAS_EMAIL` citește `calc_breakdown` | D7 |
| `src/domain/payroll/d112/structura.ts` (Modify) | `AsiguratD112.sumaNeimpozabila` | D8 |
| `src/domain/payroll/d112/genereaza.ts` (Modify) | `A_5` fără suma scutită + atenționare | D8 |
| `src/domain/payroll/d112/genereaza.test.ts` (Modify) | testele D112 | D8 |
| `src/app/api/export/salarizare/d112/route.ts` (Modify) | trimite suma din breakdown | D8 |
| `src/components/incarcare/buton-descarcare.tsx` (Modify) | arată `x-atentionari` în notificare | D8 |

Ordinea și dependențele: D1 → D2 (independent de restul); D3 → D4 → {D5, D7, D8}. **D6 rulează după C8, ca D6′** (vezi blocul de reconciliere de la începutul lui D6): C3 înlocuiește integral `salariu.ts`, deci D6 în forma originală s-ar ciocni cu C. (Corectat de criticul de completitudine, 8 oct 2026.)

Lanțul de verificare (notat **LANȚ** mai jos), rulat fără pipe (un `| tail` înghite codul de ieșire):

```bash
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && node scripts/checks/lastmod.mjs
```

Plus `pnpm exec prettier --check <fișierele atinse>`. Fără `pnpm build`. O roșeață preexistentă în fișiere neatinse de task (de exemplu `src/app/(app)/registru/*`, modificate necomis de altă sesiune) se raportează și nu oprește taskul.

**Verificat adversarial (8 oct 2026, pe o copie a arborelui din scratchpad, repo-ul neatins):** toate cele 36 de blocuri „vechi” apar exact o dată în fișierele țintă. Codul D2–D8 a fost aplicat mecanic din plan, apoi s-au rulat:
- testele noi, înainte de implementare: toate 25 + suita etapei pică, cu mesajele anunțate (D2 dă exact cele 13 chei);
- după implementare: `vitest` 847/847 pe salarizare, unelte, PDF, D112, `migrari.test.ts`, plus suita completă unit+ui fără nicio regresie;
- `tsc --noEmit` 0 erori, cu sondă de control; `eslint` 0 pe cele 19 fișiere; `prettier --check` curat (trei blocuri reformatate în plan);
- `check:server` curat;
- `banc-migrare.sh` pe Postgres 17: ✓ 0187, ✓ `proba-bani-si-timp.sql`, „TOT VERDE”, 1 min 21 s.

Reconfirmat prin MCP (un singur SELECT): funcția live nu conține `rest_de_plata`, are 16 rânduri, toate cu `baza_cas = 0`, iar 0187 nu e în `internal.migrari_aplicate`. `aplica-cloud.sh` înregistrează acum migrarea în `internal.migrari_aplicate` (l. 84-113), deci verificarea de la D2 pasul 8 e validă.

---

### Task D1: Diagnostic read-only — câte state de plată sunt afectate

**Fișiere:** niciunul (doar `mcp__supabase__execute_sql`, numai `SELECT`; fără commit).

**Interfețe:** Consumă: baza de producție (aceeași pentru dev și prod, vezi `NOTES.md` §1). Produce: patru cifre raportate utilizatorului și o decizie.

- [ ] **Pasul 1: Inventarul pe firmă și lună**

```sql
select o.slug, pp.an, pp.luna, pp.status,
       count(pe.id) as randuri,
       count(pe.id) filter (where pe.rest_de_plata = 0 and pe.net_de_plata > 0) as rest_zero,
       count(pe.id) filter (where pe.baza_cas = 0 and pe.cas > 0) as baza_cas_zero,
       min(pe.calculat_la) as primul_calcul, max(pe.calculat_la) as ultimul_calcul
  from public.payroll_periods pp
  join public.organizations o on o.id = pp.organization_id
  left join public.payroll_entries pe on pe.period_id = pp.id and pe.deleted_at is null
 where pp.deleted_at is null
 group by 1, 2, 3, 4
 order by 1, 2, 3;
```

Rezultatul pe 8 oct 2026: `demo` 2026-07 și 2026-08, `aprobat`, câte 8 rânduri, `rest_zero = 0`, `baza_cas_zero = 8`; `wise` 2026-10, `draft`, 0 rânduri.

- [ ] **Pasul 2: Candidații la facilitate (state calculate FĂRĂ ea)**

```sql
with perioade(din, pana, minim, suma, plafon) as (
  values (1, 6, 4050, 300, 4300), (7, 12, 4325, 200, 4600)
)
select o.slug, pp.an, pp.luna, pp.status, count(*) as afectate,
       sum(f.suma) as suma_neaplicata_lei,
       round(sum(f.suma) * 0.35 + sum(f.suma) * 0.065, 0) as net_lipsa_aprox_lei
  from public.payroll_entries pe
  join public.payroll_periods pp on pp.id = pe.period_id
  join public.organizations o on o.id = pe.organization_id
  join public.employment_contracts ec on ec.id = pe.contract_id
  join perioade f on pp.luna between f.din and f.pana
 where pp.an = 2026
   and pe.deleted_at is null and pp.deleted_at is null
   and abs(ec.salariu_baza - f.minim) < 0.005
   and ec.norma_ore_zi >= 8
   and pe.brut <= f.plafon
   and not (pe.calc_breakdown @> '[{"pas":"sumaNeimpozabila"}]'::jsonb)
 group by 1, 2, 3, 4
 order by 2, 3;
```

Rezultatul pe 8 oct 2026: zero rânduri. `net_lipsa_aprox` aproximează 83 de lei pe salariat (35% contribuții plus 10% impozit pe cei 65% rămași din 200).

- [ ] **Pasul 3: Expunerea viitoare**

```sql
select o.slug, count(*) as contracte_active,
       count(*) filter (where ec.salariu_baza = 4325 and ec.norma_ore_zi >= 8) as la_minim_norma_intreaga
  from public.employment_contracts ec
  join public.organizations o on o.id = ec.organization_id
 where ec.deleted_at is null and ec.status = 'activ'
 group by 1 order by 1;
```

Rezultatul pe 8 oct 2026: `demo` 8/0, `solemtrix-hardware-software-s-r-l` 4/0, `wise` 31/0.

- [ ] **Pasul 4: Funcția de scriere din producție**

```sql
select position('rest_de_plata' in pg_get_functiondef('public.payroll_scrie_rezultate(uuid,jsonb)'::regprocedure)) as are_rest_de_plata;
```

Pe 8 oct 2026 dă `0`, adică defectul D2 e prezent.

- [ ] **Pasul 5: Regula de decizie** (raportată utilizatorului cu cifrele de la pașii 1–4)
  - Dacă pasul 2 dă **zero** rânduri pe firme ≠ `demo`: nu se recalculează nimic și nu se notifică nimeni. Se merge la D2.
  - Dacă dă rânduri pe o firmă reală: **STOP**. Utilizatorul alege: (a) perioada se redeschide (`redeschidePerioada`) și se recalculează după D5, plus D112 rectificativă; (b) diferența se regularizează în luna curentă; (c) clientul e doar notificat. Planul nu atinge datele.
  - Dacă pasul 1 arată `rest_zero > 0` pe o firmă reală: același STOP, cu prioritate. Fișierul bancar al acelei perioade a plătit 0.

---

### Task D2: `payroll_scrie_rezultate` scrie toate coloanele calculate

**Fișiere:**

- Create: `supabase/migrations/0187_salarizare_scrie_toate_coloanele.sql`. Numărul: primul liber ≥ 0187 după `git fetch origin main && git ls-tree --name-only origin/main supabase/migrations/ | tail -3 && ls supabase/migrations | tail -3`. Flota a rezervat 0171–0178, Mentenanța 0180–0186. La coliziune, redenumești migrarea ta (e neaplicată).
- Modify: `tests/rls/proba-bani-si-timp.sql` (declarațiile de la l. 49-51, rândul de la l. 194-208, verificarea (6) de la l. 216-223).
- Test: `src/app/(app)/salarizare/actions-calcul.test.ts` (importuri la începutul fișierului; `describe` nou la final).

**Interfețe:**

- Consumă: semnătura neschimbată `public.payroll_scrie_rezultate(p_period_id uuid, p_randuri jsonb) returns table(inserate integer, actualizate integer)`.
- Produce: aceeași semnătură. `v_chei` are acum 54 de chei, toate obligatorii. Tipurile generate nu se schimbă.

- [ ] **Pasul 1: Scrie testul care pică.** În `actions-calcul.test.ts`, după `import { beforeEach, describe, expect, it, vi } from "vitest";` (l. 11), adaugă:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
```

La finalul fișierului:

```ts
/**
 * Ultima migrare care (re)definește `payroll_scrie_rezultate` — cea în vigoare
 * după aplicarea tuturor, în ordinea numerelor.
 */
function functiaDeScriereInVigoare(): string {
  const dir = join(process.cwd(), "supabase/migrations");
  const definitii = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .filter((sql) => /create or replace function public\.payroll_scrie_rezultate/i.test(sql));
  const ultima = definitii.at(-1);
  if (ultima === undefined) throw new Error("Nicio migrare nu definește payroll_scrie_rezultate.");
  return ultima;
}

const potriviri = (text: string, re: RegExp): ReadonlySet<string | undefined> =>
  new Set([...text.matchAll(re)].map((m) => m[1]));

describe("calculeazaPerioada — contractul cu `payroll_scrie_rezultate`", () => {
  // 0054–0060 au adăugat 13 coloane pe care acțiunea le trimite, dar funcția
  // le ignora tăcut: `rest_de_plata` rămânea 0, iar fișierul bancar plătea 0.
  it("fiecare cheie trimisă e cerută, actualizată ȘI inserată de funcția în vigoare", async () => {
    const server = pregateste();
    programeazaScrierea(server);

    await calculeazaPerioada({ id: ID_1 });

    const trimise = Object.keys(randuriScrise(server)[0] ?? {}).sort();
    expect(trimise.length).toBeGreaterThan(40);

    const sql = functiaDeScriereInVigoare();
    const cerute = potriviri(
      /v_chei\s+text\[\]\s*:=\s*array\[([\s\S]*?)\];/i.exec(sql)?.[1] ?? "",
      /'([a-z_]+)'/g,
    );
    const actualizate = potriviri(
      /\bset\b([\s\S]*?)\bfrom intrari i\b/i.exec(sql)?.[1] ?? "",
      /([a-z_]+)\s*=\s*i\./g,
    );
    const inserate = potriviri(
      /insert into public\.payroll_entries\s*\(([\s\S]*?)\)\s*select/i.exec(sql)?.[1] ?? "",
      /([a-z_]+)/g,
    );

    expect(
      trimise.filter((k) => !cerute.has(k)),
      "chei necerute în v_chei",
    ).toEqual([]);
    expect(
      trimise.filter((k) => k !== "employee_id" && !actualizate.has(k)),
      "chei ignorate de UPDATE",
    ).toEqual([]);
    expect(
      trimise.filter((k) => !inserate.has(k)),
      "chei ignorate de INSERT",
    ).toEqual([]);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(app)/salarizare/actions-calcul.test.ts" -t "contractul cu"
```

Eșecul așteptat: `chei necerute în v_chei` cu exact cele 13 chei: `avantaje_natura`, `baza_cas`, `baza_cass`, `baza_zilnica_cm`, `diurna_impozabila`, `diurna_neimpozabila`, `indemnizatie_cm_angajator`, `indemnizatie_cm_fnuass`, `indemnizatie_co`, `ore_supl_compensate`, `rest_de_plata`, `zile_cm_angajator`, `zile_cm_fnuass`.

- [ ] **Pasul 3: Implementarea minimă.** Creează `supabase/migrations/0187_salarizare_scrie_toate_coloanele.sql`:

```sql
-- supabase/migrations/0187_salarizare_scrie_toate_coloanele.sql
--
-- `payroll_scrie_rezultate` SCRIE TOT CE CALCULEAZĂ MOTORUL.
--
-- ── DEFECTUL ────────────────────────────────────────────────────────────────
-- 0054, 0055, 0057 și 0060 au adăugat pe `payroll_entries` treisprezece
-- coloane, iar `calculeazaPerioada` le trimite pe toate. Funcția de scriere —
-- redefinită în 0126 și 0146 din corpul EXTRAS din bază — a rămas cu lista din
-- 0052: `jsonb_populate_record` le citea, dar nici UPDATE-ul, nici INSERT-ul nu
-- le foloseau. Fără nicio eroare:
--   · `rest_de_plata` rămânea 0 pe orice rând nou, iar fișierul bancar
--     (`bancar/route.ts:122`) și fluturașul PDF folosesc exact acest câmp;
--   · `baza_cas`/`baza_cass` = 0 pe toate cele 16 rânduri din producție
--     (verificat prin MCP pe 8 oct 2026);
--   · indemnizațiile CO/CM, diurna și avantajele în natură intrau în brut, dar
--     coloanele lor din stat rămâneau 0.
-- Rândurile existente (firma demo, iul.–aug. 2026) au `rest_de_plata` corect
-- doar datorită backfill-ului din 0055, aplicat după calculul lor.
--
-- ── CE FACE ─────────────────────────────────────────────────────────────────
-- Cele 13 chei devin OBLIGATORII în `v_chei` (aceeași regulă ca la 0126: o
-- recalculare înlocuiește rândul întreg) și sunt scrise de ambele ramuri.
-- Corpul e cel din 0146, neschimbat în rest — inclusiv steagul local
-- `app.payroll_scrie` citit de `internal.payroll_entries_doar_prin_motor`.
--
-- Poarta care ține TS și SQL lipite: `src/app/(app)/salarizare/actions-calcul.test.ts`
-- („contractul cu `payroll_scrie_rezultate`”) compară cheile trimise de acțiune
-- cu lista, UPDATE-ul și INSERT-ul ultimei migrări care redefinește funcția.

begin;

-- =====================================================================================
-- 1. Funcția de scriere, cu toate coloanele
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.payroll_scrie_rezultate(p_period_id uuid, p_randuri jsonb)
 RETURNS TABLE(inserate integer, actualizate integer)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_org         uuid;
  v_inserate    integer := 0;
  v_actualizate integer := 0;
  v_lipsa       text;
  v_chei        text[] := array[
    'employee_id',
    'contract_id',
    'status',
    'zile_lucratoare_luna',
    'zile_lucrate',
    'zile_concediu_odihna',
    'zile_concediu_medical',
    'zile_absenta_nemotivata',
    'zile_fara_plata',
    'ore_lucrate',
    'ore_suplimentare',
    'ore_noapte',
    'baza_salariu',
    'suma_ore_suplimentare',
    'spor_noapte',
    'prime_total',
    'brut',
    'nr_tichete',
    'valoare_tichete',
    'baza_cas_cass',
    'cas',
    'cass',
    'deducere_personala',
    'baza_impozit',
    'impozit',
    'cam_angajator',
    'net',
    'retineri_total',
    'net_de_plata',
    'cost_total_angajator',
    'settings_snapshot',
    'calc_breakdown',
    'calc_warnings',
    'calculat_la',
    'scutire_fiscala',
    'zile_repaus_lucrate',
    'zile_sarbatoare_lucrate',
    'ore_repaus',
    'ore_sarbatoare',
    'spor_repaus',
    'spor_sarbatoare',
    'baza_cas',
    'baza_cass',
    'indemnizatie_co',
    'indemnizatie_cm_angajator',
    'indemnizatie_cm_fnuass',
    'zile_cm_angajator',
    'zile_cm_fnuass',
    'baza_zilnica_cm',
    'ore_supl_compensate',
    'avantaje_natura',
    'diurna_neimpozabila',
    'diurna_impozabila',
    'rest_de_plata'
  ];
begin
  -- Steagul pe care îl citește `internal.payroll_entries_doar_prin_motor`.
  -- LOCAL, deci moare cu tranzacția.
  perform set_config('app.payroll_scrie', 'on', true);
  if jsonb_typeof(p_randuri) is distinct from 'array' then
    raise exception 'Rândurile de salariu trebuie trimise ca listă.' using errcode = 'P0001';
  end if;

  select k into v_lipsa
    from jsonb_array_elements(p_randuri) e
    cross join lateral unnest(v_chei) k
   where not (e ? k)
   limit 1;

  if v_lipsa is not null then
    raise exception
      'Rândul de salariu este incomplet: lipsește câmpul „%". Recalcularea înlocuiește rândul întreg, deci toate câmpurile sunt obligatorii.',
      v_lipsa using errcode = 'P0001';
  end if;

  select pp.organization_id into v_org
    from public.payroll_periods pp
   where pp.id = p_period_id
     and pp.deleted_at is null;

  if v_org is null then
    raise exception 'Perioada de salarizare nu a fost găsită.' using errcode = 'P0001';
  end if;

  with intrari as (
    select (jsonb_populate_record(null::public.payroll_entries, e)).*
      from jsonb_array_elements(p_randuri) e
  ),
  modificate as (
    update public.payroll_entries t
       set
           contract_id = i.contract_id,
           status = i.status,
           zile_lucratoare_luna = i.zile_lucratoare_luna,
           zile_lucrate = i.zile_lucrate,
           zile_concediu_odihna = i.zile_concediu_odihna,
           zile_concediu_medical = i.zile_concediu_medical,
           zile_absenta_nemotivata = i.zile_absenta_nemotivata,
           zile_fara_plata = i.zile_fara_plata,
           ore_lucrate = i.ore_lucrate,
           ore_suplimentare = i.ore_suplimentare,
           ore_noapte = i.ore_noapte,
           baza_salariu = i.baza_salariu,
           suma_ore_suplimentare = i.suma_ore_suplimentare,
           spor_noapte = i.spor_noapte,
           prime_total = i.prime_total,
           brut = i.brut,
           nr_tichete = i.nr_tichete,
           valoare_tichete = i.valoare_tichete,
           baza_cas_cass = i.baza_cas_cass,
           cas = i.cas,
           cass = i.cass,
           deducere_personala = i.deducere_personala,
           baza_impozit = i.baza_impozit,
           impozit = i.impozit,
           cam_angajator = i.cam_angajator,
           net = i.net,
           retineri_total = i.retineri_total,
           net_de_plata = i.net_de_plata,
           cost_total_angajator = i.cost_total_angajator,
           settings_snapshot = i.settings_snapshot,
           calc_breakdown = i.calc_breakdown,
           calc_warnings = i.calc_warnings,
           calculat_la = i.calculat_la,
           scutire_fiscala = i.scutire_fiscala,
           zile_repaus_lucrate = i.zile_repaus_lucrate,
           zile_sarbatoare_lucrate = i.zile_sarbatoare_lucrate,
           ore_repaus = i.ore_repaus,
           ore_sarbatoare = i.ore_sarbatoare,
           spor_repaus = i.spor_repaus,
           spor_sarbatoare = i.spor_sarbatoare,
           baza_cas = i.baza_cas,
           baza_cass = i.baza_cass,
           indemnizatie_co = i.indemnizatie_co,
           indemnizatie_cm_angajator = i.indemnizatie_cm_angajator,
           indemnizatie_cm_fnuass = i.indemnizatie_cm_fnuass,
           zile_cm_angajator = i.zile_cm_angajator,
           zile_cm_fnuass = i.zile_cm_fnuass,
           baza_zilnica_cm = i.baza_zilnica_cm,
           ore_supl_compensate = i.ore_supl_compensate,
           avantaje_natura = i.avantaje_natura,
           diurna_neimpozabila = i.diurna_neimpozabila,
           diurna_impozabila = i.diurna_impozabila,
           rest_de_plata = i.rest_de_plata
      from intrari i
     where t.organization_id = v_org
       and t.period_id = p_period_id
       and t.employee_id = i.employee_id
       and t.deleted_at is null
    returning 1
  )
  select count(*) into v_actualizate from modificate;

  with intrari as (
    select (jsonb_populate_record(null::public.payroll_entries, e)).*
      from jsonb_array_elements(p_randuri) e
  ),
  adaugate as (
    insert into public.payroll_entries (
        organization_id,
        period_id,
        employee_id,
        contract_id,
        status,
        zile_lucratoare_luna,
        zile_lucrate,
        zile_concediu_odihna,
        zile_concediu_medical,
        zile_absenta_nemotivata,
        zile_fara_plata,
        ore_lucrate,
        ore_suplimentare,
        ore_noapte,
        baza_salariu,
        suma_ore_suplimentare,
        spor_noapte,
        prime_total,
        brut,
        nr_tichete,
        valoare_tichete,
        baza_cas_cass,
        cas,
        cass,
        deducere_personala,
        baza_impozit,
        impozit,
        cam_angajator,
        net,
        retineri_total,
        net_de_plata,
        cost_total_angajator,
        settings_snapshot,
        calc_breakdown,
        calc_warnings,
        calculat_la,
        scutire_fiscala,
        zile_repaus_lucrate,
        zile_sarbatoare_lucrate,
        ore_repaus,
        ore_sarbatoare,
        spor_repaus,
        spor_sarbatoare,
        baza_cas,
        baza_cass,
        indemnizatie_co,
        indemnizatie_cm_angajator,
        indemnizatie_cm_fnuass,
        zile_cm_angajator,
        zile_cm_fnuass,
        baza_zilnica_cm,
        ore_supl_compensate,
        avantaje_natura,
        diurna_neimpozabila,
        diurna_impozabila,
        rest_de_plata
      )
      select
        v_org,
        p_period_id,
        i.employee_id,
        i.contract_id,
        i.status,
        i.zile_lucratoare_luna,
        i.zile_lucrate,
        i.zile_concediu_odihna,
        i.zile_concediu_medical,
        i.zile_absenta_nemotivata,
        i.zile_fara_plata,
        i.ore_lucrate,
        i.ore_suplimentare,
        i.ore_noapte,
        i.baza_salariu,
        i.suma_ore_suplimentare,
        i.spor_noapte,
        i.prime_total,
        i.brut,
        i.nr_tichete,
        i.valoare_tichete,
        i.baza_cas_cass,
        i.cas,
        i.cass,
        i.deducere_personala,
        i.baza_impozit,
        i.impozit,
        i.cam_angajator,
        i.net,
        i.retineri_total,
        i.net_de_plata,
        i.cost_total_angajator,
        i.settings_snapshot,
        i.calc_breakdown,
        i.calc_warnings,
        i.calculat_la,
        i.scutire_fiscala,
        i.zile_repaus_lucrate,
        i.zile_sarbatoare_lucrate,
        i.ore_repaus,
        i.ore_sarbatoare,
        i.spor_repaus,
        i.spor_sarbatoare,
        i.baza_cas,
        i.baza_cass,
        i.indemnizatie_co,
        i.indemnizatie_cm_angajator,
        i.indemnizatie_cm_fnuass,
        i.zile_cm_angajator,
        i.zile_cm_fnuass,
        i.baza_zilnica_cm,
        i.ore_supl_compensate,
        i.avantaje_natura,
        i.diurna_neimpozabila,
        i.diurna_impozabila,
        i.rest_de_plata
        from intrari i
       where not exists (
         select 1 from public.payroll_entries t
          where t.organization_id = v_org
            and t.period_id = p_period_id
            and t.employee_id = i.employee_id
            and t.deleted_at is null
       )
    returning 1
  )
  select count(*) into v_inserate from adaugate;

  return query select v_inserate, v_actualizate;
end;
$function$;

-- Granturile se rescriu, ca migrarea să fie corectă și pe o bază unde `create
-- or replace` ar fi creat funcția de la zero.
revoke all on function public.payroll_scrie_rezultate(uuid, jsonb) from public, anon;
grant execute on function public.payroll_scrie_rezultate(uuid, jsonb) to authenticated;

commit;
```

În `tests/rls/proba-bani-si-timp.sql`, declarațiile (l. 49-51), bloc vechi:

```sql
  v_rand     jsonb;
  v_actor    uuid;
  v_nr       int;
```

Bloc nou:

```sql
  v_rand     jsonb;
  v_actor    uuid;
  v_nr       int;
  v_rest     numeric;
  v_baza_cas numeric;
```

După atribuirea `v_rand := jsonb_build_object( ... 'spor_repaus', 0, 'spor_sarbatoare', 0 );` (l. 194-208), adaugă. `jsonb_build_object` acceptă cel mult 100 de argumente, de aceea concatenarea:

```sql
  -- Cele 13 chei din 0187 — în al doilea obiect: `jsonb_build_object` acceptă
  -- cel mult 100 de argumente, iar rândul întreg are 108.
  v_rand := v_rand || jsonb_build_object(
    'baza_cas', 5000, 'baza_cass', 5000, 'indemnizatie_co', 0,
    'indemnizatie_cm_angajator', 0, 'indemnizatie_cm_fnuass', 0,
    'zile_cm_angajator', 0, 'zile_cm_fnuass', 0, 'baza_zilnica_cm', 0,
    'ore_supl_compensate', 0, 'avantaje_natura', 0,
    'diurna_neimpozabila', 0, 'diurna_impozabila', 0, 'rest_de_plata', 2925
  );
```

Verificarea (6), bloc vechi (l. 216-223):

```sql
    reset role;
    select count(*) into v_nr from public.payroll_entries where period_id = v_perioada;
    if v_nr = 1 then
      raise notice '  ✓ (6) `payroll_scrie_rezultate` scrie rândul de salariu';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (6) motorul n-a scris nimic (% rânduri)', v_nr;
    end if;
```

Bloc nou:

```sql
    reset role;
    select count(*), max(rest_de_plata), max(baza_cas)
      into v_nr, v_rest, v_baza_cas
      from public.payroll_entries where period_id = v_perioada;
    if v_nr = 1 and v_rest = 2925 and v_baza_cas = 5000 then
      raise notice '  ✓ (6) `payroll_scrie_rezultate` scrie rândul, cu restul de plată și baza CAS';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (6) % rânduri, rest_de_plata = %, baza_cas = % (așteptat 1, 2925, 5000)',
        v_nr, v_rest, v_baza_cas;
    end if;
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(app)/salarizare/actions-calcul.test.ts" src/config/migrari.test.ts
```

- [ ] **Pasul 5: Bancul local (migrări + bariere + probe, ca CI)**

```bash
cd /srv/apps/ERP && bash .claude/skills/administrativo/scripts/banc-migrare.sh
```

Așteptat: ieșire 0, iar în jurnal `✓ (6) \`payroll_scrie_rezultate\` scrie rândul, cu restul de plată și baza CAS`. Ieșirea 3 înseamnă că bancul a sărit (de exemplu, fără docker): nu e verde, se raportează. O rulare sub 30 s e suspectă de sărire.

- [ ] **Pasul 6: LANȚ** plus `pnpm exec prettier --check "src/app/(app)/salarizare/actions-calcul.test.ts"`.

- [ ] **Pasul 7: Commit**

```bash
cd /srv/apps/ERP
git status --short -- supabase/migrations/0187_salarizare_scrie_toate_coloanele.sql tests/rls/proba-bani-si-timp.sql "src/app/(app)/salarizare/actions-calcul.test.ts"
git fetch origin main
git diff --name-only HEAD origin/main -- supabase/migrations tests/rls "src/app/(app)/salarizare"
git add -- supabase/migrations/0187_salarizare_scrie_toate_coloanele.sql
git commit --only -- supabase/migrations/0187_salarizare_scrie_toate_coloanele.sql tests/rls/proba-bani-si-timp.sql "src/app/(app)/salarizare/actions-calcul.test.ts" \
  -m "fix(salarizare): payroll_scrie_rezultate scrie toate coloanele calculate (0187)" \
  -m "Funcția ignora 13 coloane trimise de calculeazaPerioada (rest_de_plata, baza_cas/cass, indemnizațiile CO/CM, diurna, avantajele în natură): fișierul bancar ar fi plătit 0 pe orice rând nou. Poartă TS↔SQL în actions-calcul.test.ts." \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git merge origin/main
git push origin main
```

După push, `staging.yml` aplică singur 0187 pe baza de **staging** (proiect Supabase separat, păzit de `scripts/checks/tinta-db.sh`; `ADM_CONFIRM_AUTO` nu are efect pe producție). Verifică rularea: pasul „Migrări pe baza de staging” verde, durata totală peste 30 s. E prima aplicare reală a funcției noi, înaintea producției.

- [ ] **Pasul 8: STOP — aplicarea pe producție cere confirmarea explicită a utilizatorului.** Întrebarea: „Aplic 0187 pe producție acum? Firma `wise` are octombrie în ciornă; fără 0187, primul calcul scrie rest de plată 0.” Numai după „da”:

```bash
cd /srv/apps/ERP && bash .claude/skills/administrativo/scripts/aplica-cloud.sh supabase/migrations/0187_salarizare_scrie_toate_coloanele.sql
```

Verificarea prin MCP: `select position('rest_de_plata' in pg_get_functiondef('public.payroll_scrie_rezultate(uuid,jsonb)'::regprocedure)) > 0;` trebuie să dea `true`. În plus, `select nume from internal.migrari_aplicate where nume like '0187%';` trebuie să dea un rând.

---

### Task D3: Etapa „facilitate salariu minim” în domeniu

**Fișiere:**

- Create: `src/domain/payroll/etape/facilitate-salariu-minim.ts`
- Modify: `src/domain/payroll/erori.ts`: `CODURI_PROBLEMA` după `"SAL_CAS_LA_MINIM",` (l. 34); `CATALOG` după intrarea `SAL_CAS_LA_MINIM` (l. 186-194).
- Test: `src/domain/payroll/etape/facilitate-salariu-minim.test.ts`. Poarta existentă `erori.test.ts` („fiecare cod emis de o etapă e înregistrat în catalog”) scanează `etape/`, deci codul și catalogul intră în același commit.

**Interfețe:**

- Consumă: `rotunjesteLaBani(lei: number): number` din `src/domain/bani.ts:48`; `ProblemaEtapa` din `./probleme`.
- Produce:

```ts
export interface PerioadaFacilitateSalariuMinim {
  readonly valabilDeLa: string; // „AAAA-LL-ZZ”, inclusiv
  readonly valabilPana: string; // „AAAA-LL-ZZ”, inclusiv
  readonly salariuMinim: number;
  readonly suma: number;
  readonly plafonVenitBrut: number;
  readonly temei: string;
}
export const FACILITATE_IANUARIE_IUNIE_2026: PerioadaFacilitateSalariuMinim;
export const FACILITATE_IULIE_DECEMBRIE_2026: PerioadaFacilitateSalariuMinim;
export const PERIOADE_FACILITATE_SALARIU_MINIM: readonly PerioadaFacilitateSalariuMinim[];
export const PAS_SUMA_NEIMPOZABILA = "sumaNeimpozabila";
export function facilitatePentruLuna(luna: string): PerioadaFacilitateSalariuMinim | null;
export type MotivFaraFacilitate =
  | "luna_fara_facilitate" | "functie_secundara" | "norma_partiala"
  | "salariu_diferit_de_minim" | "venit_peste_plafon" | "fara_zile_platite";
export interface IntrareFacilitate {
  readonly luna: string; readonly salariuBaza: number; readonly venitBrut: number;
  readonly normaIntreaga: boolean; readonly functieDeBaza: boolean;
  readonly zileCuVenitSalarial: number; readonly zileLucratoareLuna: number;
}
export interface RezultatFacilitate {
  readonly suma: number; readonly perioada: PerioadaFacilitateSalariuMinim | null;
  readonly motiv: MotivFaraFacilitate | null; readonly probleme: readonly ProblemaEtapa[];
}
export function calculeazaFacilitateSalariuMinim(i: IntrareFacilitate): RezultatFacilitate;
export function sumaNeimpozabilaDinBreakdown(breakdown: unknown): number;
```

- [ ] **Pasul 1: Scrie testul care pică.** `src/domain/payroll/etape/facilitate-salariu-minim.test.ts`:

```ts
// src/domain/payroll/etape/facilitate-salariu-minim.test.ts
import { describe, expect, it } from "vitest";

import { problema } from "../erori";
import {
  calculeazaFacilitateSalariuMinim,
  FACILITATE_IULIE_DECEMBRIE_2026,
  facilitatePentruLuna,
  PAS_SUMA_NEIMPOZABILA,
  PERIOADE_FACILITATE_SALARIU_MINIM,
  sumaNeimpozabilaDinBreakdown,
  type IntrareFacilitate,
} from "./facilitate-salariu-minim";

const LA_MINIM_IULIE: IntrareFacilitate = {
  luna: "2026-07",
  salariuBaza: 4325,
  venitBrut: 4325,
  normaIntreaga: true,
  functieDeBaza: true,
  zileCuVenitSalarial: 21,
  zileLucratoareLuna: 21,
};

describe("perioadele facilității (OUG 89/2025 art. III alin. (1) și (6))", () => {
  it("ianuarie–iunie 2026: 300 de lei, minim 4.050, plafon 4.300", () => {
    expect(facilitatePentruLuna("2026-01")).toMatchObject({
      suma: 300,
      salariuMinim: 4050,
      plafonVenitBrut: 4300,
    });
    expect(facilitatePentruLuna("2026-06")?.suma).toBe(300);
  });

  it("iulie–decembrie 2026: 200 de lei, minim 4.325, plafon 4.600", () => {
    expect(facilitatePentruLuna("2026-07")).toBe(FACILITATE_IULIE_DECEMBRIE_2026);
    expect(facilitatePentruLuna("2026-12")).toMatchObject({
      suma: 200,
      salariuMinim: 4325,
      plafonVenitBrut: 4600,
    });
  });

  it("nimic în afara lui 2026 și nimic pentru o lună scrisă greșit", () => {
    for (const luna of ["2025-12", "2027-01", "2026-13", "2026-7", "", "iulie"]) {
      expect(facilitatePentruLuna(luna), luna).toBeNull();
    }
  });

  it("perioadele nu se suprapun și fiecare își numește temeiul", () => {
    const sortate = [...PERIOADE_FACILITATE_SALARIU_MINIM].sort((a, b) =>
      a.valabilDeLa.localeCompare(b.valabilDeLa),
    );
    sortate.forEach((p, i) => {
      const anterioara = sortate[i - 1];
      if (anterioara !== undefined) expect(p.valabilDeLa > anterioara.valabilPana).toBe(true);
      expect(p.temei).toContain("OUG 89/2025");
    });
  });
});

describe("condițiile cumulative (alin. (1) lit. a) și b))", () => {
  it("la minim, normă întreagă, funcția de bază, lună întreagă: 200 de lei", () => {
    const r = calculeazaFacilitateSalariuMinim(LA_MINIM_IULIE);
    expect(r.suma).toBe(200);
    expect(r.motiv).toBeNull();
    expect(r.probleme.map((p) => p.cod)).toEqual(["SAL_FACILITATE_SALARIU_MINIM"]);
  });

  it.each([
    ["salariul de bază peste minim", { salariuBaza: 4326 }, "salariu_diferit_de_minim"],
    ["salariul de bază sub minim", { salariuBaza: 4050 }, "salariu_diferit_de_minim"],
    ["venitul brut peste 4.600", { venitBrut: 4600.01 }, "venit_peste_plafon"],
    ["normă parțială", { normaIntreaga: false }, "norma_partiala"],
    ["în afara funcției de bază", { functieDeBaza: false }, "functie_secundara"],
    ["nicio zi cu venit salarial", { zileCuVenitSalarial: 0 }, "fara_zile_platite"],
    ["o lună din 2027", { luna: "2027-01" }, "luna_fara_facilitate"],
  ] as const)("%s ⇒ 0 lei", (_, peste, motiv) => {
    const r = calculeazaFacilitateSalariuMinim({ ...LA_MINIM_IULIE, ...peste });
    expect(r.suma).toBe(0);
    expect(r.motiv).toBe(motiv);
    expect(r.probleme).toEqual([]);
  });

  it("plafonul e inclusiv: exact 4.600 de lei primește încă suma", () => {
    expect(calculeazaFacilitateSalariuMinim({ ...LA_MINIM_IULIE, venitBrut: 4600 }).suma).toBe(200);
  });

  it("în ianuarie–iunie condiția e minimul de atunci (4.050), iar suma e 300", () => {
    const r = calculeazaFacilitateSalariuMinim({
      ...LA_MINIM_IULIE,
      luna: "2026-03",
      salariuBaza: 4050,
      venitBrut: 4300,
    });
    expect(r.suma).toBe(300);
  });
});

describe("diminuarea pe fracțiunea de lună (alin. (4))", () => {
  it("angajat venit pe la jumătatea lunii: suma scade proporțional, la ban", () => {
    const r = calculeazaFacilitateSalariuMinim({
      ...LA_MINIM_IULIE,
      venitBrut: 2265.48,
      zileCuVenitSalarial: 11,
      zileLucratoareLuna: 21,
    });
    expect(r.suma).toBe(104.76);
    expect(r.probleme[0]?.detalii).toContain("11/21");
  });

  it("mai multe zile decât are luna nu dau mai mult decât suma întreagă", () => {
    expect(
      calculeazaFacilitateSalariuMinim({ ...LA_MINIM_IULIE, zileCuVenitSalarial: 25 }).suma,
    ).toBe(200);
  });
});

describe("citirea sumei din calc_breakdown salvat", () => {
  it("găsește pasul motorului", () => {
    expect(
      sumaNeimpozabilaDinBreakdown([
        { pas: "brut", valoare: 4325 },
        { pas: PAS_SUMA_NEIMPOZABILA, valoare: 200 },
      ]),
    ).toBe(200);
  });

  it("rândurile vechi, fără pas, sau un JSON stricat dau 0, fără să arunce", () => {
    for (const v of [
      null,
      undefined,
      {},
      "x",
      [],
      [{ pas: PAS_SUMA_NEIMPOZABILA, valoare: "200" }],
      [{ pas: PAS_SUMA_NEIMPOZABILA, valoare: -5 }],
    ]) {
      expect(sumaNeimpozabilaDinBreakdown(v)).toBe(0);
    }
  });

  it("numele pasului e cel scris de motor", () => {
    expect(PAS_SUMA_NEIMPOZABILA).toBe("sumaNeimpozabila");
  });
});

describe("catalogul", () => {
  it("codul etapei e informativ și îi spune omului ce să verifice", () => {
    const p = problema("SAL_FACILITATE_SALARIU_MINIM");
    expect(p.severitate).toBe("informativ");
    expect(p.cumSeRepara).toContain("funcția de bază");
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/domain/payroll/etape/facilitate-salariu-minim.test.ts
```

Eșecul așteptat: `Failed to resolve import "./facilitate-salariu-minim"`.

- [ ] **Pasul 3: Implementarea minimă.** `src/domain/payroll/etape/facilitate-salariu-minim.ts`:

```ts
// src/domain/payroll/etape/facilitate-salariu-minim.ts
//
// Suma neimpozabilă de la salariul minim — OUG 89/2025 art. III, etapă pură din
// lanțul de salarizare.
//
// ── TEXTUL ──────────────────────────────────────────────────────────────────
// Citit cu `curl` pe 8 oct 2026, forma consolidată la 16.08.2026,
// legislatie.just.ro doc. 305817:
//   alin. (1) — salariaților cu CIM „încadrați cu normă întreagă, la locul unde
//     se află funcția de bază” nu li se datorează impozit și contribuții sociale
//     pentru 300 lei/lună (ian.–iun. 2026) și 200 lei/lună (iul.–dec. 2026),
//     dacă, cumulativ:
//     a) salariul de bază brut lunar din contract, fără sporuri, e EGAL cu
//        salariul minim în vigoare în luna veniturilor;
//     b) venitul brut din salarii al lunii, din același contract, FĂRĂ tichete
//        de masă, vouchere de vacanță și indemnizație de hrană, e de cel mult
//        4.300 lei (ian.–iun.), respectiv 4.600 lei (iul.–dec.), inclusiv.
//     Derogarea e de la art. 78 (impozit), 139 alin. (1) și 140 (baza CAS),
//     157 alin. (1) (baza CASS) și 220^4 alin. (1) (baza CAM) — NU și de la
//     art. 77: deducerea personală se ia pe brutul întreg.
//   alin. (2) — un salariu de bază diminuat în 2026 pierde condiția a);
//   alin. (4) — suma se diminuează după perioada din lună la minim, data
//     angajării, fracția din lună pentru care se determină venitul și data
//     încetării;
//   alin. (5) — salariul minim folosit ca bază minimă la timp parțial
//     (art. 146 alin. (5^6), art. 168 alin. (6^1)) scade cu aceeași sumă;
//   alin. (6) — se aplică doar veniturilor din ianuarie–decembrie 2026.
// Salariul minim: 4.050 lei până la 30 iunie 2026 (HG 1.506/2024, abrogată de
// HG 146/2026 art. 2), 4.325 lei din 1 iulie 2026 (HG 146/2026 art. 1, MO 196
// din 13.03.2026).
//
// ── DE CE UN TABEL ÎN COD ȘI NU O SETARE A FIRMEI ──────────────────────────
// E o derogare NAȚIONALĂ, cu dată de expirare. O prelungire cere oricum un act
// normativ citit și un test. Condiția a) se compară cu minimul din tabel, nu cu
// `payroll_settings.salariu_minim_brut`: o firmă care a uitat să-și actualizeze
// setarea în iulie nu trebuie să piardă tăcut facilitatea.
//
// ── CE PRESUPUNE ETAPA (⚠ NOTES.md §3) ────────────────────────────────────
//   · fracția din alin. (4) = zile cu venit salarial (lucrate + concediu de
//     odihnă) / zile lucrătoare; zilele de concediu medical NU intră;
//   · suma se rotunjește la ban, nu la leu;
//   · funcția de bază și „salariul nediminuat în 2026” vin de la apelant —
//     aplicația nu are încă niciun câmp pentru ele.
//
// Funcție PURĂ: luna vine ca dată („AAAA-LL”), niciodată din ceasul de sistem.

import { rotunjesteLaBani } from "../../bani";
import type { ProblemaEtapa } from "./probleme";

export type { ProblemaEtapa };

export interface PerioadaFacilitateSalariuMinim {
  /** Prima zi a perioadei, „AAAA-LL-ZZ”, inclusiv. */
  readonly valabilDeLa: string;
  /** Ultima zi a perioadei, „AAAA-LL-ZZ”, inclusiv. */
  readonly valabilPana: string;
  /** Salariul de bază minim brut pe țară în vigoare în lunile perioadei. */
  readonly salariuMinim: number;
  /** Suma lunară scutită, în lei, la normă întreagă și lună întreagă. */
  readonly suma: number;
  /** Venitul brut maxim al lunii, inclusiv, fără tichete, vouchere și indemnizație de hrană. */
  readonly plafonVenitBrut: number;
  readonly temei: string;
}

export const FACILITATE_IANUARIE_IUNIE_2026: PerioadaFacilitateSalariuMinim = {
  valabilDeLa: "2026-01-01",
  valabilPana: "2026-06-30",
  salariuMinim: 4050,
  suma: 300,
  plafonVenitBrut: 4300,
  temei: "OUG 89/2025 art. III alin. (1); salariul minim din HG 1.506/2024",
};

export const FACILITATE_IULIE_DECEMBRIE_2026: PerioadaFacilitateSalariuMinim = {
  valabilDeLa: "2026-07-01",
  valabilPana: "2026-12-31",
  salariuMinim: 4325,
  suma: 200,
  plafonVenitBrut: 4600,
  temei: "OUG 89/2025 art. III alin. (1); salariul minim din HG 146/2026 art. 1",
};

export const PERIOADE_FACILITATE_SALARIU_MINIM: readonly PerioadaFacilitateSalariuMinim[] = [
  FACILITATE_IANUARIE_IUNIE_2026,
  FACILITATE_IULIE_DECEMBRIE_2026,
];

/** Numele pasului din `calc_breakdown` sub care motorul înregistrează suma. */
export const PAS_SUMA_NEIMPOZABILA = "sumaNeimpozabila";

const RE_LUNA = /^\d{4}-(0[1-9]|1[0-2])$/u;

/** Perioada în care cade luna veniturilor („AAAA-LL”), sau `null`. */
export function facilitatePentruLuna(luna: string): PerioadaFacilitateSalariuMinim | null {
  if (!RE_LUNA.test(luna)) return null;
  const ziua = `${luna}-01`;
  return (
    PERIOADE_FACILITATE_SALARIU_MINIM.find((p) => ziua >= p.valabilDeLa && ziua <= p.valabilPana) ??
    null
  );
}

export type MotivFaraFacilitate =
  | "luna_fara_facilitate"
  | "functie_secundara"
  | "norma_partiala"
  | "salariu_diferit_de_minim"
  | "venit_peste_plafon"
  | "fara_zile_platite";

export interface IntrareFacilitate {
  /** „AAAA-LL” — luna căreia îi sunt aferente veniturile, nu luna plății. */
  readonly luna: string;
  readonly salariuBaza: number;
  /** Venitul brut al lunii din același contract, FĂRĂ tichete, vouchere și indemnizație de hrană. */
  readonly venitBrut: number;
  readonly normaIntreaga: boolean;
  readonly functieDeBaza: boolean;
  /** Zilele cu venit salarial: lucrate + concediu de odihnă. */
  readonly zileCuVenitSalarial: number;
  readonly zileLucratoareLuna: number;
}

export interface RezultatFacilitate {
  /** Suma scutită, în lei, rotunjită la ban. 0 când nu se aplică. */
  readonly suma: number;
  readonly perioada: PerioadaFacilitateSalariuMinim | null;
  readonly motiv: MotivFaraFacilitate | null;
  readonly probleme: readonly ProblemaEtapa[];
}

/** Comparația sumelor în lei se face la ban. */
const LA_BAN = 0.005;

export function calculeazaFacilitateSalariuMinim(i: IntrareFacilitate): RezultatFacilitate {
  const perioada = facilitatePentruLuna(i.luna);
  const fara = (motiv: MotivFaraFacilitate): RezultatFacilitate => ({
    suma: 0,
    perioada,
    motiv,
    probleme: [],
  });
  if (perioada === null) return fara("luna_fara_facilitate");
  if (!i.functieDeBaza) return fara("functie_secundara");
  if (!i.normaIntreaga) return fara("norma_partiala");
  if (Math.abs(i.salariuBaza - perioada.salariuMinim) > LA_BAN) {
    return fara("salariu_diferit_de_minim");
  }
  if (i.venitBrut > perioada.plafonVenitBrut + LA_BAN) return fara("venit_peste_plafon");
  if (i.zileLucratoareLuna <= 0 || i.zileCuVenitSalarial <= 0) return fara("fara_zile_platite");

  const fractie = Math.min(1, i.zileCuVenitSalarial / i.zileLucratoareLuna);
  const suma = rotunjesteLaBani(perioada.suma * fractie);
  const detalii =
    fractie < 1
      ? `${suma.toFixed(2)} lei din ${String(perioada.suma)} (${String(i.zileCuVenitSalarial)}/${String(i.zileLucratoareLuna)} zile cu venit salarial), scutiți de impozit, CAS, CASS și CAM — ${perioada.temei}.`
      : `${suma.toFixed(2)} lei scutiți de impozit, CAS, CASS și CAM — ${perioada.temei}.`;
  return {
    suma,
    perioada,
    motiv: null,
    probleme: [{ cod: "SAL_FACILITATE_SALARIU_MINIM", detalii }],
  };
}

/**
 * Suma scutită dintr-un `calc_breakdown` salvat în bază (`payroll_entries`).
 *
 * Fluturașul PDF, e-mailul și D112 citesc rândul de aici, nu dintr-o coloană:
 * repararea facilității nu depinde de o migrare. Rândurile vechi n-au pasul,
 * deci dau 0 — exact ce s-a aplicat atunci.
 */
export function sumaNeimpozabilaDinBreakdown(breakdown: unknown): number {
  if (!Array.isArray(breakdown)) return 0;
  for (const pas of breakdown as readonly unknown[]) {
    if (typeof pas !== "object" || pas === null) continue;
    const { pas: nume, valoare } = pas as { pas?: unknown; valoare?: unknown };
    if (nume !== PAS_SUMA_NEIMPOZABILA) continue;
    return typeof valoare === "number" && Number.isFinite(valoare) && valoare > 0 ? valoare : 0;
  }
  return 0;
}
```

În `src/domain/payroll/erori.ts`, bloc vechi (l. 33-35):

```ts
  "SAL_TICHETE_REGIM_NECONFIRMAT",
  "SAL_CAS_LA_MINIM",
  "SAL_AVANTAJ_NATURA_PESTE_NET",
```

Bloc nou:

```ts
  "SAL_TICHETE_REGIM_NECONFIRMAT",
  "SAL_CAS_LA_MINIM",
  "SAL_FACILITATE_SALARIU_MINIM",
  "SAL_AVANTAJ_NATURA_PESTE_NET",
```

Și în `CATALOG`, bloc vechi (l. 193-195):

```ts
    unde: "/angajati",
  },
  SAL_AVANTAJ_NATURA_PESTE_NET: {
```

Bloc nou:

```ts
    unde: "/angajati",
  },
  SAL_FACILITATE_SALARIU_MINIM: {
    severitate: "informativ",
    mesaj: "S-a aplicat suma neimpozabilă de la salariul minim (OUG 89/2025 art. III).",
    cauza:
      "Salariul de bază din contract e egal cu salariul minim al lunii, contractul e cu normă întreagă, iar venitul brut nu trece de plafon. Aplicația presupune că firma e locul funcției de bază, fiindcă fișa angajatului nu are încă acest câmp.",
    cumSeRepara:
      "Verificați că angajatul are la firmă funcția de bază și că salariul lui de bază nu a fost micșorat în 2026. În oricare dintre cazuri suma nu se cuvine, iar calculul trebuie corectat manual.",
    unde: "/angajati",
  },
  SAL_AVANTAJ_NATURA_PESTE_NET: {
```

Ancora `unde: "/angajati",\n  },\n  SAL_AVANTAJ_NATURA_PESTE_NET: {` e unică: ea închide intrarea `SAL_CAS_LA_MINIM`.

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/domain/payroll/etape/facilitate-salariu-minim.test.ts src/domain/payroll/erori.test.ts
```

- [ ] **Pasul 5: LANȚ** plus `pnpm exec prettier --check src/domain/payroll/etape/facilitate-salariu-minim.ts src/domain/payroll/etape/facilitate-salariu-minim.test.ts src/domain/payroll/erori.ts`.

- [ ] **Pasul 6: Commit**

```bash
cd /srv/apps/ERP
git status --short -- src/domain/payroll/etape/facilitate-salariu-minim.ts src/domain/payroll/etape/facilitate-salariu-minim.test.ts src/domain/payroll/erori.ts
git fetch origin main
git diff --name-only HEAD origin/main -- src/domain/payroll
git add -- src/domain/payroll/etape/facilitate-salariu-minim.ts src/domain/payroll/etape/facilitate-salariu-minim.test.ts
git commit --only -- src/domain/payroll/etape/facilitate-salariu-minim.ts src/domain/payroll/etape/facilitate-salariu-minim.test.ts src/domain/payroll/erori.ts \
  -m "feat(salarizare): etapa sumei neimpozabile de la salariul minim (OUG 89/2025 art. III)" \
  -m "Perioadele ian.–iun. (300/4.050/4.300) și iul.–dec. 2026 (200/4.325/4.600), condițiile cumulative, diminuarea pe fracțiunea de lună, citirea din calc_breakdown." \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git merge origin/main
git push origin main
```

---

### Task D4: Motorul aplică facilitatea

**Fișiere:**

- Modify: `src/domain/payroll/calc.ts`:
  - importuri, l. 44-45;
  - `EmployeeContractSnapshot`, l. 134-145;
  - `PayrollCalcInput`, l. 237;
  - `PayrollCalcResult`, l. 276-277;
  - după `brut`, l. 597-609;
  - baze, l. 647-651;
  - minim, l. 652-657;
  - deducere, l. 671-674;
  - CAM, l. 727;
  - `return`, l. 828.
- Modify: `src/components/payroll/fluturas.tsx` l. 35 (`ETICHETE_PAS`). Poarta `breakdown-etichete.test.ts` o cere în același commit.
- Modify: `NOTES.md` §3, după subsecțiunea „Fiscal — salarizare” (l. 136-143).
- Test: `src/domain/payroll/calc.facilitate.test.ts` (Create).

**Interfețe:**

- Consumă: `calculeazaFacilitateSalariuMinim`, `facilitatePentruLuna` (D3).
- Produce:

```ts
export interface EmployeeContractSnapshot { /* … */ readonly functieDeBaza?: boolean; }
export interface PayrollCalcInput { /* … */ readonly lunaVenituri?: string; }
export interface PayrollCalcResult { /* … */ readonly sumaNeimpozabila: number; }
// calc_breakdown primește pasul { pas: "sumaNeimpozabila", valoare } la fiecare calcul.
```

- [ ] **Pasul 1: Scrie testul care pică.** `src/domain/payroll/calc.facilitate.test.ts`:

```ts
// src/domain/payroll/calc.facilitate.test.ts
//
// Suma neimpozabilă de la salariul minim (OUG 89/2025 art. III) în motorul
// aplicației. Setările sunt cele LEGALE din `salarizare-publica.ts`, verificate
// pe sursa primară; vectorii 4.325 → 2.699 (cu facilitate) și 2.616 (fără)
// sunt cei publicați pentru a doua jumătate a lui 2026.
import { describe, expect, it } from "vitest";

import { SETARI_SALARIZARE_PUBLICE } from "@/content/legal/salarizare-publica";
import { calculatePayrollEntry, type PayrollCalcInput } from "./calc";

const LUNA_PLINA = {
  zileLucratoareLuna: 21,
  zileLucrate: 21,
  oreLucrate: 168,
  oreSuplimentare: 0,
  oreNoapte: 0,
  zileConcediuOdihna: 0,
  zileConcediuMedical: 0,
  zileAbsentaNemotivata: 0,
} as const;

function calculeaza(peste: Partial<PayrollCalcInput> = {}) {
  return calculatePayrollEntry({
    settings: SETARI_SALARIZARE_PUBLICE,
    contract: { salariuBaza: 4325, nrPersoaneIntretinere: 0 },
    attendance: LUNA_PLINA,
    bonuses: [],
    deductions: [],
    lunaVenituri: "2026-07",
    ...peste,
  });
}

const spor = (suma: number) => [{ suma, impozabil: true, supusContributii: true }];

describe("motorul aplică suma neimpozabilă de la salariul minim", () => {
  it("4.325 brut în iulie 2026: 200 scutiți, CAS 1.031, CASS 413, impozit 182, net 2.699", () => {
    const r = calculeaza();
    expect(r.sumaNeimpozabila).toBe(200);
    expect(r.brut).toBe(4325);
    expect(r.bazaCas).toBe(4125);
    expect(r.bazaCass).toBe(4125);
    expect(r.cas).toBe(1031);
    expect(r.cass).toBe(413);
    expect(r.deducerePersonala).toBe(865);
    expect(r.impozit).toBe(182);
    expect(r.net).toBe(2699);
  });

  it("CAM pe 4.125, nu pe 4.325 (derogarea de la art. 220^4): 93 de lei, cost total 4.418", () => {
    const r = calculeaza();
    expect(r.camAngajator).toBe(93);
    expect(r.costTotalAngajator).toBe(4418);
  });

  it("rândul intră în calc_breakdown și lasă un avertisment informativ", () => {
    const r = calculeaza();
    expect(r.breakdown).toContainEqual({ pas: "sumaNeimpozabila", valoare: 200 });
    expect(r.warnings.map((w) => w.cod)).toContain("SAL_FACILITATE_SALARIU_MINIM");
  });

  it("fără luna veniturilor, motorul se poartă ca înainte: net 2.616", () => {
    const r = calculatePayrollEntry({
      settings: SETARI_SALARIZARE_PUBLICE,
      contract: { salariuBaza: 4325, nrPersoaneIntretinere: 0 },
      attendance: LUNA_PLINA,
      bonuses: [],
      deductions: [],
    });
    expect(r.sumaNeimpozabila).toBe(0);
    expect(r.net).toBe(2616);
    expect(r.warnings.map((w) => w.cod)).not.toContain("SAL_FACILITATE_SALARIU_MINIM");
  });

  it("din ianuarie 2027 facilitatea nu mai există (alin. (6)): net 2.616, CAM 97", () => {
    const r = calculeaza({ lunaVenituri: "2027-01" });
    expect(r.sumaNeimpozabila).toBe(0);
    expect(r.net).toBe(2616);
    expect(r.camAngajator).toBe(97);
  });
});

describe("condițiile, pe intrările reale ale motorului", () => {
  it("un spor care duce brutul la exact 4.600 păstrează suma; 4.601 o pierde", () => {
    const laPlafon = calculeaza({ bonuses: spor(275) });
    expect(laPlafon.brut).toBe(4600);
    expect(laPlafon.sumaNeimpozabila).toBe(200);
    expect(laPlafon.bazaCas).toBe(4400);
    const pestePlafon = calculeaza({ bonuses: spor(276) });
    expect(pestePlafon.sumaNeimpozabila).toBe(0);
    expect(pestePlafon.bazaCas).toBe(4601);
  });

  it("deducerea personală se ia pe brutul ÎNTREG (art. 77 nu e derogat)", () => {
    // 4.600 = minim + 275 ⇒ treapta a 6-a: 20% − 3% = 17% din 4.325 = 735,25 ⇒ 735.
    // Pe 4.400 (brut − 200) ar fi fost treapta a 2-a: 19% ⇒ 822.
    expect(calculeaza({ bonuses: spor(275) }).deducerePersonala).toBe(735);
  });

  it("un avantaj în natură de 300 de lei duce venitul peste 4.600: fără sumă", () => {
    const r = calculeaza({
      bonuses: [{ suma: 300, impozabil: true, supusContributii: true, esteAvantajInNatura: true }],
    });
    expect(r.brut).toBe(4625);
    expect(r.sumaNeimpozabila).toBe(0);
  });

  it("contract cu normă parțială (4 h din 8): fără sumă", () => {
    const r = calculeaza({
      contract: { salariuBaza: 4325, nrPersoaneIntretinere: 0, normaZilnicaOre: 4 },
    });
    expect(r.sumaNeimpozabila).toBe(0);
  });

  it("⚠ minor cu normă întreagă de 6 h: azi NU primește suma (normă întreagă = norma firmei)", () => {
    const r = calculeaza({
      contract: { salariuBaza: 4325, nrPersoaneIntretinere: 0, normaZilnicaOre: 6 },
    });
    expect(r.sumaNeimpozabila).toBe(0);
  });

  it("în afara funcției de bază: nici sumă, nici deducere personală — net 2.530", () => {
    const r = calculeaza({
      contract: { salariuBaza: 4325, nrPersoaneIntretinere: 0, functieDeBaza: false },
    });
    expect(r.sumaNeimpozabila).toBe(0);
    expect(r.deducerePersonala).toBe(0);
    expect(r.net).toBe(2530);
  });

  it("concediul de odihnă ține suma întreagă; ⚠ zilele de concediu medical o diminuează", () => {
    expect(
      calculeaza({ attendance: { ...LUNA_PLINA, zileLucrate: 16, zileConcediuOdihna: 5 } })
        .sumaNeimpozabila,
    ).toBe(200);
    expect(
      calculeaza({ attendance: { ...LUNA_PLINA, zileLucrate: 16, zileConcediuMedical: 5 } })
        .sumaNeimpozabila,
    ).toBe(152.38);
  });

  it("angajat venit pe la jumătatea lunii: 11 din 21 de zile ⇒ 104,76 lei", () => {
    expect(calculeaza({ attendance: { ...LUNA_PLINA, zileLucrate: 11 } }).sumaNeimpozabila).toBe(
      104.76,
    );
  });

  it("baza minimă de contribuții coboară și ea cu 200 de lei în iul.–dec. 2026 (alin. (5))", () => {
    const cuMinim = { ...SETARI_SALARIZARE_PUBLICE, aplicaMinimContributii: true };
    const partial = { salariuBaza: 2162.5, nrPersoaneIntretinere: 0, normaZilnicaOre: 4 };
    expect(calculeaza({ settings: cuMinim, contract: partial }).bazaCas).toBe(4125);
    expect(
      calculeaza({ settings: cuMinim, contract: partial, lunaVenituri: "2027-01" }).bazaCas,
    ).toBe(4325);
    // Salariatul la minim, cu normă întreagă: baza lui de 4.125 NU e ridicată înapoi la 4.325.
    expect(calculeaza({ settings: cuMinim }).bazaCas).toBe(4125);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/domain/payroll/calc.facilitate.test.ts
```

Eșecul așteptat: `expected undefined to be 200` (`sumaNeimpozabila`) și `expected 2616 to be 2699`. Vitest nu verifică tipuri, deci `lunaVenituri` e ignorat la rulare.

- [ ] **Pasul 3: Implementarea minimă** în `src/domain/payroll/calc.ts`.

Importuri, bloc vechi (l. 44-45):

```ts
import { calculeazaIndemnizatieCm, type IntrareIndemnizatieCm } from "./etape/indemnizatie-cm";
import { calculeazaIndemnizatieCo, type IntrareIndemnizatieCo } from "./etape/indemnizatie-co";
```

Bloc nou:

```ts
import { calculeazaIndemnizatieCm, type IntrareIndemnizatieCm } from "./etape/indemnizatie-cm";
import { calculeazaIndemnizatieCo, type IntrareIndemnizatieCo } from "./etape/indemnizatie-co";
import {
  calculeazaFacilitateSalariuMinim,
  facilitatePentruLuna,
} from "./etape/facilitate-salariu-minim";
```

`EmployeeContractSnapshot`, bloc vechi (l. 143-145):

```ts
  readonly normaZilnicaOre?: number;
  readonly exemptii?: readonly TaxExemptionSnapshot[];
}
```

Bloc nou:

```ts
  readonly normaZilnicaOre?: number;
  readonly exemptii?: readonly TaxExemptionSnapshot[];
  /**
   * Contractul e la locul funcției de bază (art. 77 alin. (1) Cod fiscal; OUG
   * 89/2025 art. III alin. (1)). Implicit `true` — aceeași presupunere pe care
   * motorul o făcea deja pentru deducerea personală: fișa n-are încă un câmp.
   * `false` taie și deducerea personală, și suma neimpozabilă.
   */
  readonly functieDeBaza?: boolean;
}
```

`PayrollCalcInput`, bloc vechi (l. 237-238):

```ts
  readonly contract: EmployeeContractSnapshot;
  readonly attendance: AttendanceSummary;
```

Bloc nou:

```ts
  /**
   * Luna VENITURILOR, „AAAA-LL” — din perioadă, niciodată din ceas. Decide
   * facilitățile legate de lună (OUG 89/2025 art. III). Absentă ⇒ nicio
   * facilitate, deci apelanții de dinainte rămân neatinși.
   */
  readonly lunaVenituri?: string;
  readonly contract: EmployeeContractSnapshot;
  readonly attendance: AttendanceSummary;
```

`PayrollCalcResult`, bloc vechi (l. 276-277):

```ts
  readonly impozit: number;
  readonly camAngajator: number;
```

Bloc nou:

```ts
  readonly impozit: number;
  readonly camAngajator: number;
  /** Suma scoasă din bazele de impozit, CAS, CASS și CAM (OUG 89/2025 art. III); 0 când nu se aplică. */
  readonly sumaNeimpozabila: number;
```

După brut, bloc vechi (l. 607-611):

```ts
      diurnaImpozabila +
      primeTotal,
  );

  // Numărul de tichete se acordă pe zilele efectiv LUCRATE, nu pe cele plătite
```

Bloc nou:

```ts
      diurnaImpozabila +
      primeTotal,
  );

  // Suma neimpozabilă de la salariul minim — OUG 89/2025 art. III. Iese din
  // bazele CAS, CASS, impozit și CAM (derogările de la art. 78, 139, 157 și
  // 220^4), dar NU din brut: omul o primește. Luna e a VENITURILOR, din
  // perioadă — decembrie 2026 recalculat în ianuarie 2027 o are. Plafonul se
  // compară cu brutul fără tichete; tichetele nu intră în `brut`.
  const facilitate = calculeazaFacilitateSalariuMinim({
    luna: input.lunaVenituri ?? "",
    salariuBaza: contract.salariuBaza,
    venitBrut: brut,
    normaIntreaga: normaZilnica >= settings.normaZilnicaOre,
    functieDeBaza: contract.functieDeBaza ?? true,
    zileCuVenitSalarial: attendance.zileLucrate + attendance.zileConcediuOdihna,
    zileLucratoareLuna: attendance.zileLucratoareLuna,
  });
  raporteaza(facilitate.probleme);
  const sumaNeimpozabila = inregistreaza("sumaNeimpozabila", facilitate.suma);

  // Numărul de tichete se acordă pe zilele efectiv LUCRATE, nu pe cele plătite
```

Baze, bloc vechi (l. 647-651):

```ts
  const bazaCas = inregistreaza("bazaCas", bazaComuna + primeInBazaCas + cmBazaCas);
  const bazaCass = inregistreaza(
    "bazaCass",
    bazaComuna + primeInBazaCass + ticheteInCass + cmBazaCass,
  );
```

Bloc nou:

```ts
  const bazaCas = inregistreaza(
    "bazaCas",
    Math.max(0, bazaComuna + primeInBazaCas + cmBazaCas - sumaNeimpozabila),
  );
  const bazaCass = inregistreaza(
    "bazaCass",
    Math.max(0, bazaComuna + primeInBazaCass + ticheteInCass + cmBazaCass - sumaNeimpozabila),
  );
```

Minim, bloc vechi (l. 656):

```ts
  const minim = settings.salariuMinimBrut ?? 0;
```

Bloc nou:

```ts
  // OUG 89/2025 art. III alin. (5): în lunile cu facilitate, salariul minim
  // folosit ca bază minimă (art. 146 alin. (5^6), art. 168 alin. (6^1)) scade
  // cu aceeași sumă — pentru toți, nu doar pentru cine o primește. Altfel baza
  // de 4.125 a unui salariat la minim ar fi ridicată înapoi la 4.325 chiar aici.
  const diminuareMinim = facilitatePentruLuna(input.lunaVenituri ?? "")?.suma ?? 0;
  const minim = Math.max(0, (settings.salariuMinimBrut ?? 0) - diminuareMinim);
```

Deducere, bloc vechi (l. 671-674):

```ts
  const deducerePersonala = inregistreaza(
    "deducerePersonala",
    cautaPragDeducere(settings.deducerePersonala, contract.nrPersoaneIntretinere, brut),
  );
```

Bloc nou:

```ts
  // Numai la funcția de bază (art. 77 alin. (1) Cod fiscal), pe brutul ÎNTREG:
  // art. 77 nu e printre articolele de la care derogă OUG 89/2025 art. III,
  // deci suma neimpozabilă nu coboară treapta deducerii.
  const deducerePersonala = inregistreaza(
    "deducerePersonala",
    (contract.functieDeBaza ?? true)
      ? cautaPragDeducere(settings.deducerePersonala, contract.nrPersoaneIntretinere, brut)
      : 0,
  );
```

CAM, bloc vechi (l. 727):

```ts
  const camAngajator = inregistreaza("camAngajator", brut * settings.cotaCamAngajator);
```

Bloc nou:

```ts
  // Derogare și de la art. 220^4: suma neimpozabilă nu intră în baza CAM.
  const camAngajator = inregistreaza(
    "camAngajator",
    Math.max(0, brut - sumaNeimpozabila) * settings.cotaCamAngajator,
  );
```

`return`, bloc vechi (l. 828-829):

```ts
    camAngajator: rotundLeu(camAngajator, r),
    net: rotundLeu(net, r),
```

Bloc nou:

```ts
    camAngajator: rotundLeu(camAngajator, r),
    // La ban, nu la leu: nu e o contribuție datorată, ci o sumă scutită.
    sumaNeimpozabila: rotund2(sumaNeimpozabila),
    net: rotundLeu(net, r),
```

În `src/components/payroll/fluturas.tsx`, bloc vechi (l. 34-36):

```ts
  cas: "CAS",
  cass: "CASS",
  deducerePersonala: "Deducere personală",
```

Bloc nou:

```ts
  cas: "CAS",
  cass: "CASS",
  sumaNeimpozabila: "Sumă neimpozabilă (OUG 89/2025 art. III)",
  deducerePersonala: "Deducere personală",
```

Eticheta e identică, literă cu literă, cu cea a PDF-ului din D7 (`linii-fluturas.ts` cere în antet ca ecranul și PDF-ul să spună aceleași cuvinte), și destul de scurtă cât să nu fie trunchiată de `cursor.trunchiaza(…, 300, 9)` din `src/lib/pdf/fluturas.ts:79`.

În `NOTES.md`, imediat după paragraful „### Fiscal — salarizare · `payroll_settings`” (care se termină cu „contribuții scutite — se schimbă frecvent, uneori retroactiv).”), inserează:

```markdown
### Suma neimpozabilă la salariul minim · `src/domain/payroll/etape/facilitate-salariu-minim.ts`

Excepție de la regula de mai sus („niciuna nu apare hardcodată în cod”), alături de
valorile calculatorului public din `src/content/legal/salarizare-publica.ts`, care
acum o derivă de aici: e o derogare națională cu dată de expirare (OUG 89/2025 art. III, consolidată la 16.08.2026; HG 146/2026), nu o
setare a firmei. Verificată pe sursa primară pe 8 oct 2026: 300 lei / minim 4.050 /
plafon 4.300 în ian.–iun. 2026; 200 lei / minim 4.325 / plafon 4.600 în iul.–dec. 2026.

⚠️ De confirmat de contabil:

- **Fracțiunea de lună** (alin. (4) lit. c)): aplicația ia (zile lucrate + zile CO) /
  zile lucrătoare. Zilele de concediu medical NU intră, iar suma se rotunjește la ban.
- **Plafonul de venit** (alin. (1) lit. b)) se compară cu brutul motorului, care
  include sporuri, prime, indemnizațiile CO și CM (și partea FNUASS), diurna
  impozabilă și avantajele în natură, fără tichete.
- **Deducerea personală** se calculează pe brutul ÎNTREG, fiindcă art. 77 nu e
  derogat (la 4.600 lei: 735, nu 822).
- **Funcția de bază** e presupusă pentru orice contract, ca la deducerea personală.
  Cumulul cu funcția de bază în altă parte primește greșit și deducerea, și suma;
  avertismentul `SAL_FACILITATE_SALARIU_MINIM` cere verificarea.
- **Normă întreagă** = norma din contract ≥ norma firmei. Minorii cu 6 h/zi (normă
  întreagă legală) NU primesc azi suma.
- **Alin. (2)** (salariul de bază micșorat în 2026 pierde facilitatea) nu e
  verificat de aplicație; e tot în avertisment.
- **Alin. (4) lit. a)** (salariul de bază e la minim doar o parte din lună) nu e
  tratat: motorul vede un singur salariu de bază pe lună. Cazul e semnalat doar de
  avertismentul existent `SAL_CONTRACT_SCHIMBAT_IN_LUNA`, iar suma se corectează manual.
- **Baza minimă** de contribuții (alin. (5)) scade cu suma în lunile cu facilitate,
  pentru toți.
- **D112**: `A_5` se declară fără suma scutită. Tipul de asigurat (1.11.2/1.11.3
  după presă, Ordinul 605/95/928/2.314/2026, MO 463/2 iun 2026, necitit pe sursă
  primară) și rubrica sumei scutite NU sunt generate; D112 dă o atenționare.
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/domain/payroll
```

Toate fișierele trebuie să treacă: `calc.test.ts`, `calc.lacune.test.ts` (neatinse, fiindcă nu trimit `lunaVenituri`), `breakdown-etichete.test.ts` (eticheta nouă), `erori.test.ts`.

- [ ] **Pasul 5: LANȚ** plus `pnpm exec prettier --check src/domain/payroll/calc.ts src/domain/payroll/calc.facilitate.test.ts src/components/payroll/fluturas.tsx NOTES.md`.

- [ ] **Pasul 6: Commit**

```bash
cd /srv/apps/ERP
git status --short -- src/domain/payroll/calc.ts src/domain/payroll/calc.facilitate.test.ts src/components/payroll/fluturas.tsx NOTES.md
git fetch origin main
git diff --name-only HEAD origin/main -- src/domain/payroll src/components/payroll NOTES.md
git add -- src/domain/payroll/calc.facilitate.test.ts
git commit --only -- src/domain/payroll/calc.ts src/domain/payroll/calc.facilitate.test.ts src/components/payroll/fluturas.tsx NOTES.md \
  -m "fix(salarizare): motorul aplică suma neimpozabilă de la salariul minim" \
  -m "La 4.325 lei brut în iul.–dec. 2026 motorul dădea net 2.616; corect 2.699 (OUG 89/2025 art. III). Suma iese din bazele CAS, CASS, impozit și CAM, nu din brut; deducerea personală rămâne pe brutul întreg; baza minimă scade cu suma (alin. (5)). Valorile de confirmat sunt în NOTES.md §3." \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git merge origin/main
git push origin main
```

---

### Task D5: Calculul perioadei trimite luna veniturilor

**Fișiere:**

- Modify: `src/app/(app)/salarizare/actions.ts`, l. 465-468 (`const randuri = angajati.map(...)` și apelul motorului).
- Test: `src/app/(app)/salarizare/actions-calcul.test.ts` (`describe` nou la final).

**Interfețe:**

- Consumă: `PayrollCalcInput.lunaVenituri` (D4).
- Produce: fiecare rând din `p_randuri` are pasul `sumaNeimpozabila` în `calc_breakdown`, iar bazele și CAM-ul sunt deja fără sumă.

- [ ] **Pasul 1: Scrie testul care pică.** La finalul `actions-calcul.test.ts`:

```ts
/** O perioadă în ciornă dintr-o lună anume a lui 2026. */
function pregatesteLuna(luna: number): ClientFals {
  const { server } = configureazaActiunea({ permisiuni: PERMIS });
  rpcCuLant(server);
  server.raspunde("payroll_periods", "select", {
    data: {
      id: ID_1,
      an: 2026,
      luna,
      attendance_period_id: ID_2,
      settings_id: ID_3,
      status: "draft",
    },
  });
  server.raspunde("payroll_bonuses", "select", { data: [] });
  server.raspunde("payroll_deductions", "select", { data: [] });
  return server;
}

describe("calculeazaPerioada — suma neimpozabilă de la salariul minim (OUG 89/2025 art. III)", () => {
  beforeEach(() => {
    vi.mocked(angajatiActiviCuContract).mockResolvedValue({
      angajati: [angajat(ANGAJAT_A, 4325), angajat(ANGAJAT_B, 4500)],
      faraContract: [],
      trunchiat: false,
    });
  });

  it("luna PERIOADEI ajunge la motor: contractul la 4.325 din august 2026 are 200 de lei scutiți", async () => {
    const server = pregatesteLuna(8);
    programeazaScrierea(server);

    const r = await calculeazaPerioada({ id: ID_1 });

    expect(r).toMatchObject({ ok: true });
    const [laMinim, pesteMinim] = randuriScrise(server);
    // SETARI: rotunjire la ban, fără grilă de deducere — aritmetica se vede direct.
    expect(laMinim).toMatchObject({ brut: 4325, cas: 1031.25, cass: 412.5, cam_angajator: 92.81 });
    expect(laMinim?.calc_breakdown).toContainEqual({ pas: "sumaNeimpozabila", valoare: 200 });
    expect(laMinim?.calc_warnings.map((w) => w.cod)).toContain("SAL_FACILITATE_SALARIU_MINIM");
    expect(pesteMinim).toMatchObject({ brut: 4500, cas: 1125, cass: 450 });
    expect(pesteMinim?.calc_breakdown).toContainEqual({ pas: "sumaNeimpozabila", valoare: 0 });
  });

  it("decembrie 2026 recalculat în ianuarie 2027 păstrează suma: decide luna perioadei, nu ceasul", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-01-15T10:00:00Z"));
    try {
      const server = pregatesteLuna(12);
      programeazaScrierea(server);

      await calculeazaPerioada({ id: ID_1 });

      expect(randuriScrise(server)[0]?.calc_breakdown).toContainEqual({
        pas: "sumaNeimpozabila",
        valoare: 200,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("avertismentul scris pe rând cere verificarea funcției de bază — fișa n-are câmpul", async () => {
    const server = pregatesteLuna(8);
    programeazaScrierea(server);

    await calculeazaPerioada({ id: ID_1 });

    const avertisment = (
      randuriScrise(server)[0]?.calc_warnings as { cod: string; mesaj: string }[] | undefined
    )?.find((w) => w.cod === "SAL_FACILITATE_SALARIU_MINIM");
    expect(avertisment?.mesaj).toContain("funcția de bază");
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(app)/salarizare/actions-calcul.test.ts" -t "salariul minim"
```

Eșecul așteptat: `cas: 1081.25` primit, `1031.25` așteptat, iar `calc_breakdown` are `{ pas: "sumaNeimpozabila", valoare: 0 }`. Acțiunea încă nu trimite luna.

- [ ] **Pasul 3: Implementarea minimă.** În `actions.ts`, bloc vechi (l. 465-468):

```ts
    const randuri = angajati.map((angajat) => {
      const pontajAngajat = pontaj.pePersoana.get(angajat.employee_id) ?? PONTAJ_GOL;
      const rezultat = calculatePayrollEntry({
        settings: snapshot,
```

Bloc nou:

```ts
    // Luna VENITURILOR, din perioadă — decide suma neimpozabilă de la salariul
    // minim (OUG 89/2025 art. III). Nu ceasul serverului: decembrie recalculat
    // în ianuarie rămâne decembrie.
    const lunaVenituri = `${String(perioada.an)}-${String(perioada.luna).padStart(2, "0")}`;
    const randuri = angajati.map((angajat) => {
      const pontajAngajat = pontaj.pePersoana.get(angajat.employee_id) ?? PONTAJ_GOL;
      const rezultat = calculatePayrollEntry({
        settings: snapshot,
        lunaVenituri,
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(app)/salarizare"
```

- [ ] **Pasul 5: LANȚ** plus `pnpm exec prettier --check "src/app/(app)/salarizare/actions.ts" "src/app/(app)/salarizare/actions-calcul.test.ts"`.

- [ ] **Pasul 6: Commit**

```bash
cd /srv/apps/ERP
git status --short -- "src/app/(app)/salarizare/actions.ts" "src/app/(app)/salarizare/actions-calcul.test.ts"
git fetch origin main
git diff --name-only HEAD origin/main -- "src/app/(app)/salarizare"
git commit --only -- "src/app/(app)/salarizare/actions.ts" "src/app/(app)/salarizare/actions-calcul.test.ts" \
  -m "fix(salarizare): calculul perioadei trimite luna veniturilor la motor" \
  -m "Statele de plată din iul.–dec. 2026 primesc suma neimpozabilă de la salariul minim; decide luna perioadei, nu ceasul." \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git merge origin/main
git push origin main
```

- [ ] **Pasul 7: Deploy — cere confirmarea utilizatorului.** Întrebarea: „Fac deploy pe producție (`./administrativo.sh prod`) cu motorul reparat, înainte ca `wise` să calculeze octombrie?” Înainte de întrebare, verifică rularea `staging.yml` declanșată de push-ul D5: status verde **și** durată de peste 30 s (sub 30 s înseamnă că a sărit), iar `docker service ls` arată `administrativo-staging_administrativo-web-staging` pe imaginea cu SHA-ul commitului D5. Staging a căzut tăcut 12 zile în trecut. Numai după „da”: `cd /srv/apps/ERP && ./administrativo.sh prod`. Apoi `docker service ps administrativo_administrativo-web` (numele real al serviciului de producție, verificat cu `docker service ls` pe 8 oct 2026; `./administrativo.sh status` îl arată și el) trebuie să arate task-uri „Running” de câteva secunde sau minute, nu de ore: un verde cu imaginea veche e capcana cunoscută.

---

### Task D6: Calculatorul public refolosește motorul (fără dublură), cu test de paritate

> ⚠ **Reconciliere cu secțiunea C (adăugată de criticul de completitudine, 8 oct 2026). Citește întâi blocul ăsta.**
>
> Secțiunile C și D au fost scrise independent și se contrazic pe `src/lib/unelte/salariu.ts` și `src/content/legal/salarizare-publica.ts`:
> - C3 **înlocuiește integral** `salariu.ts`: API nou `calculeazaDinBrut(brut, OptiuniSalariu)`, perioadele `"2026-1"`/`"2026-2"` (`PERIOADE_2026`), luna dată motorului ca **o singură zi** (repară CAS-ul 1.348,50 → 1.349), suma neimpozabilă aplicată în calculator. C4–C8 construiesc peste forma asta (deduceri, tichete, timp parțial cu `suportatDeAngajator`, handicap).
> - Pașii 1 și 3 de mai jos sunt scriși pe `salariu.ts` de AZI (`dinBrut(…, luna)`, `LUNA_REFERINTA_PUBLICA`, 21 de zile). Aplicați după C3, blocurile „vechi” nu se mai găsesc, iar aplicați înainte de C3, sunt șterși de C3 („înlocuit integral”), iar testul de sursă al lui D6 (`/FACILITATE_SALARIU_MINIM|plafonVenitBrut|scutit/`) pică pe codul lui C.
>
> **Hotărâre (ordinea):** D3 → D4 → D5 rulează în valul 1 (motorul aplicației, risc real pe firma „wise”). **D6 NU rulează în valul 1.** Rulează după C8 (valul 3), în forma **D6′** de mai jos. Pașii 1–3 originali se aplică doar dacă C3 n-ar fi planificat deloc. Detecția: `grep -n "export const PERIOADE_2026" src/content/legal/salarizare-publica.ts` găsește o linie ⇒ D6′.
>
> **De ce nu mutăm suma neimpozabilă din calculator în motor (cum voia D6):** calculatorul lui C are reguli pe care motorul nu le primește prin `PayrollCalcInput` (tichetele scoase din plafon, normă întreagă = `oreZi === 8`, diferența de contribuție plătită de firmă la timp parțial, deducerea calculată de calculator într-un singur prag). Dacă motorul primește și el `lunaVenituri`, suma s-ar aplica de două ori. Dublura reală pe care o voia D6 e dublura **cifrelor** și lipsa unei **paze**. D6′ le rezolvă pe amândouă fără să atingă calculul lui C.
>
> **D6′ — Fișiere:** Modify `src/content/legal/salarizare-publica.ts` (forma din C7); Modify `src/lib/unelte/salariu.ts` (doar docblock-ul de sus); Create `src/lib/unelte/salariu.paritate.test.ts`.
>
> **D6′ Pasul 1 — testul care pică** (`src/lib/unelte/salariu.paritate.test.ts`):
>
> ```ts
> // src/lib/unelte/salariu.paritate.test.ts
> //
> // Calculatorul public (C3–C8) și motorul aplicației (D4) trebuie să dea
> // ACELEAȘI cifre acolo unde întrebările lor coincid: normă întreagă, fără
> // tichete, fără deduceri suplimentare, brut ≥ minimul perioadei. Până în
> // oct. 2026 unealta aplica suma neimpozabilă, iar aplicația n-o avea deloc
> // (4.325 brut: 2.699 față de 2.616).
> import { describe, expect, it } from "vitest";
>
> import { PERIOADE_2026, type Perioada } from "@/content/legal/salarizare-publica";
> import { calculatePayrollEntry } from "@/domain/payroll/calc";
> import {
>   FACILITATE_IANUARIE_IUNIE_2026,
>   FACILITATE_IULIE_DECEMBRIE_2026,
> } from "@/domain/payroll/etape/facilitate-salariu-minim";
> import { calculeazaDinBrut, OPTIUNI_IMPLICITE } from "./salariu";
>
> const LUNA: Readonly<Record<Perioada, string>> = { "2026-1": "2026-03", "2026-2": "2026-10" };
> const DOMENIU = { "2026-1": FACILITATE_IANUARIE_IUNIE_2026, "2026-2": FACILITATE_IULIE_DECEMBRIE_2026 } as const;
>
> // Aceeași lună ca a calculatorului: O SINGURĂ zi lucrătoare (C3, decizia 4).
> // Pe 21 de zile motorul are încă rotunjirea în virgulă mobilă (întrebarea din C).
> const O_ZI = {
>   zileLucratoareLuna: 1,
>   zileLucrate: 1,
>   oreLucrate: 8,
>   oreSuplimentare: 0,
>   oreNoapte: 0,
>   zileConcediuOdihna: 0,
>   zileConcediuMedical: 0,
>   zileAbsentaNemotivata: 0,
> } as const;
>
> function motorul(brut: number, persoane: number, functieDeBaza: boolean, p: Perioada) {
>   return calculatePayrollEntry({
>     settings: PERIOADE_2026[p].setari,
>     contract: { salariuBaza: brut, nrPersoaneIntretinere: persoane, functieDeBaza },
>     attendance: O_ZI,
>     bonuses: [],
>     deductions: [],
>     lunaVenituri: LUNA[p],
>   });
> }
>
> describe("paritatea calculator public ↔ motorul aplicației", () => {
>   it("valorile perioadelor vin din tabelul domeniului, nu sunt scrise de două ori", () => {
>     for (const p of ["2026-1", "2026-2"] as const) {
>       const v = PERIOADE_2026[p];
>       expect([v.salariuMinim, v.facilitate.suma, v.facilitate.plafonVenitBrut, v.reducereBazaMinima], p).toEqual([
>         DOMENIU[p].salariuMinim,
>         DOMENIU[p].suma,
>         DOMENIU[p].plafonVenitBrut,
>         DOMENIU[p].suma, // OUG 89/2025 art. III alin. (5): baza minimă scade cu aceeași sumă
>       ]);
>     }
>   });
>
>   it("minim … minim + 400 din leu în leu, apoi până la 6.500 din 25 în 25; 0–4 persoane; funcția de bază da/nu", () => {
>     for (const p of ["2026-1", "2026-2"] as const) {
>       const minim = PERIOADE_2026[p].salariuMinim;
>       const bruturi = [
>         ...Array.from({ length: 401 }, (_, i) => minim + i),
>         ...Array.from({ length: Math.floor((6500 - minim - 400) / 25) }, (_, i) => minim + 425 + i * 25),
>       ];
>       for (const brut of bruturi) {
>         for (let persoane = 0; persoane <= 4; persoane += 1) {
>           for (const functieDeBaza of [true, false]) {
>             const u = calculeazaDinBrut(brut, { ...OPTIUNI_IMPLICITE, perioada: p, persoane, functieDeBaza });
>             const m = motorul(brut, persoane, functieDeBaza, p);
>             expect(
>               [u.cas, u.cass, u.deducerePersonala, u.impozit, u.sumaNeimpozabila, u.net, u.cam],
>               `${p} brut ${String(brut)} pers ${String(persoane)} baza ${String(functieDeBaza)}`,
>             ).toEqual([m.cas, m.cass, m.deducerePersonala, m.impozit, m.sumaNeimpozabila, m.net, m.camAngajator]);
>           }
>         }
>       }
>     }
>   });
>
>   it("la salariul minim: 2.699 în iul.–dec. 2026, în ambele", () => {
>     expect(calculeazaDinBrut(4325, OPTIUNI_IMPLICITE).net).toBe(2699);
>     expect(motorul(4325, 0, true, "2026-2").net).toBe(2699);
>   });
>
>   it("salarizare-publica.ts nu mai scrie cifrele facilității ca literale", () => {
>     const sursa = readFileSync(join(process.cwd(), "src/content/legal/salarizare-publica.ts"), "utf8");
>     expect(sursa).toMatch(/from "@\/domain\/payroll\/etape\/facilitate-salariu-minim"/);
>     expect(sursa).not.toMatch(/suma:\s*(200|300)\b|plafonVenitBrut:\s*(4300|4600)\b|reducereBazaMinima:\s*\d/);
>     expect(sursa).not.toMatch(/SALARIU_MINIM_BRUT_2026_(IANUARIE|IULIE)\s*=\s*\d/);
>   });
> });
> ```
>
> (Importurile testului primesc și `import { readFileSync } from "node:fs";` și `import { join } from "node:path";`.)
>
> Rulează `pnpm exec vitest run src/lib/unelte/salariu.paritate.test.ts`. Așteptat roșu: **doar** ultimul `it`, fiindcă C scrie azi 4050/4325/300/4300/200 ca literale. Primul `it` trece deja (valorile coincid) și rămâne ca pază. Dacă D3 nu e pe `main`, importul cade la `tsc`: atunci D6′ nu începe. Dacă al doilea `it` pică, **te oprești și raportezi** cazul: e exact divergența pe care o caută testul (de exemplu deducerea calculată de C5 pe `brut − scutit` față de motorul D4 pe brutul întreg; la brut ≤ minim + 2.000 grila dă aceeași valoare, dar asta se verifică, nu se presupune). Nu „repari” testul.
>
> **D6′ Pasul 3 — implementarea.** În `salarizare-publica.ts` (forma din C7): importă `FACILITATE_IANUARIE_IUNIE_2026` și `FACILITATE_IULIE_DECEMBRIE_2026` din `@/domain/payroll/etape/facilitate-salariu-minim`; `SALARIU_MINIM_BRUT_2026_IANUARIE = FACILITATE_IANUARIE_IUNIE_2026.salariuMinim`, `SALARIU_MINIM_BRUT_2026_IULIE = FACILITATE_IULIE_DECEMBRIE_2026.salariuMinim`; în `PERIOADE_2026["2026-1"]`, `facilitate: { suma: FACILITATE_IANUARIE_IUNIE_2026.suma, plafonVenitBrut: FACILITATE_IANUARIE_IUNIE_2026.plafonVenitBrut }` și `reducereBazaMinima: FACILITATE_IANUARIE_IUNIE_2026.suma`; în `"2026-2"`, `reducereBazaMinima: FACILITATE_IULIE_DECEMBRIE_2026.suma`; `FACILITATE_SALARIU_MINIM` derivat exact ca în blocul nou de la Pasul 3 de mai jos (l. 55-61). `LUNA_REFERINTA_PUBLICA` **nu** se adaugă (perioada o alege omul, C3). În `salariu.ts` se schimbă doar fraza din docblock „Singurul lucru pe care motorul nu-l știe e suma neimpozabilă … Se aplică aici, peste motor.” în: „Motorul aplicației o aplică și el din oct. 2026, când primește `lunaVenituri` (D4). Calculatorul NU îi trimite luna, ca suma să se aplice o singură dată, aici, cu regulile calculatorului (normă întreagă, tichete în afara plafonului). `salariu.paritate.test.ts` ține cele două calcule lipite.” Pasul 4 rulează `pnpm exec vitest run src/lib/unelte src/content/legal "src/app/(marketing)/unelte/calculator-salariu"`: toți vectorii lui C rămân neschimbați. Pașii 5–7 rămân, cu commitul „refactor(unelte): cifrele facilității vin din domeniu; paritate calculator ↔ motor”. Fără verificare headless: pagina nu se schimbă (`lastmod.mjs` verde fără `harta.ts`).
>
> Fraza de pe hub („Sunt aceleași funcții care lucrează în aplicație”, defectul transversal D8.2 din audit) devine adevărată pentru salariu după D4 + D6′, iar pentru calendar după B9 (paritatea TS ↔ seed-ul SQL). Nu se rescrie.

**Fișiere:**

- Modify: `src/lib/unelte/salariu.ts` (l. 1-95: importuri, antet, `intrare`, `sumaNeimpozabila`, `dinBrut`; l. 109-131: `dinNet`).
- Modify: `src/content/legal/salarizare-publica.ts` (l. 1, l. 31, l. 55-61).
- Test: `src/lib/unelte/salariu.paritate.test.ts` (Create).

**Interfețe:**

- Consumă: `calculatePayrollEntry` cu `lunaVenituri` și `contract.functieDeBaza` (D4); `FACILITATE_IULIE_DECEMBRIE_2026` (D3).
- Produce, consumate de secțiunea calculatorului și de `parametri.ts`, `page.tsx`, `viniete.tsx`, `salariu-minim.ts`, fără schimbări la ei:

```ts
export function dinBrut(brut: number, persoane: number, functieDeBaza: boolean, luna?: string): RezultatSalariu;
export function dinNet(net: number, persoane: number, functieDeBaza: boolean, luna?: string): RezultatSalariu;
export const LUNA_REFERINTA_PUBLICA = "2026-07"; // din salarizare-publica.ts
export const FACILITATE_SALARIU_MINIM: { suma; plafonVenitBrut; valabilDeLa; valabilPana }; // derivat
```

- [ ] **Pasul 1: Scrie testul care pică.** `src/lib/unelte/salariu.paritate.test.ts`:

```ts
// src/lib/unelte/salariu.paritate.test.ts
//
// Unealta publică și motorul aplicației trebuie să dea ACELEAȘI cifre pentru
// aceeași lună. Până în oct. 2026 unealta adăuga singură suma neimpozabilă de
// la salariul minim, iar aplicația n-o avea: la 4.325 brut, 2.699 față de 2.616.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SETARI_SALARIZARE_PUBLICE } from "@/content/legal/salarizare-publica";
import { calculatePayrollEntry } from "@/domain/payroll/calc";
import { dinBrut } from "./salariu";

const LUNA_PLINA = {
  zileLucratoareLuna: 21,
  zileLucrate: 21,
  oreLucrate: 168,
  oreSuplimentare: 0,
  oreNoapte: 0,
  zileConcediuOdihna: 0,
  zileConcediuMedical: 0,
  zileAbsentaNemotivata: 0,
} as const;

function motorul(brut: number, persoane: number, functieDeBaza: boolean, luna: string) {
  return calculatePayrollEntry({
    settings: SETARI_SALARIZARE_PUBLICE,
    contract: { salariuBaza: brut, nrPersoaneIntretinere: persoane, functieDeBaza },
    attendance: LUNA_PLINA,
    bonuses: [],
    deductions: [],
    lunaVenituri: luna,
  });
}

describe("paritatea unealtă ↔ motorul aplicației", () => {
  it("4.000–6.500 lei × 0–4 persoane × funcție de bază da/nu, în iul. 2026, dec. 2026 și ian. 2027", () => {
    for (const luna of ["2026-07", "2026-12", "2027-01"]) {
      for (let brut = 4000; brut <= 6500; brut += 25) {
        for (let persoane = 0; persoane <= 4; persoane += 1) {
          for (const functieDeBaza of [true, false]) {
            const u = dinBrut(brut, persoane, functieDeBaza, luna);
            const m = motorul(brut, persoane, functieDeBaza, luna);
            const caz = `${luna} brut ${String(brut)} pers ${String(persoane)} baza ${String(functieDeBaza)}`;
            expect(
              [u.cas, u.cass, u.deducerePersonala, u.impozit, u.sumaNeimpozabila, u.net, u.cam],
              caz,
            ).toEqual([
              m.cas,
              m.cass,
              m.deducerePersonala,
              m.impozit,
              m.sumaNeimpozabila,
              m.net,
              m.camAngajator,
            ]);
          }
        }
      }
    }
  });

  it("la salariul minim: 2.699 în iul.–dec. 2026, 2.616 din ianuarie 2027 — în ambele", () => {
    expect(dinBrut(4325, 0, true, "2026-10").net).toBe(2699);
    expect(motorul(4325, 0, true, "2026-10").net).toBe(2699);
    expect(dinBrut(4325, 0, true, "2027-01").net).toBe(2616);
    expect(motorul(4325, 0, true, "2027-01").net).toBe(2616);
  });

  it("fără lună, unealta socotește iulie–decembrie 2026 (valorile publicate)", () => {
    expect(dinBrut(4325, 0, true).sumaNeimpozabila).toBe(200);
  });

  it("salariu.ts nu mai calculează singur suma neimpozabilă", () => {
    const sursa = readFileSync(join(process.cwd(), "src/lib/unelte/salariu.ts"), "utf8");
    expect(sursa).not.toMatch(/FACILITATE_SALARIU_MINIM|plafonVenitBrut|scutit/);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte/salariu.paritate.test.ts
```

Eșecurile așteptate:
- `2027-01 brut 4325 pers 0 baza true`: unealta 2.699, motorul 2.616 (al patrulea argument e ignorat azi);
- `dinBrut(4325, 0, true, "2027-01").net`: 2.699 în loc de 2.616;
- testul de sursă găsește `FACILITATE_SALARIU_MINIM`.

- [ ] **Pasul 3: Implementarea minimă.**

`src/content/legal/salarizare-publica.ts`, bloc vechi (l. 1):

```ts
import type { PayrollSettingsSnapshot, PragDeducerePersonala } from "@/domain/payroll/calc";
```

Bloc nou:

```ts
import type { PayrollSettingsSnapshot, PragDeducerePersonala } from "@/domain/payroll/calc";
import { FACILITATE_IULIE_DECEMBRIE_2026 } from "@/domain/payroll/etape/facilitate-salariu-minim";
```

Bloc vechi (l. 31):

```ts
export const SALARIU_MINIM_BRUT_2026_IULIE = 4325;
```

Bloc nou:

```ts
/** HG 146/2026 art. 1 — din tabelul motorului, ca cifra să trăiască într-un singur loc. */
export const SALARIU_MINIM_BRUT_2026_IULIE = FACILITATE_IULIE_DECEMBRIE_2026.salariuMinim;

/**
 * Luna veniturilor pe care o socotește calculatorul public: prima lună cu 4.325
 * lei. Expirarea și alegerea semestrului țin de pagina calculatorului.
 */
export const LUNA_REFERINTA_PUBLICA = "2026-07";
```

Bloc vechi (l. 55-61):

```ts
/** OUG 89/2025 art. III alin. (1): suma, plafonul de venit brut și perioada. */
export const FACILITATE_SALARIU_MINIM = {
  suma: 200,
  plafonVenitBrut: 4600,
  valabilDeLa: "2026-07-01",
  valabilPana: "2026-12-31",
} as const;
```

Bloc nou:

```ts
/**
 * OUG 89/2025 art. III alin. (1): suma, plafonul de venit brut și perioada —
 * DERIVATE din tabelul motorului (`etape/facilitate-salariu-minim.ts`). Până
 * în oct. 2026 trăiau aici și în calculatorul public, iar motorul aplicației nu
 * le avea deloc.
 */
export const FACILITATE_SALARIU_MINIM = {
  suma: FACILITATE_IULIE_DECEMBRIE_2026.suma,
  plafonVenitBrut: FACILITATE_IULIE_DECEMBRIE_2026.plafonVenitBrut,
  valabilDeLa: FACILITATE_IULIE_DECEMBRIE_2026.valabilDeLa,
  valabilPana: FACILITATE_IULIE_DECEMBRIE_2026.valabilPana,
} as const;
```

`src/lib/unelte/salariu.ts`: înlocuiește l. 1-95 (de la primul `import` până la închiderea lui `dinBrut`, inclusiv) cu:

```ts
import {
  LUNA_REFERINTA_PUBLICA,
  SALARIU_MINIM_BRUT_2026_IULIE,
  SETARI_SALARIZARE_PUBLICE,
} from "@/content/legal/salarizare-publica";
import { calculatePayrollEntry, type PayrollCalcInput } from "@/domain/payroll/calc";

/**
 * Brut → net și net → brut pentru calculatorul public, prin ACELAȘI motor ca
 * modulul de salarizare (`calculatePayrollEntry`) — inclusiv suma neimpozabilă
 * de la salariul minim (OUG 89/2025 art. III), pe care până în oct. 2026 o
 * adăuga doar unealta, peste motor, iar aplicația n-o avea deloc.
 *
 * Întrebarea e „cât iese net din brutul ăsta”: o lună întreagă lucrată, cu
 * normă întreagă, fără absențe, sporuri, tichete sau rețineri. Luna veniturilor
 * implicită e `LUNA_REFERINTA_PUBLICA`. `salariu.paritate.test.ts` ține
 * unealta lipită de motor.
 */

export type RezultatSalariu = Readonly<{
  brut: number;
  cas: number;
  cass: number;
  deducerePersonala: number;
  impozit: number;
  /** Suma scoasă din baza de impozit și contribuții (OUG 89/2025 art. III); 0 când nu se aplică. */
  sumaNeimpozabila: number;
  net: number;
  cam: number;
  costTotal: number;
}>;

const BRUT_MIN = 1;
const BRUT_MAX = 500_000;
const ZILE_LUNA = 21;

const margineste = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

function intrare(
  brut: number,
  persoane: number,
  functieDeBaza: boolean,
  luna: string,
): PayrollCalcInput {
  return {
    settings: SETARI_SALARIZARE_PUBLICE,
    // Funcția de bază decide, în motor, și deducerea personală (art. 77
    // alin. (1)), și suma neimpozabilă (OUG 89/2025 art. III alin. (1)).
    contract: { salariuBaza: brut, nrPersoaneIntretinere: persoane, functieDeBaza },
    attendance: {
      zileLucratoareLuna: ZILE_LUNA,
      zileLucrate: ZILE_LUNA,
      oreLucrate: ZILE_LUNA * SETARI_SALARIZARE_PUBLICE.normaZilnicaOre,
      oreSuplimentare: 0,
      oreNoapte: 0,
      zileConcediuOdihna: 0,
      zileConcediuMedical: 0,
      zileAbsentaNemotivata: 0,
    },
    bonuses: [],
    deductions: [],
    lunaVenituri: luna,
  };
}

export function dinBrut(
  brut: number,
  persoane: number,
  functieDeBaza: boolean,
  luna: string = LUNA_REFERINTA_PUBLICA,
): RezultatSalariu {
  const b = Math.round(margineste(brut, BRUT_MIN, BRUT_MAX) * 100) / 100;
  const p = Math.round(margineste(persoane, 0, 10));
  const r = calculatePayrollEntry(intrare(b, p, functieDeBaza, luna));
  return {
    brut: b,
    cas: r.cas,
    cass: r.cass,
    deducerePersonala: r.deducerePersonala,
    impozit: r.impozit,
    sumaNeimpozabila: r.sumaNeimpozabila,
    net: r.net,
    cam: r.camAngajator,
    costTotal: b + r.camAngajator,
  };
}
```

În `dinNet` (l. 109-137), bloc vechi:

```ts
export function dinNet(net: number, persoane: number, functieDeBaza: boolean): RezultatSalariu {
  const tinta = margineste(net, BRUT_MIN, BRUT_MAX);
  let jos = BRUT_MIN;
  let sus = BRUT_MAX;
  for (let i = 0; i < 60 && sus - jos > 0.01; i += 1) {
    const mijloc = (jos + sus) / 2;
    if (dinBrut(mijloc, persoane, functieDeBaza).net < tinta) jos = mijloc;
    else sus = mijloc;
  }
  let start = Math.ceil(sus);
  let ales = dinBrut(start, persoane, functieDeBaza);
```

Bloc nou:

```ts
export function dinNet(
  net: number,
  persoane: number,
  functieDeBaza: boolean,
  luna: string = LUNA_REFERINTA_PUBLICA,
): RezultatSalariu {
  const tinta = margineste(net, BRUT_MIN, BRUT_MAX);
  let jos = BRUT_MIN;
  let sus = BRUT_MAX;
  for (let i = 0; i < 60 && sus - jos > 0.01; i += 1) {
    const mijloc = (jos + sus) / 2;
    if (dinBrut(mijloc, persoane, functieDeBaza, luna).net < tinta) jos = mijloc;
    else sus = mijloc;
  }
  let start = Math.ceil(sus);
  let ales = dinBrut(start, persoane, functieDeBaza, luna);
```

În restul lui `dinNet`, trei apeluri primesc `luna`:
- `ales = dinBrut(start, persoane, functieDeBaza);` → `ales = dinBrut(start, persoane, functieDeBaza, luna);`
- `const laMinim = dinBrut(SALARIU_MINIM_BRUT_2026_IULIE, persoane, functieDeBaza);` → `const laMinim = dinBrut(SALARIU_MINIM_BRUT_2026_IULIE, persoane, functieDeBaza, luna);`
- `const r = dinBrut(b, persoane, functieDeBaza);` → `const r = dinBrut(b, persoane, functieDeBaza, luna);`

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte src/content/legal "src/app/(marketing)/unelte/calculator-salariu"
```

Așteptat: `salariu.test.ts` (vectorii 2.699 și 2.981, monotonia, net→brut), `salarizare-publica.test.ts` (`toEqual` pe `FACILITATE_SALARIU_MINIM`) și `parametri.test.ts` neschimbate și verzi. Plus paritatea.

- [ ] **Pasul 5: LANȚ** plus `pnpm exec prettier --check src/lib/unelte/salariu.ts src/lib/unelte/salariu.paritate.test.ts src/content/legal/salarizare-publica.ts`. `lastmod.mjs` trebuie să rămână verde: niciun `page.tsx` atins, cifrele paginii neschimbate.

- [ ] **Pasul 6: Verificare headless (HTML; comportamentul de client nu se verifică pe `next dev`).** Pornește serverul într-un apel separat:

```bash
cd /srv/apps/ERP && pnpm exec next dev -H 127.0.0.1 -p 3917
```

(`run_in_background`). Așteaptă ca `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3917/unelte/calculator-salariu` să dea 200. Scrie `$SCRATCH/verif-calculator.mjs`, unde `$SCRATCH` e scratchpad-ul sesiunii care execută:

```js
import { chromium } from "/srv/apps/ERP/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs";

const browser = await chromium.launch({
  executablePath:
    "/home/miro/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell",
});
for (const latime of [360, 1366]) {
  const pagina = await browser.newPage({ viewport: { width: latime, height: 900 } });
  await pagina.goto("http://127.0.0.1:3917/unelte/calculator-salariu?suma=4325&din=brut", {
    waitUntil: "networkidle",
  });
  const text = await pagina.locator("main").innerText();
  const scroll = await pagina.evaluate(() => document.documentElement.scrollWidth);
  console.log(
    JSON.stringify({
      latime,
      scroll,
      net2699: /2\.699/.test(text),
      randNeimpozabil: /neimpozabil \(OUG 89\/2025\)/i.test(text),
    }),
  );
  await pagina.screenshot({ path: `${process.env.SCRATCH}/calculator-${latime}.png`, fullPage: true });
  await pagina.close();
}
await browser.close();
```

Rulează: `SCRATCH=$SCRATCH node $SCRATCH/verif-calculator.mjs`. Așteptat la ambele lățimi: `net2699: true`, `randNeimpozabil: true` și `scroll` ≤ lățimea. Se deschid capturile. Oprirea se face într-un apel separat, cu tiparul care nu se potrivește pe sine: `pkill -f "next dev -H 127.0.0.1 -p 391[7]"`. Apoi `rm -f /srv/apps/ERP/.next/dev/types/validator.ts /srv/apps/ERP/.next/dev/types/routes.d.ts`.

- [ ] **Pasul 7: Commit**

```bash
cd /srv/apps/ERP
git status --short -- src/lib/unelte/salariu.ts src/lib/unelte/salariu.paritate.test.ts src/content/legal/salarizare-publica.ts
git fetch origin main
git diff --name-only HEAD origin/main -- src/lib/unelte src/content/legal
git add -- src/lib/unelte/salariu.paritate.test.ts
git commit --only -- src/lib/unelte/salariu.ts src/lib/unelte/salariu.paritate.test.ts src/content/legal/salarizare-publica.ts \
  -m "refactor(unelte): calculatorul de salariu refolosește facilitatea din motor" \
  -m "Suma neimpozabilă de la salariul minim nu mai e socotită peste motor; FACILITATE_SALARIU_MINIM e derivată din tabelul domeniului. Test de paritate unealtă↔motor pe 3.030 de combinații, inclusiv ianuarie 2027." \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git merge origin/main
git push origin main
```

---

### Task D7: Fluturașul PDF și cel trimis pe e-mail arată rândul

**Fișiere:**

- Modify: `src/lib/pdf/linii-fluturas.ts` (importuri l. 12; `SursaFluturas` l. 15-30; `retinerileFluturasului` l. 49-60).
- Modify: `src/app/api/export/salarizare/fluturas/route.ts` (`RandFluturas`, l. 57; `COLOANE`, l. 66-67).
- Modify: `src/app/(app)/salarizare/actions.ts` (`COLOANE_FLUTURAS_EMAIL`, l. 241-243).
- Test: `src/lib/pdf/linii-fluturas.test.ts`.

**Interfețe:**

- Consumă: `sumaNeimpozabilaDinBreakdown(breakdown: unknown): number` (D3).
- Produce: `SursaFluturas.calc_breakdown?: unknown`; o linie nouă, „Sumă neimpozabilă (OUG 89/2025 art. III)”, între CASS și deducere. Linia e ascunsă când e 0.

- [ ] **Pasul 1: Scrie testul care pică.** În `linii-fluturas.test.ts`, adaugă importurile `import { readFileSync } from "node:fs";` și `import { join } from "node:path";` înaintea lui `import { describe, expect, it } from "vitest";`. La final:

```ts
const ETICHETA_SCUTIRE = "Sumă neimpozabilă (OUG 89/2025 art. III)";

describe("suma neimpozabilă de la salariul minim pe fluturaș", () => {
  const LA_MINIM: SursaFluturas = {
    ...ZERO,
    baza_salariu: 4325,
    brut: 4325,
    cas: 1031,
    cass: 413,
    deducere_personala: 865,
    impozit: 182,
    net: 2699,
    net_de_plata: 2699,
    calc_breakdown: [
      { pas: "brut", valoare: 4325 },
      { pas: "sumaNeimpozabila", valoare: 200 },
    ],
  };

  it("apare între contribuții și impozit, cu suma din calculul salvat", () => {
    const linii = retinerileFluturasului(LA_MINIM);
    const etichete = linii.map((l) => l.eticheta);
    expect(linii.find((l) => l.eticheta === ETICHETA_SCUTIRE)?.valoare).toBe(200);
    expect(etichete.indexOf(ETICHETA_SCUTIRE)).toBeGreaterThan(
      etichete.indexOf("CASS — contribuția la sănătate"),
    );
    expect(etichete.indexOf(ETICHETA_SCUTIRE)).toBeLessThan(etichete.indexOf("Impozit pe venit"));
  });

  it("lipsește când suma e zero sau rândul e dinaintea facilității", () => {
    expect(retinerileFluturasului(LUNA_OBISNUITA).map((l) => l.eticheta)).not.toContain(
      ETICHETA_SCUTIRE,
    );
  });

  it("ambele drumuri spre PDF citesc `calc_breakdown` — altfel rândul dispare tăcut", () => {
    for (const fisier of [
      "src/app/api/export/salarizare/fluturas/route.ts",
      "src/app/(app)/salarizare/actions.ts",
    ]) {
      const sursa = readFileSync(join(process.cwd(), fisier), "utf8");
      const coloane = /const COLOANE(?:_FLUTURAS_EMAIL)? =\s*"([^"]*)"/.exec(sursa)?.[1] ?? "";
      expect(coloane, fisier).toContain("calc_breakdown");
    }
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/pdf/linii-fluturas.test.ts
```

Eșecul așteptat: `expected undefined to be 200`; `coloane` nu conține `calc_breakdown`, pentru ambele fișiere.

- [ ] **Pasul 3: Implementarea minimă.**

`linii-fluturas.ts`, bloc vechi (l. 12):

```ts
import type { LinieFluturas } from "./fluturas";
```

Bloc nou:

```ts
import { sumaNeimpozabilaDinBreakdown } from "@/domain/payroll/etape/facilitate-salariu-minim";
import type { LinieFluturas } from "./fluturas";
```

Bloc vechi (l. 28-30):

```ts
  readonly retineri_total: number;
  readonly net_de_plata: number;
}
```

Bloc nou:

```ts
  readonly retineri_total: number;
  readonly net_de_plata: number;
  /** Pașii motorului, salvați; de aici se citește suma neimpozabilă (OUG 89/2025 art. III). */
  readonly calc_breakdown?: unknown;
}
```

Bloc vechi (l. 51-53):

```ts
    { eticheta: "CAS — contribuția la pensie", valoare: sursa.cas, scade: true },
    { eticheta: "CASS — contribuția la sănătate", valoare: sursa.cass, scade: true },
    { eticheta: "Deducere personală", valoare: sursa.deducere_personala },
```

Bloc nou:

```ts
    { eticheta: "CAS — contribuția la pensie", valoare: sursa.cas, scade: true },
    { eticheta: "CASS — contribuția la sănătate", valoare: sursa.cass, scade: true },
    // Scoasă din bazele de CAS, CASS și impozit, dar plătită: nu se scade.
    {
      eticheta: "Sumă neimpozabilă (OUG 89/2025 art. III)",
      valoare: sumaNeimpozabilaDinBreakdown(sursa.calc_breakdown),
    },
    { eticheta: "Deducere personală", valoare: sursa.deducere_personala },
```

`fluturas/route.ts`, bloc vechi (l. 57):

```ts
  readonly calc_warnings: readonly { readonly mesaj: string }[] | null;
```

Bloc nou:

```ts
  readonly calc_breakdown: unknown;
  readonly calc_warnings: readonly { readonly mesaj: string }[] | null;
```

Bloc vechi (l. 66-67):

```ts
const COLOANE =
  "id, baza_salariu, suma_ore_suplimentare, spor_noapte, prime_total, valoare_tichete, brut, cas, cass, deducere_personala, scutire_fiscala, impozit, net, retineri_total, net_de_plata, rest_de_plata, zile_lucratoare_luna, zile_lucrate, zile_concediu_odihna, zile_concediu_medical, ore_lucrate, ore_suplimentare, ore_noapte, calc_warnings, " +
```

Bloc nou:

```ts
const COLOANE =
  "id, baza_salariu, suma_ore_suplimentare, spor_noapte, prime_total, valoare_tichete, brut, cas, cass, deducere_personala, scutire_fiscala, impozit, net, retineri_total, net_de_plata, rest_de_plata, zile_lucratoare_luna, zile_lucrate, zile_concediu_odihna, zile_concediu_medical, ore_lucrate, ore_suplimentare, ore_noapte, calc_breakdown, calc_warnings, " +
```

`actions.ts`, bloc vechi (l. 241-242):

```ts
const COLOANE_FLUTURAS_EMAIL =
  "id, baza_salariu, suma_ore_suplimentare, spor_noapte, prime_total, valoare_tichete, brut, cas, cass, deducere_personala, scutire_fiscala, impozit, net, retineri_total, net_de_plata, rest_de_plata, zile_lucratoare_luna, zile_lucrate, zile_concediu_odihna, zile_concediu_medical, ore_lucrate, ore_suplimentare, ore_noapte, calc_warnings, " +
```

Bloc nou:

```ts
const COLOANE_FLUTURAS_EMAIL =
  "id, baza_salariu, suma_ore_suplimentare, spor_noapte, prime_total, valoare_tichete, brut, cas, cass, deducere_personala, scutire_fiscala, impozit, net, retineri_total, net_de_plata, rest_de_plata, zile_lucratoare_luna, zile_lucrate, zile_concediu_odihna, zile_concediu_medical, ore_lucrate, ore_suplimentare, ore_noapte, calc_breakdown, calc_warnings, " +
```

`RandFluturasEmail extends SursaFluturas` (l. 221) moștenește câmpul opțional, deci nu se schimbă.

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/pdf "src/app/(app)/salarizare"
```

Rulează și `src/lib/queries/coloane.test.ts`: poarta coloanelor inventate trebuie să rămână verde, iar `calc_breakdown` există din 0013.

- [ ] **Pasul 5: LANȚ** plus `pnpm exec prettier --check src/lib/pdf/linii-fluturas.ts src/lib/pdf/linii-fluturas.test.ts src/app/api/export/salarizare/fluturas/route.ts "src/app/(app)/salarizare/actions.ts"`.

- [ ] **Pasul 6: Verificarea documentului.** `linii-fluturas.ts` e singurul loc care decide liniile PDF-ului (antetul lui). Generatorul `src/lib/pdf/fluturas.ts` e `server-only` și primește liniile gata făcute, deci testul de la pasul 1 e proba documentului. Proba live (descărcarea unui fluturaș la minim) nu se poate face fără un stat real cu salariu de 4.325 (D1: zero azi) și nu se fabrică date. Se raportează explicit „neverificat live”.

- [ ] **Pasul 7: Commit**

```bash
cd /srv/apps/ERP
git status --short -- src/lib/pdf/linii-fluturas.ts src/lib/pdf/linii-fluturas.test.ts src/app/api/export/salarizare/fluturas/route.ts "src/app/(app)/salarizare/actions.ts"
git fetch origin main
git diff --name-only HEAD origin/main -- src/lib/pdf src/app/api/export/salarizare "src/app/(app)/salarizare"
git commit --only -- src/lib/pdf/linii-fluturas.ts src/lib/pdf/linii-fluturas.test.ts src/app/api/export/salarizare/fluturas/route.ts "src/app/(app)/salarizare/actions.ts" \
  -m "feat(salarizare): fluturașul PDF și cel pe e-mail arată suma neimpozabilă" \
  -m "Rândul „Sumă neimpozabilă (OUG 89/2025 art. III)” se citește din calc_breakdown, între CASS și deducerea personală." \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git merge origin/main
git push origin main
```

---

### Task D8: D112 — baza CAM fără suma scutită și atenționarea vizibilă

**Fișiere:**

- Modify: `src/domain/payroll/d112/structura.ts` (`AsiguratD112`, l. 74-75).
- Modify: `src/domain/payroll/d112/genereaza.ts` (`verificaAsigurat`, l. 157-164; `serializeazaAsigurat`, l. 185).
- Modify: `src/app/api/export/salarizare/d112/route.ts`:
  - importuri, l. 27;
  - `RandD112`, l. 53;
  - select, l. 127-129;
  - `asigurati.push`, l. 203.
- Modify: `src/components/incarcare/buton-descarcare.tsx` (`ANTETE_CONTROL`, l. 33-39).
- Test: `src/domain/payroll/d112/genereaza.test.ts`.

**Interfețe:**

- Consumă: `sumaNeimpozabilaDinBreakdown` (D3).
- Produce: `AsiguratD112.sumaNeimpozabila?: number`; `A_5 = rotunjesteD112(bazaCam − sumaNeimpozabila)`; problema `{ camp: "A_1", blocant: false }`; antetul `x-atentionari` afișat în notificarea de reușită.

- [ ] **Pasul 1: Scrie testul care pică.** În `genereaza.test.ts`, după comentariul din l. 1, adaugă `import { readFileSync } from "node:fs";` și `import { join } from "node:path";`. La final:

```ts
describe("suma neimpozabilă de la salariul minim (OUG 89/2025 art. III)", () => {
  it("A_5 (baza CAM) se declară fără suma scutită — derogarea de la art. 220^4", () => {
    const r = genereazaD112({
      ...INTRARE,
      asigurati: [{ ...ASIGURAT, bazaCam: 4325, sumaNeimpozabila: 200 }],
    });
    expect(r.xml).toContain('A_5="4125"');
  });

  it("lasă o atenționare NEBLOCANTĂ pentru tipul de asigurat și rubrica dedicată", () => {
    const r = genereazaD112({ ...INTRARE, asigurati: [{ ...ASIGURAT, sumaNeimpozabila: 200 }] });
    const p = r.probleme.find((x) => x.camp === "A_1");
    expect(p?.blocant).toBe(false);
    expect(p?.mesaj).toContain("DUKIntegrator");
  });

  it("fără sumă, A_5 rămâne brutul și nu apare nicio atenționare nouă", () => {
    const r = genereazaD112(INTRARE);
    expect(r.xml).toContain('A_5="5000"');
    expect(r.probleme.some((x) => x.camp === "A_1")).toBe(false);
  });

  it("ruta trimite suma citită din calc_breakdown, iar butonul arată atenționările", () => {
    const ruta = readFileSync(
      join(process.cwd(), "src/app/api/export/salarizare/d112/route.ts"),
      "utf8",
    );
    expect(ruta).toMatch(
      /sumaNeimpozabila:\s*sumaNeimpozabilaDinBreakdown\(rand\.calc_breakdown\)/,
    );
    expect(ruta).toMatch(/"employee_id, impozit, cas, cass, cam_angajator, brut, calc_breakdown/);
    const buton = readFileSync(
      join(process.cwd(), "src/components/incarcare/buton-descarcare.tsx"),
      "utf8",
    );
    expect(buton).toContain('"x-atentionari"');
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/domain/payroll/d112/genereaza.test.ts
```

Eșecul așteptat: `A_5="4325"` în loc de `4125`, nicio problemă pe `A_1`, iar ruta și butonul nu conțin textele.

- [ ] **Pasul 3: Implementarea minimă.**

`structura.ts`, bloc vechi (l. 74-75):

```ts
  /** `A_5` — baza de calcul CAM, în lei întregi. */
  readonly bazaCam: number;
```

Bloc nou:

```ts
  /** `A_5` — baza de calcul CAM, în lei întregi, ÎNAINTE de suma neimpozabilă. */
  readonly bazaCam: number;
  /**
   * Suma neimpozabilă de la salariul minim (OUG 89/2025 art. III), în lei.
   * Derogarea de la art. 220^4 o scoate din baza CAM: `A_5` = `bazaCam` − ea.
   * Opțională: rândurile fără facilitate și apelanții vechi nu o trimit.
   */
  readonly sumaNeimpozabila?: number;
```

`genereaza.ts`, bloc vechi (l. 157-165):

```ts
  if (!/^(N|P[1-7])$/u.test(asigurat.tipContract)) {
    probleme.push({
      camp: "A_3",
      mesaj: `Tipul de contract al lui ${prefix} nu e recunoscut: se acceptă N sau P1…P7.`,
      blocant: true,
    });
  }
  return probleme;
}
```

Bloc nou:

```ts
  if (!/^(N|P[1-7])$/u.test(asigurat.tipContract)) {
    probleme.push({
      camp: "A_3",
      mesaj: `Tipul de contract al lui ${prefix} nu e recunoscut: se acceptă N sau P1…P7.`,
      blocant: true,
    });
  }
  // Facilitatea are în D112 tip de asigurat și rubrică proprii (ordinul comun
  // ANAF–CNPP–CNAS–ANOFM din iunie 2026), pe care aplicația NU le generează —
  // nu inventăm coduri necitite pe sursă primară. `A_5` e deja corect.
  if ((asigurat.sumaNeimpozabila ?? 0) > 0) {
    probleme.push({
      camp: "A_1",
      mesaj: `${prefix} are suma neimpozabilă de la salariul minim (OUG 89/2025 art. III): baza CAM (A_5) e deja scăzută, dar tipul de asigurat și rubrica sumei scutite nu sunt generate de aplicație. Completați-le în DUKIntegrator înainte de depunere.`,
      blocant: false,
    });
  }
  return probleme;
}
```

Bloc vechi (l. 185):

```ts
    `${atribut("A_5", rotunjesteD112(asigurat.bazaCam))}` +
```

Bloc nou:

```ts
    `${atribut("A_5", rotunjesteD112(asigurat.bazaCam - (asigurat.sumaNeimpozabila ?? 0)))}` +
```

`d112/route.ts`, bloc vechi (l. 27):

```ts
import { genereazaD112 } from "@/domain/payroll/d112/genereaza";
```

Bloc nou:

```ts
import { genereazaD112 } from "@/domain/payroll/d112/genereaza";
import { sumaNeimpozabilaDinBreakdown } from "@/domain/payroll/etape/facilitate-salariu-minim";
```

Bloc vechi (l. 53):

```ts
  readonly zile_fara_plata: number;
```

Bloc nou:

```ts
  readonly zile_fara_plata: number;
  readonly calc_breakdown: unknown;
```

Bloc vechi (l. 127-129):

```ts
    .select(
      "employee_id, impozit, cas, cass, cam_angajator, brut, ore_lucrate, " +
        "zile_absenta_nemotivata, zile_fara_plata, " +
```

Bloc nou:

```ts
    .select(
      "employee_id, impozit, cas, cass, cam_angajator, brut, calc_breakdown, ore_lucrate, " +
        "zile_absenta_nemotivata, zile_fara_plata, " +
```

Bloc vechi (l. 203):

```ts
      bazaCam: rand.brut,
```

Bloc nou:

```ts
      bazaCam: rand.brut,
      // OUG 89/2025 art. III: suma scutită iese din baza CAM (`A_5`).
      sumaNeimpozabila: sumaNeimpozabilaDinBreakdown(rand.calc_breakdown),
```

`buton-descarcare.tsx`, bloc vechi (l. 37-39):

```ts
  ["x-angajati-inclusi", "angajați"],
  ["x-randuri", "rânduri"],
];
```

Bloc nou:

```ts
  ["x-angajati-inclusi", "angajați"],
  ["x-randuri", "rânduri"],
  // D112: atenționările ANAF neblocante (`d112/route.ts`). Fără rândul ăsta
  // numărul lor nu apărea nicăieri pe ecran.
  ["x-atentionari", "atenționări de verificat în DUKIntegrator"],
];
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/domain/payroll/d112 src/components/incarcare
```

- [ ] **Pasul 5: LANȚ** plus `pnpm exec prettier --check src/domain/payroll/d112/structura.ts src/domain/payroll/d112/genereaza.ts src/domain/payroll/d112/genereaza.test.ts src/app/api/export/salarizare/d112/route.ts src/components/incarcare/buton-descarcare.tsx`.

- [ ] **Pasul 6: Verificarea documentului.** XML-ul e decis integral de `genereazaD112`, testat mai sus pe `A_5="4125"` și pe atenționare. O descărcare live cere o perioadă aprobată cu un salariat la minim, iar D1 arată că nu există. Nu se fabrică: „neverificat live” se spune explicit. După primul calcul real de acest fel, contabilul validează fișierul în DUKIntegrator.

- [ ] **Pasul 7: Commit**

```bash
cd /srv/apps/ERP
git status --short -- src/domain/payroll/d112/structura.ts src/domain/payroll/d112/genereaza.ts src/domain/payroll/d112/genereaza.test.ts src/app/api/export/salarizare/d112/route.ts src/components/incarcare/buton-descarcare.tsx
git fetch origin main
git diff --name-only HEAD origin/main -- src/domain/payroll/d112 src/app/api/export/salarizare/d112 src/components/incarcare
git commit --only -- src/domain/payroll/d112/structura.ts src/domain/payroll/d112/genereaza.ts src/domain/payroll/d112/genereaza.test.ts src/app/api/export/salarizare/d112/route.ts src/components/incarcare/buton-descarcare.tsx \
  -m "fix(salarizare): D112 declară baza CAM fără suma neimpozabilă de la salariul minim" \
  -m "A_5 = brut − suma scutită (OUG 89/2025 art. III, derogarea de la art. 220^4); atenționare neblocantă pentru tipul de asigurat și rubrica dedicată, iar butonul de descărcare arată x-atentionari." \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git merge origin/main
git push origin main
```

---

**Review Focus**

1. **Cumulul de funcții (funcția de bază la alt angajator).** Fișa nu are câmpul, așa că motorul presupune funcția de bază. Salariatul la minim cu cumul primește greșit și deducerea, și cei 200 de lei. Testul care ține plasa: D5, „avertismentul scris pe rând cere verificarea funcției de bază — fișa n-are câmpul”. Repararea reală (un câmp `functie_de_baza` pe contract) e o migrare separată, care cere decizie.
2. **Minorii cu normă întreagă de 6 h/zi.** `normaZilnica >= settings.normaZilnicaOre` îi exclude, deși legal au normă întreagă. Fixat în D4: „⚠ minor cu normă întreagă de 6 h: azi NU primește suma”, marcat ⚠ în NOTES.md. Dacă contabilul confirmă că se cuvine, testul se inversează odată cu regula.
3. **Recalcularea în 2027 a unei luni din 2026.** Dacă cineva ar înlocui `lunaVenituri` cu data de azi, decembrie 2026 recalculat în ianuarie și-ar pierde suma, tăcut. Ținut de D5: „decembrie 2026 recalculat în ianuarie 2027 păstrează suma” (cu `vi.setSystemTime`).
4. **Plafonul de 4.600 și ce intră în el.** Avantajele în natură, primele și indemnizațiile CM intră în brutul comparat cu plafonul. Un avantaj de 300 de lei taie facilitatea. Ținut de D4: „un avantaj în natură de 300 de lei duce venitul peste 4.600: fără sumă” și „4.600 păstrează suma; 4.601 o pierde”. Compoziția plafonului e ⚠ pentru contabil.
5. **Drift între acțiune și funcția SQL de scriere.** O coloană nouă adăugată pe `payroll_entries` și trimisă de acțiune, dar uitată în `payroll_scrie_rezultate`, ar reproduce exact defectul `rest_de_plata = 0`. Ținut de D2: „fiecare cheie trimisă e cerută, actualizată ȘI inserată de funcția în vigoare”, plus proba (6), care verifică `rest_de_plata = 2925` și `baza_cas = 5000` pe bancul local.
