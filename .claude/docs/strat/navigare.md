---
tip: strat
titlu: Navigarea între module
aliases: [navigare, legaturi-intre-module, porti-ruta]
cai:
  - "src/config/porti-ruta.ts"
  - "src/components/ui/link-entitate.tsx"
  - "src/components/ui/tabel.tsx"
  - "src/components/data/rand-tabel.tsx"
  - "src/components/registru/numar-registru.tsx"
  - "src/components/ui/pastile-filtre.tsx"
  - "src/app/(app)/notificari/legaturi.ts"
  - "src/app/(app)/departamente/panou-departament.tsx"
tabele: [registru_documente]
permisiuni: []
capcane: []
scris_pe: fc705346848ef5aaa3e15fc4d2e68593d718ba06
scris_la: 2026-10-09
tags: [strat, navigare]
---

# Navigarea între module

Regulile prin care un ecran duce la entitatea pe care o arată, și o fișă leagă ce ține de
ea în celelalte module. Analiza completă, cu id-urile pe module:
`docs/design/navigare-intre-module.md`; stadiul mecanic al reparațiilor:
`docs/design/navigare-intre-module-progres.md`.

## Patru reguli care nu se negociază

1. **Linkul trece prin poarta paginii-ȚINTĂ**, nu a sursei: `poateDeschide(ruta, {features,
permissions})` din `src/config/porti-ruta.ts` (modul activ + permisiunea paginii, cu
   `minScope`). O rută pe care registrul n-o cunoaște se lasă cum e — lipsa din registru
   nu e un refuz. Pe o pagină care doar afișează linkul nu se folosește `requireFeature`.
2. **„Legabil" se decide PER RÂND**: rândul a venit prin RLS, `deleted_at` e `null`, iar
   `can()` trece — `LinkEntitate` + `hrefFisa()`. Un `can(employees:read, team)` global ar
   trimite managerul în refuz pe fișele din afara echipei. Un rând șters sau ascuns rămâne
   text, niciodată link spre 404.
3. **Cifra duce la aceeași listă, pe același predicat** ca numărătoarea (`badgeHref` pe
   `NavItem`, cardurile panoului, sumarele din antete). Un contor fără țintă e o minciună cu
   un clic întârziere.
4. **În portal ținta e mereu `/portal/*`; în `(app)` niciodată.** Notificările nu se
   corectează în bază: se traduc la randare (`caleaInAplicatie` / `caleaDePortal`), vezi
   [[modul/notificari]].

## Primitivele, și unde locuiesc

- **Filtru de intrare**: `?angajat=`, `?department_id=`, `?departament=`, `?punct_lucru=`,
  `?eveniment=` — UUID validat în schemă, aplicat în ACELAȘI `filtreaza` ca lista, ca lista
  și contorul să cadă de acord; pastila vine din `PastileFiltre` sau din `cheiExterne` al
  barei de filtre. Listele pre-citesc id-urile și pun `.in("id", ids)`; mulțimea goală se
  exprimă printr-un UUID imposibil, nu prin `.in("id", [])`.
- **Adresă pentru ce n-avea**: departament = `/departamente?departament=<id>`
  (panoul se derivă din adresă, cu `replaceState`); punct de lucru =
  `/puncte-lucru?punct=<id>#punct-<id>`; dosar de poprire = `#dosar-<id>`.
- **Rândul evidențiat după acțiune**: `?nou=<id>` decis pe SERVER (`:target` nu se aprinde
  după o navigare din client) — pe carduri prin clasă, în `Tabel` prin `evidentiat` +
  `idRand` (inel și ancoră, în ambele randări: `<tr>` și cardul de telefon).
- **Toastul cu `actiune` nu se stinge** singur; `FormularDialog.laReusita(data)` face
  `push`/`replaceState` spre obiect.
- **Decizia stă pe fișa obiectului** (`DecizieDeplasare`, `DecizieFoaie`,
  `ButonTransmite`), nu doar în coadă; `ButonTransmite` leagă fișa salariatului în textul
  confirmării (`hrefAngajat`), ca verificarea să fie la un clic de apăsare.
- **Numărul de registru pe documentul-sursă**: `NumarRegistru` (server, autonom: își
  citește porțile singur, memoizate) pe cererea de concediu, deplasare, foaie, accident,
  perioada de salarizare; `/pontaj/arhiva` leagă coloana „Nr. înregistrare". Citirea trece
  prin RLS — fără `registru:read` nu randează nimic. Sensul invers e
  `registru/legaturi.ts` (`legaturaDocument`), inclusiv adeverința de curs →
  `/cursuri/<curs>/stadiu?angajat=`.
- **Rail pe fișă/panou**: secțiunea „În alte module" de pe fișa angajatului
  ([[modul/angajati/navigare]]); panoul departamentului primește porțile ca booleeni
  (`LegaturiPanou`) calculați pe server și construiește href-urile din id — funcțiile nu
  trec granița server→client. Vecinii din arbore (părinte, subordonate) se deschid în
  același panou prin `laDeschidere`.

- **Jurnalul de audit ca țintă**: `IstoricModificari` (server, autonom) pe fișe →
  `/setari/audit?entity_id=<uuid>` (fără `entitate`: triggerele scriu numele tabelei,
  acțiunile literalul singular); `interogheazaJurnal` face `eq` pe un UUID complet.
  În jurnal, autorul duce la `?actor=`, valorile-cheie străină din detalii la rândul lor
  (`rutaValorii`), organizația (în consolă) la fișa firmei.

## Ce refuză tăcut

- `scopeFor` întoarce `null` pentru permisiune absentă, nu `"none"`: porțile testează
  ambele (`meetsScope`), altfel un rol fără niciun rând `x:*` trece.
- Un link spre `/anunturi/<id>` expirat duce în `not-found.tsx`-ul propriu, nu în 404-ul
  rădăcină; în notificări anunțul invizibil devine text.
- Coada REGES e tăiată la cele mai noi 200 de mesaje: „N mesaje în coadă" de pe eveniment
  se numără din ce e afișat, deci un eveniment vechi poate arăta 0 fără să fie gol.

## Când NU e suficientă pagina asta

- Registrul porților în sine și testul lui de completitudine (lista se compară cu discul în
  ambele sensuri): `src/config/porti-ruta.test.ts`.
- Traducerea notificărilor și învelișul push după rol: [[modul/notificari]].
- Fișa angajatului ca punct de plecare: [[modul/angajati/navigare]].
