---
tip: modul
titlu: Mentenanță — acțiuni, citiri și erori traduse
aliases: [acțiuni mentenanță, createAction mentenanță, citiri mentenanță, erori.ts mentenanță]
cai:
  - "src/app/(app)/mentenanta/actions.ts"
  - "src/app/(app)/mentenanta/erori.ts"
  - "src/app/(app)/mentenanta/echipamente/actions.ts"
  - "src/app/(app)/mentenanta/interventii/actions.ts"
  - "src/app/(app)/mentenanta/iscir/actions.ts"
  - "src/app/(app)/mentenanta/planuri/actions.ts"
  - "src/app/(app)/mentenanta/sesizari/actions.ts"
  - "src/lib/queries/maintenance.ts"
  - "src/lib/queries/maintenance-rapoarte.ts"
  - "src/schemas/maintenance.ts"
tabele:
  [
    equipment,
    equipment_meters,
    maintenance_plans,
    maintenance_interventions,
    maintenance_intervention_parts,
    fault_reports,
    fault_report_comments,
    equipment_opriri,
    maintenance_attachments,
    maintenance_settings,
    iscir_authorizations,
  ]
permisiuni: [maintenance:read, maintenance:create, maintenance:update, maintenance:delete]
feature: maintenance
capcane: [17, 30, 50, 56, 57]
citeste_daca:
  - "o acțiune nouă sau o poartă care pare prea largă → „Cine are ce poartă”"
  - "un P0001 apare ca mesaj generic în loc de textul bazei → „Erorile traduse”"
  - "o listă taie tăcut rânduri sau un tip nu se potrivește → „Citirile”"
scris_pe: edd51fa9be907ae26d1faa9eceae838a5ca4d69b
scris_la: 2026-10-12
tags: [modul, operations]
---

# Mentenanță — acțiuni, citiri și erori traduse

Extrasă din [[modul/mentenanta]], ca pagina principală să rămână sub plafon. Aici stau
contractul scrierilor (poarta fiecărei acțiuni), al citirilor și al mesajelor bazei.
Comportamentul pe fiecare zonă e în subpaginile ei: [[modul/mentenanta/sesizari]],
[[modul/mentenanta/echipamente]], [[modul/mentenanta/planuri]],
[[modul/mentenanta/interventii]], [[modul/mentenanta/iscir]], [[modul/mentenanta/zilnic]],
[[modul/mentenanta/rapoarte]].

## Convențiile modulului

- **Orice scriere trece prin `createAction`**, cu Zod DUPĂ authz și `revalidate:` declarat —
  listă fixă sau funcție de input, când calea depinde de rândul scris —, niciodată
  `revalidatePath()` din handler.
- **Clientul admin apare doar în fișiere numite exact `actions.ts`**, cu comentariu care
  spune DE CE ocolește RLS și cu filtru explicit pe organizație: fișa raportorului și
  citirea rândului abia inserat la `creeazaSesizare`, căutarea utilajului de către cel care
  sesizează (`cautaEchipament`: nu vede parcul), denumirile utilajelor de pe sesizările lui
  (`numeleEchipamentelorMele`), punctele de lucru pentru selector (capcana #57) și
  curățarea obiectelor de Storage rămase fără rând. Citirile din `queries/` nu îl pot
  importa.
- **Orice tranziție face `.select()` după `.update()`** și tratează zero rânduri drept
  CONFLICT: un UPDATE respins de USING nu aruncă. — capcana #17
- **Orice P0001 nou primește intrare în `erori.ts`** și trece prin `traduEroare`; fără ea,
  `mapPostgrestError` îl înlocuiește cu textul generic. — capcana #3
- **Coloanele GENERATE (`cost_total`, `valoare` pe piese) nu se trimit**: schemele Zod le
  omit, iar testul fiecărei acțiuni verifică lipsa lor din payload. — capcana #30
- Ziua de business vine din `todayInBucharest()`; filtrele unui `uuid` golit cu `?? ""` nu
  se scriu (22P02). — capcana #37

## Cine are ce poartă

Regula de la „`create` NU e poarta" din [[modul/mentenanta]]: tot ce schimbă catalogul stă pe
`maintenance:update` / team; sesizarea pe `create` / own; gesturile NOMINALE (tehnician,
raportor, responsabil de utilaj) pe `read` / own, iar decizia o ia baza.

| Zona (fișierul `actions.ts`) | Pe `update` / team                                                                                                                                        | Pe `read` / own (decide baza)                                                                                                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mentenanta/`                | `creeazaEchipament`, `actualizeazaEchipament`, `creeazaPlan`, `actualizeazaPlan`, `inregistreazaInterventie`, `trieazaSesizare`, `adaugaAutorizatieIscir` | `rezolvaSesizare`, `inregistreazaContor`, `numeleEchipamentelorMele`; pe `create` / own: `creeazaSesizare`, `cautaEchipament`                                                                             |
| `echipamente/`               | `schimbaStareEchipament`, `corecteazaCitire`, `anuleazaCitire`, `optiuniPuncteLucru`                                                                      | `inregistreazaCitiri`; pe `delete` / all: `stergeEchipament`                                                                                                                                              |
| `planuri/`                   | `amanaPlan`, `comutaPlanActiv`, `stergePlan`                                                                                                              | —                                                                                                                                                                                                         |
| `interventii/`               | `actualizeazaInterventie`, `anuleazaInterventie`, `adaugaPiesa`, `stergePiesa`                                                                            | —                                                                                                                                                                                                         |
| `iscir/`                     | `actualizeazaAutorizatie`, `suspendaAutorizatie`, `reactiveazaAutorizatie`, `reinnoiesteAutorizatie`, `stergeAutorizatie`                                 | —                                                                                                                                                                                                         |
| `sesizari/`                  | `atribuieSesizare`, `inregistreazaOprire`; pe `update` / all: `salveazaSetariMentenanta`                                                                  | `tehnicianSchimbaStarea`, `retrageSesizare`, `inchideSesizare`, `redeschideSesizare`, `actualizeazaSesizare`, `comenteazaSesizare`, `pregatesteFisier`, `confirmaFisier`, `stergeFisier`, `inchideOprire` |

Două detalii care schimbă comportamentul:

- `inregistreazaContor` recitește harta de permisiuni în handler: cine n-are
  `maintenance:update` / team primește un refuz EXPLICAT la resetare și nu-și alege
  `citit_de_employee_id` — i se pune fișa lui principală, sau `null` dacă n-are. Și politica
  o cere, nu doar acțiunea. — [[modul/mentenanta/planuri]]
- `inregistreazaCitiri` (lotul de pe „Contoare") NU recitește harta: fiecare citire e un
  INSERT separat, judecat de gardă și de politică pe cont propriu, iar raportul spune ce a
  intrat și ce nu (un 42501 devine „Nu aveți dreptul…", un P0001 își păstrează mesajul).
  Nu e tranzacție: o citire refuzată nu le anulează pe celelalte.
- `rezolvaSesizare` are DOUĂ scrieri, în ordine obligatorie: întâi intervenția (legată prin
  `fault_report_id`), apoi sesizarea cu `intervention_id`-ul ei; dacă a doua dă zero rânduri
  sau eroare, intervenția abia inserată se anulează logic și acțiunea întoarce CONFLICT.
- Exporturile (`src/app/api/export/mentenanta/echipamente/route.ts`, `verificari`,
  `rapoarte`) cer `maintenance:export` / team și își marchează `trunchiat` când ating
  plafonul. — [[modul/mentenanta/rapoarte]]

## Citirile

Funcții libere, `organizationId` primul argument, `.is("deleted_at", null)` acolo unde
politica nu o face, cursor keyset în loc de `.range()`:

- **`src/lib/queries/maintenance.ts`** — parcul și fișa utilajului (`listeazaEchipamente`,
  `citesteEchipament`, `copiiEchipament`), contoarele (`contoareEchipament`,
  `ultimeleCitiriContor`), planurile (`planuriScadente`, `listeazaPlanuri`, `citestePlan`,
  `citiriPentruProiectie`), intervențiile (`interventii`, `citesteInterventie`,
  `piesePeInterventie`), sesizările (`sesizari`, `citesteSesizare`, `comentariiSesizare`,
  `istoricSesizare`, `sesizariAtribuite`, `sesizareDeschisaPeEchipament`), opririle
  (`opririSesizare`, `opririEchipament`, `opririDeschise`), ISCIR (`autorizatiiIscir`,
  `listeazaAutorizatiiIscir`, `stareRsvti`), atașamentele (`atasamente`, `urlSemnate`),
  setările (`setariMentenanta`) și selectoarele (`optiuniAngajati`, `optiuniDepartamente`,
  `optiuniEchipamente`, `categoriiEchipamente`).
- **`src/lib/queries/maintenance-rapoarte.ts`** — citirile raportului, paginate keyset cu
  plafon și semnalul `trunchiat` (`interventiiInPerioada`, `sesizariInPerioada`,
  `opririInPerioada`, `planuriPentruRaport`, `echipamentePentruRaport`).

`max_rows = 1000` TRUNCHIAZĂ TĂCUT, deci agregările paginează intern și arată
`trunchiat` când ating plafonul. — capcana #2. `angajatiDupaId` citește și `deleted_at`,
fiindcă `hrefFisa()` decide pe rând dacă numele devine link: o fișă ștearsă rămâne text, nu
link spre 404. Căutarea liberă trece prin `tiparContine` (`src/lib/queries/cursor.ts`):
`%` și `_` tastate de om ar fi jokeri.

Selectoarele din tabele ale ALTOR module nu se citesc cu clientul utilizatorului când
rolul care scrie n-are cheia vecină (punctele de lucru cer `departments:read`).
— capcana #57

## Erorile traduse

`traduEroare` din `src/app/(app)/mentenanta/erori.ts` are patru ramuri: 23505 (un singur
mesaj pentru codul de echipament și numărul ISCIR, fiindcă codul Postgres nu spune care index
a picat), 22012 și 22003 (valoare numerică în afara intervalului) și **P0001, al cărui mesaj
trece neschimbat, tăiat la 300 de caractere** — gărzile scriu pentru omul de la capăt, cu
cifrele în text. Orice alt cod (42501, 23503, 23514, 428C9) se aruncă mai departe ca obiect.
Fără `erori.ts`, `mapPostgrestError` ar înlocui orice P0001 cu „Operațiunea a fost respinsă de
o regulă a sistemului." — capcana #3.

Regula pentru o gardă nouă: mesajul încape în 300 de caractere, se termină cu punct și intră
în `erori.test.ts`. Acela citește mesajele lui `0211` direct din migrare (un mesaj nou intră
singur în probă) și are lista celor din `0210` scrisă de mână — deci o gardă adăugată în
`0210` sau într-o migrare nouă își cere rândul în test.

## Ce NU e aici

Mașina de stări a sesizării și drepturile pe actori: [[modul/mentenanta/sesizari]]. Formulele
scadenței: [[modul/mentenanta/planuri]]. Formulele raportului:
[[modul/mentenanta/rapoarte]].

## Când NU e suficientă pagina asta

- Payload-ul exact și căile revalidate ale unei acțiuni: `actions.test.ts` din directorul ei,
  și `actions-triaj.test.ts` pentru triaj, pe client Supabase fals.
- Ce poate scrie un rol în realitate: `tests/rls/izolare.sql` (verificarea `(l)`, blocurile
  de mentenanță) și `tests/rls/proba-sesizari-roluri.sql`.
