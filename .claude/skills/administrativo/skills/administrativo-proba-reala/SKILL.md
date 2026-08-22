---
name: administrativo-proba-reala
description: Execută proba de scriere reală per rol — pentru fiecare dintre cele cinci roluri Administrativo (`super_admin`, `org_admin`, `hr`, `manager`, `employee`) rulează un INSERT sau UPDATE efectiv sub identitatea lui, compară rezultatul cu matricea din `role_permissions` și raportează OK / FALS-NEGATIV / FALS-POZITIV / REFUZ TĂCUT, în tranzacții derulate înapoi. Se folosește obligatoriu înainte de a declara terminat un modul, o migrare sau o politică RLS.
---

# Proba de scriere reală per rol

## De ce există

Faza 2 a fost comisă ca livrată. Nu era. Un `org_admin` nu putea insera un angajat:

```
insert into public.employees (...) as authenticated
→ new row violates row-level security policy for table "employees" (42501)
```

Treceau typecheck, lint, 175 de teste, cele trei bariere din `scripts/checks/`
și izolarea 11/11 — pe Postgres local **și** pe Supabase real. *„Niciuna nu
execută o scriere reală ca utilizator obișnuit. Verificam că nimeni nu vede ce
nu are voie, dar nu și că cine are voie poate lucra.”*

Porțile existente sunt toate **negative**: izolarea demonstrează refuzuri,
barierele demonstrează absențe. Aceasta e singura **pozitivă**.

## Ce există deja și ce lipsește

`tests/rls/izolare.sql` are verificarea `(l)` — „politicile NU blochează
scrierile legitime” — adăugată reactiv după Faza 2, cu **9 INSERT-uri reale**
(`departments`, `employees`, `leave_requests`, `attendance_entries`,
`inventory_items`, `vehicles`, `ssm_trainings`, `checklist_instances`,
`business_trips`), rulată în CI la fiecare PR.

**Dar toate cele 9 se fac ca `admin_alfa`, adică un singur rol: `org_admin`.**
`ang_alfa`/`emp_alfa` apar doar ca subiect (`employee_id`), niciodată ca autor.
Comentariul din fixture o recunoaște: „și org_admin, și managerul direct al Anei”.

Deci `super_admin`, `hr`, `manager` și `employee` **nu sunt niciodată dovediți
capabili să scrie ceva** — exact `manager` și `hr` fiind rolurile cu cele mai
multe capcane (4, 9, 16, 18, 26, 32, 35).

**Contribuția ta e să extinzi `izolare.sql`, nu să construiești o bancă paralelă.**
Un caz adăugat acolo rulează în CI la fiecare PR; o bancă opt-in rulează când
își amintește cineva.

## Cele patru verdicte

| Verdict | Ce înseamnă | Gravitate |
|---|---|---|
| `OK` | rezultatul real coincide cu matricea de permisiuni | — |
| `⛔ FALS-NEGATIV` | rolul ar trebui să poată, dar baza refuză | **blochează livrarea** — bug-ul Fazei 2 |
| `⛔ FALS-POZITIV` | rolul nu ar trebui să poată, dar baza acceptă | **blochează livrarea** — scurgere |
| `⚠ REFUZ TĂCUT` | UPDATE fără eroare, dar zero rânduri afectate | utilizatorul vede „salvat”; nimic nu s-a schimbat |

`REFUZ TĂCUT` e motivul pentru care proba numără **rândurile afectate**, nu doar
prinde excepții (capcana 17).

## 1. Alege cazurile

Rolurile sunt exact cinci — enumul `public.app_role` din `0001_kernel.sql:64`.
`super_admin` nu se stochează niciodată în `organization_members`; sursa e
`platform_admins`.

Pentru fiecare tabelă scrisă de modulul tău: un caz per rol care **ar trebui**
să poată scrie, plus **cel puțin un rol care nu ar trebui**. Fără cazul negativ,
o politică `using (true)` trece proba.

Așteptarea nu se inventează — se citește din bază:

```sql
select role, resource, action, scope
from public.role_permissions
where organization_id is null and resource = '<resursă>'
order by role, action;
```

Divergențele cunoscute sunt în `references/matrice-roluri.md`. Un `⛔` care se
regăsește acolo e o restanță documentată (capcanele 4, 16, 27, 35), nu o
descoperire — se raportează cu numărul capcanei, nu se ascunde.

## 2. Execută sub identitatea rolului

Mecanismul e cel din `tests/rls/izolare.sql` — nu inventa altul. PostgREST
rulează fiecare cerere ca `set local role authenticated` plus claim-urile JWT în
GUC-uri; îl reproducem exact:

```sql
do $$
declare v_actor uuid := pg_temp.id('mgr_alfa'); reusit boolean := false; n int;
begin
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  set local role authenticated;
  begin
    insert into public.<tabela> (...) values (...);
    reusit := true;
  exception when insufficient_privilege or others then reusit := false;
  end;
  reset role;
  if not reusit then perform pg_temp.esueaza('rolul manager NU poate scrie <tabela>'); end if;
end $$;
```

GUC-ul se setează **înainte** de `set local role`, ca să nu depindem de dreptul
rolului `authenticated` de a-l scrie.

Coloanele `GENERATED ALWAYS` NU se trimit (428C9), la fel cele calculate de
triggere BEFORE — rulează întâi `capcana.mjs --tabela <tabela>`.

Pentru UPDATE, verdictul cere numărul de rânduri:

```sql
with modificate as (update public.<tabela> set status = '<nou>' where id = '<id>' returning 1)
select count(*) from modificate;   -- 0 ⇒ ⚠ REFUZ TĂCUT
```

## 3. Unde rulezi

1. **Banca locală** (preferat, fără riscuri):
   `bash .claude/skills/administrativo/scripts/banc-migrare.sh` pornește un
   `postgres:17-alpine` efemer, aplică toate migrările, barierele și izolarea.
   Adaugă-ți cazurile în `izolare.sql` și rulează bancul.
2. **`mcp__supabase__execute_sql`** — pentru o probă punctuală. Trimite blocul
   `begin; … rollback;` ca **un singur apel**; despărțit, fiecare instrucțiune
   rulează în tranzacția ei și `set local role` se pierde. Niciodată pe producție.

## 4. Curățenia

**Regula întâi: `rollback`, nu `delete`.** Politicile, clauzele `WITH CHECK` și
toate triggerele `BEFORE` rulează înainte de commit, deci o tranzacție derulată
înapoi exercită tot ce probăm și nu lasă niciun rând.

Dacă trebuie totuși să comiți (un trigger care citește starea comisă a altei
tabele), folosește santinele imposibil de confundat cu date reale — date
`2099-01-05`, text cu prefix `PROBA-2099-` — și șterge-le explicit în aceeași
sesiune, apoi **dovedește** că nu au rămas:

```sql
select count(*) as ramase from public.employees where marca like 'PROBA-2099-%';
```

Orice `ramase ≠ 0` înseamnă că proba a EȘUAT, indiferent de verdictele de mai sus.

## 5. Finalizare

Proba e ULTIMA, nu prima:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
bash .claude/skills/administrativo/scripts/banc-migrare.sh
```

`pnpm verify` **nu** rulează `build`, iar `build` e singurul care prinde granița
server/client. Nu-l înlocui cu `verify`.
