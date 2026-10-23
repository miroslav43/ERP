---
tip: modul
titlu: Organigramă
aliases: [organigrama, subordonare, manager_path]
cai:
  - "src/app/(app)/organigrama/**"
  - "src/lib/queries/employees.ts"
  - "src/domain/hr/organigrama.ts"
  - "supabase/migrations/0004_hr.sql"
  - "supabase/migrations/0005_hr_rls.sql"
  - "supabase/migrations/0196_lantul_de_sefi_al_angajatului.sql"
  - "supabase/migrations/0226_securitate_reziduala.sql"
tabele: [employees, organization_members, departments]
permisiuni:
  - "employees:read"
  - "employees:create"
  - "employees:update"
  - "users:update"
  - "departments:read"
capcane: [2, 18]
citeste_daca:
  - "scope `team` care vede prea mult sau prea puțin → secțiunea `manager_path`"
  - "un angajat care se vede singur, fără șefi deasupra → `lantul_meu_de_sefi`"
scris_pe: 8b46aa6015ab5a8f558e72a2e13b37148c114114
scris_la: 2026-10-13
tags: [modul]
---

# Organigramă

Un singur ecran, fără nicio scriere. Dar e **vizualizarea structurii pe care se sprijină
tot scope-ul `team` din proiect**: cine e „echipa mea" nu se decide nicăieri altundeva.

Structura de departamente și uneltele care o schimbă sunt la [[modul/departamente]].

## `manager_path` — lanțul care definește „echipa"

`employees.manager_path` e un tablou de UUID-uri care conține lanțul de la vârf până la
angajat, **inclusiv angajatul însuși**. Deci:

```
„X e în echipa lui M"  ⇔  X.manager_path @> array[M]
```

Consecința care surprinde: `app.is_manager_of(org, eu)` e **adevărat pentru propria fișă**.
Scope-ul `team` include întotdeauna omul care îl poartă. Unde asta ar însemna „își aprobă
singur", excluderea se face explicit în fluxul respectiv, niciodată prin scope — v.
[[rol/manager]].

A doua consecință: `manager_path` conține **tot subarborele**, nu doar șeful direct. Șeful
șefului trece la fel de bine. Unde cerința e „managerul direct", predicatul e altul —
`app.este_manager_direct`, pe `manager_employee_id` — și asta e diferența pe care se
sprijină scrierea KPI din [[modul/evaluari]].

## Ce refuză baza când lanțul e greșit

`public.tg_employees_manager_path` rulează BEFORE INSERT sau UPDATE pe
`manager_employee_id` și `organization_id`. Din 0226 (`0226_securitate_reziduala.sql`)
începe cu garda de firmă: în afara contextului de serviciu, un rând pus pe o firmă care nu
e a apelantului primește 42501, înaintea oricărei căutări. Apoi ridică P0001 în trei cazuri:

- managerul indicat nu există în firma rândului, are fișa ștearsă sau e al altei firme —
  UN SINGUR mesaj pentru toate trei, ca răspunsul să nu spună ce fișe există în altă firmă;
- relația ar deveni **circulară** (`new.id` e deja în lanțul managerului);
- lanțul ar depăși **12 niveluri**.

Coloana e calculată de trigger, nu trimisă de client: politica de INSERT din `0005` cere
literal `manager_path = '{}'`. Un client care încearcă s-o scrie e respins.

Mutarea unui om **rescrie subarborele lui**: `tg_employees_manager_path_cascade` reface
prefixul la toți cei care îl aveau în lanț. Deci o singură schimbare de șef poate muta
tăcut ce văd zeci de oameni cu scope `team` — inclusiv aprobările din concedii, pontaj și
diurnă.

## Citirea ecranului

`arboreleManagerial(organizationId, scope, propriaFisaId)` din
`src/lib/queries/employees.ts` — fișier marcat `import "server-only"`, deci un import
dintr-o componentă client oprește build-ul în loc să ducă citirile de personal în
bundle-ul de browser. Poarta e `employees:read`: `scope === null` sau `"none"` dă
`AccesRestrictionat`, iar sub orice scope diferit de `all` pagina trimite propria fișă, ca
arborele să pornească de acolo.

Sub `own`, ascendenții **nu** se mai citesc din `employees`: vin din
`public.lantul_meu_de_sefi` (`0196_lantul_de_sefi_al_angajatului.sql`), funcție
`security definer` care întoarce doar cartea de vizită a șefilor din `manager_path`-ul
fișei proprii, în organizația curentă, vârf → șef direct, și care cere ea însăși
`employees:read` cel puțin `own`. Stă în schema `public`, fiindcă PostgREST nu expune
`app`; se cheamă doar dacă `manager_path` are ascendenți. Subarborele propriu rămâne o
citire obișnuită pe `employees`.

Dacă scope-ul e `team` și fișa proprie lipsește, funcția întoarce lista goală **înainte de
a interoga**: `manager_path @> array[NULL]` e fals, deci RLS ar fi tăiat oricum tot, dar
interogarea pleca pe toată organizația și se sprijinea exclusiv pe politică. Același
scurtcircuit stă în `listeazaAngajati` și `citesteAngajat`, acolo pe orice scope diferit
de `all`.

Rolurile conturilor vin dintr-o **a doua** interogare, nu dintr-un embed: între
`employees` și `organization_members` nu există cheie străină, iar PostgREST refuză
embed-ul fără ea. Nu cere permisiune în plus — politica cere doar apartenența la
organizație.

Funcția chemată aici e `toateRolurileConturilor(organizationId)`, nu `rolurileConturilor`
— aceasta din urmă rămâne, cu filtrul ei pe listă de id-uri, pentru [[modul/angajati]].
Fără filtru, harta nu mai depinde de arbore, deci pleacă în același val cu `idFisaProprie`
în loc să aștepte `arboreleManagerial`. E prin urmare un **superset** al conturilor din
arbore, inclusiv sub scope `team` — dar nu ajunge pe ecran: `construiesteOrganigrama`
(`src/domain/hr/organigrama.ts`) iterează peste rândurile arborelui și consultă harta doar
prin `.get()`, niciodată invers. Din ea ies două lucruri: eticheta de funcție a fișelor
care n-au una (`etichetaFunctiei` scrie rolul de cont, cu cursive) și administratorul
unic, de care atârnă avertismentul despre legăturile deduse.

`construiesteOrganigrama` întoarce, pe lângă arbore, și `radaciniFaraManagerVizibil`:
oameni al căror șef există, dar nu e vizibil sub scope-ul curent. Ei nu se aruncă și nu se
lipesc la rădăcină în tăcere — ecranul îi arată ca atare, fiindcă „nu văd șeful" e o stare
diferită de „n-are șef".

Sub `all`, `fiseDupaId(organizationId, ids)` mai face o citire, una singură, ca nodul să-l
poată **numi** pe șeful nevizibil: fișe după id, inclusiv inactive sau încetate, tot prin
RLS. Id-urile se strâng doar din rădăcinile lui `arbore` — când administratorul e rădăcină
unică, ceilalți devin copii impliciti sub el, iar managerii lor ascunși nu intră în hartă,
deci nodul lor rămâne la „manager inactiv sau șters".

## Ce se poate face de pe nod

Preambulul citește și `getEnabledFeatures`, pentru `poateDeschide` din
`src/config/porti-ruta.ts`: antetul duce la `/departamente?vizualizare=organigrama` —
cealaltă organigramă a produsului, cea structurală — doar dacă poarta rutei
`/departamente` trece (`departments:read`).

- **Numele** duce la `/angajati/[id]`, cu linkul întins peste tot cardul
  (`after:absolute after:inset-0`); funcția și departamentul au linkurile LOR, ridicate cu
  `relative z-10`, fiindcă un `<a>` în alt `<a>` nu e permis.
- **Eticheta derivată din rolul de cont** duce la `/angajati/[id]/permisiuni`, dar numai cu
  `users:update` = `all`; `hr`, care n-are niciun `users:*`, vede doar textul cursiv.
- **„Setează managerul"** apare pe nodul cu muchie dedusă sau cu manager nevizibil, numai
  cu `employees:update` = `all` (`org_admin`, `hr`), și duce la
  `/angajati/[id]/editeaza?inapoi=organigrama`. Formularul se întoarce la
  `/organigrama?angajat=<id>#angajat-<id>`, iar pagina evidențiază nodul **pe server**
  (`ring-2`): `:target` nu se aprinde după o navigare din client.
- **Rădăcina cu manager pe fișă, dar nevizibil** primește același marcaj ca muchia dedusă,
  numai sub `all` — sub `team` managerul poate fi pur și simplu în afara echipei. Textul îl
  numește: „din afara ierarhiei" dacă fișa lui e activă, „inactiv" altfel.
- **`StareGoala`** oferă „Adaugă primul angajat" (`/angajati/nou`) doar când nu există
  nicio fișă activă ȘI `employees:create` = `all`; altfel trimite la lista de angajați.

## Ce refuză baza tăcut

- **Sub `employees:read = own`, lanțul de șefi citit din `employees` venea gol.** Politica
  `employees_select` cu scope `own` dă rândul propriu, deci `.in("id", manager_path)`
  întorcea zero rânduri, fără eroare: angajatul se vedea singur, fără nimeni deasupra
  (ANG-028). Reparat prin `0196_lantul_de_sefi_al_angajatului.sql` — o funcție care dă
  doar cartea de vizită, nu o politică mai largă; proba e
  `tests/rls/proba-lantul-de-sefi.sql`.
- **Un angajat fără fișă principală de angajat are `team` peste mulțimea vidă.**
  Subordonarea trăiește în `employees`, nu în `organization_members`; un cont de manager
  fără fișă vede liste goale peste tot, fără nicio eroare. Pe organigramă golul nu mai
  vine din politică, ci din cod: `arboreleManagerial` întoarce lista goală pentru `team`
  fără fișă proprie. Ecranul arată la fel — `StareGoala` „Nimic de afișat" —, doar că
  motivul e acum verificabil fără bază.
- **Harta de roluri nu cere limită, deci se taie la plafonul `max_rows`.**
  `toateRolurileConturilor` citește toți membrii activi ai organizației fără paginare;
  peste plafon PostgREST trunchiază fără eroare și fără antet. Efectul nu e o listă mai
  scurtă, ci un ecran care minte în două feluri: fișele fără funcție pierd eticheta
  derivată din rol, iar administratorul poate să nu mai fie găsit — atunci nimeni nu mai
  e atașat implicit și avertismentul despre legăturile deduse dispare. — capcana #2
- **Embed-urile care traversează spre module fără permisiune vin NULL, nu în eroare** —
  cazul canonic e `vehicles!vehicle_id` pentru un manager. — capcana #18

## Când NU e suficientă pagina asta

- Schimbarea structurii: [[modul/departamente]].
- Fișa individuală și încadrarea: [[modul/angajati]].
- Rădăcinile cu manager nevizibil, managerul numit, rolul ca link, legătura spre `/departamente`: [[strat/navigare]].
