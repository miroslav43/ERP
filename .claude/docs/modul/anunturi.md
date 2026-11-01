---
tip: modul
titlu: Avizier (anunțuri)
aliases: [anunturi, avizier, announcements]
cai:
  - "src/app/(app)/anunturi/**"
  - "src/domain/announcements/anunt.ts"
  - "src/lib/queries/announcements.ts"
  - "src/schemas/announcement.ts"
  - "supabase/migrations/0028_announcements.sql"
tabele: [announcements, announcement_reads, notifications]
permisiuni: [announcements:read, announcements:create, announcements:update]
feature: announcements
capcane: [2, 17]
scris_pe: c78f84c1a25c63c9490dcfe8104b51bf51aff507
scris_la: 2026-11-01
tags: [modul]
---

# Avizier (anunțuri)

Anunțuri publicate întregii firme, cu confirmare de citire per angajat. Modulul cel mai
mic din proiect și, din cauza asta, **referința pentru preambulul unei pagini**: `CLAUDE.md`
trimite la `src/app/(app)/anunturi/page.tsx` pentru lanțul canonic
`requireTenant` → `requireFeature` → `getPermissionMap` → `can()` → `AccesRestrictionat`.

Săgețile din lanț sunt ordinea deciziilor, nu ordinea așteptărilor. În
`src/app/(app)/anunturi/page.tsx` și în `src/app/(app)/anunturi/[id]/page.tsx`,
`requireFeature` și `getPermissionMap` pleacă împreună într-un `Promise.all`: citesc
tabele diferite, niciuna n-are nevoie de rezultatul celeilalte, iar în serie erau două
dus-întorsuri către PostgREST unul după altul. Refuzurile rămân în aceeași ordine —
`notFound()` din `requireFeature` respinge `Promise.all`, deci un modul dezactivat dă
404 înainte ca `can()` să ajungă să se uite la permisiuni. Doar `requireTenant` rămâne
obligatoriu înaintea lor: le dă amândurora argumentele.

## Rute și cine ajunge

| Rută             | Poartă                                                    |
| ---------------- | --------------------------------------------------------- |
| `/anunturi`      | `announcements:read` own; administrarea cere `update` all |
| `/anunturi/[id]` | idem                                                      |

Toate rolurile au `announcements:read = all` în seed. Nu există anunț „pentru un
departament".

## Server Actions

| Funcție               | Permisiune / minScope        |
| --------------------- | ---------------------------- |
| `creeazaAnunt`        | `announcements:create` / all |
| `publicaAnunt`        | `announcements:update` / all |
| `actualizeazaAnunt`   | `announcements:update` / all |
| `retrageAnunt`        | `announcements:update` / all |
| `stergeAnunt`         | `announcements:update` / all |
| `marcheazaAnuntCitit` | `announcements:read` / own   |

`actualizeazaAnunt` NU retrimite notificări (corecția nu sună a doua oară telefoanele).
`retrageAnunt` pune `expira_la = now()` doar pe un anunț publicat — anunțul iese de pe
avizier și rămâne pe fișă, cu confirmările. `stergeAnunt` e `deleted_at` prin UPDATE, în
orice stare: politica de UPDATE nu condiționează `deleted_at`, iar `announcements:delete`
nu există în `PERMISSION_KEYS`. Toate trei stau în `[id]/actiuni-anunt.tsx`.

`marcheazaAnuntCitit` e singura acțiune din modul pe care o poate chema un angajat — de
aceea e pe `read`, nu pe `update`: confirmarea de citire nu e o modificare a anunțului.

`anuntEditareSchema` e `anuntNouSchema` fără `publica_acum`, cu `id` — limitele de titlu
și conținut sunt deci aceleași la creare și la editare, dintr-un singur loc.

Expirarea are două porți, nu una. Schema e pură (fără `new Date()`), deci regula de ceas
stă în acțiune: `refuzaExpirareaTrecuta` aruncă `invalidInput` PE CÂMPUL `expira_la`
înainte de orice interogare, cu granița `<=` a lui `expirareInTrecut` — „azi" trece
(caseta trimite `sfarsitulZileiRomania`, 23:59:59 al zilei), „ieri" nu. La editare,
poarta se deschide doar dacă omul a ATINS ziua: `actualizeazaAnunt` citește `expira_la`
stocat ÎNAINTE de UPDATE (golul e NEGASIT, nu UPDATE orb), iar `expirareLaEditare`
compară pe ZIUA românească, nu pe moment. O zi neschimbată nu intră deloc în payload —
altfel un anunț expirat sau retras nu se mai putea corecta la text fără să fie repus pe
avizier, iar unul retras azi la 10:00 își pierdea tăcut retragerea până la miezul
nopții, fiindcă 23:59:59 al zilei e în viitor. Golirea datei și o zi viitoare rămân
scrieri explicite: acolo omul a cerut chiar repunerea pe avizier.

Reușita fiecărei scrieri se spune prin `arataToast`, nu prin ce apare pe ecran după
navigare: fișa pe care aterizează administratorul după publicare își marchează singură
citirea și scrie „Confirmat citit." — textul altei acțiuni, luat la probă drept
confirmarea publicării (ADM-029). Eroarea rămâne lângă buton, în `<p role="alert">`.

Auditul lui `creeazaAnunt` are allow-list `["titlu", "fixat"]`: `continut` nu intră
niciodată în jurnal, deci jurnalul de audit nu e o a doua copie a textului anunțului.

## De ce nu există direcționare pe departament

`announcement_attachments` și `announcement_targets` figurau în planul aprobat și au rămas
**neconstruite deliberat**. Motivul e seed-ul: `announcements:read = all` e acordat tuturor
rolurilor, deci un anunț e mereu vizibil întregii organizații. O tabelă de direcționare ar
fi fost decorativă cât timp pragul de citire e `all` pentru toată lumea.

Ordinea corectă, dacă apare vreodată nevoia: **întâi se schimbă seed-ul de permisiuni**,
abia apoi tabela. Invers, tabela ar exista fără să restrângă nimic.

## Citiri

`src/lib/queries/announcements.ts` începe cu `import "server-only"`: o componentă client
sau un test care ar importa fișierul cade la încărcare, nu la prima interogare.

Cele două liste ale modulului filtrează din locuri diferite, intenționat.
`listeazaAnunturi` (administrare) nu reproduce nimic: ce vede cititorul îl decide
`announcements_select`, de unde și ciornele vizibile adminului. `anunturiPublicate`
(portal) scrie filtrul „publicat, neexpirat" **explicit în interogare**, fiindcă „ale
mele" din portal trebuie să însemne același lucru indiferent de scope-ul celui care
deschide ecranul — regula e cea din capul lui `queries/portal.ts`. Marca temporală intră
ca argument `acum`, ca citirea să rămână deterministă la test.

`listeazaAnunturi` cere `LIMITA_ANUNTURI + 1` rânduri și întoarce doar `LIMITA_ANUNTURI`:
rândul-sentinelă e singurul mod de a deosebi „exact limita" de „mai multe". Cu
`randuri.length >= limita`, un avizier cu exact `LIMITA_ANUNTURI` anunțuri își anunța
cititorul că mai are și altele, neadevărat. Dacă schimbi limita, schimbi și `.limit()`,
nu doar tăietura — `src/lib/queries/announcements.test.ts` verifică ambele.

## Ce refuză baza tăcut

- **Confirmarea de citire e unică pe (organizație, anunț, angajat)**, prin
  `announcement_reads_uq` (`0028_announcements.sql:54-55`). `marcheazaAnuntCitit` caută
  confirmarea înainte de a o scrie, deci a doua apăsare pe același ecran nici nu ajunge la
  INSERT. Între căutare și INSERT nu e însă niciun zăvor: două file deschise pe același
  anunț trec amândouă de căutare, iar a doua ia 23505. Handlerul din
  `src/app/(app)/anunturi/actions.ts` îl tratează acum ca reușită — efectul dorit există
  deja, iar un „Există deja o înregistrare" pe ecran spunea, fals, că anunțul rămâne
  necitit. **Numai** 23505 e înghițit; orice alt cod urcă neschimbat. Nu mai e defect
  cunoscut: testul care îl descria e `it` verde în
  `src/app/(app)/anunturi/actions.test.ts`.
- **Un utilizator fără fișă de angajat** (administrator pur) primește reușită de la
  `marcheazaAnuntCitit` fără ca nicio confirmare să se scrie: `idFisaProprie` întoarce
  `null` și handlerul iese devreme. De aceea numitorul raportului de citire e
  `numarAngajatiCuCont`, nu `numarAngajatiActivi` — cine nu are cont nu poate confirma.
- **Publicarea la creare nu e atomică.** `creeazaAnunt` cu `publica_acum` inserează
  anunțul, apoi scrie notificările într-o a doua rundă, fără o tranzacție comună. Dacă
  fanout-ul e respins, acțiunea întoarce eroare și nu revalidează nimic, dar anunțul rămâne
  pe disc, publicat și fără notificări. Un „a eșuat" pe ecran nu înseamnă aici „nu s-a
  scris nimic".
- **Cele trei constrângeri CHECK ale tabelei ajung pe câmp, nu în Callout**
  (`0028_announcements.sql:34-37`). `traduEroare` din `src/app/(app)/anunturi/erori.ts`
  prinde 23514 și potrivește numele constrângerii din `error.message`:
  `announcements_expirare_ck` → `expira_la`, `announcements_titlu_len` → `titlu`,
  `announcements_continut_len` → `continut`. Zod nu vede niciuna dintre căile astea:
  publicarea unei ciorne vechi cu expirarea deja trecută, editarea cu expirarea înaintea
  publicării, retragerea unui anunț PROGRAMAT (`now() < publicat_la`). Până la
  traducere, toate dădeau „Datele nu respectă regulile de validare. Cod de referință:
  …", fără niciun câmp marcat (ADM-029). Se aruncă `invalidInput`, nu `businessRule`: al
  doilea n-are `fieldErrors`, deci mesajul ar ateriza în capul formularului și
  `<Camp nume="expira_la">` n-ar primi `aria-invalid`. Orice alt cod — și orice 23514 cu
  alt nume de constrângere — urcă neschimbat, pe `mapPostgrestError`
  (`src/app/(app)/anunturi/erori.test.ts`).
- **Un anunț nepublicat e invizibil angajaților**, dar rămâne vizibil administratorilor, ca
  să-l poată edita înainte de publicare sau după expirare. Deci o listă goală pentru
  angajat, cu rânduri pentru admin, e comportamentul corect, nu un defect de filtrare.
- **Lista de administrare se taie la o limită proprie, declarată.** Fără `.limit()`,
  PostgREST ar fi tăiat la `max_rows` fără eroare și fără antet, exact anunțurile cele mai
  vechi. `LIMITA_ANUNTURI` e mai mică și, mai ales, cunoscută de ecran, care spune în clar
  că lista s-a oprit (`src/app/(app)/anunturi/page.tsx:232-236`). — capcana #2
- **`publicaAnunt` e o tranziție**: face `.select()` după `.update()`, iar rezultatul gol
  înseamnă conflict, nu succes. — capcana #17

## Ce se mișcă împreună

Cifrele privitorului: insigna din meniu (`announcements_unread`, din `contoarePanou.avizier`)
numără anunțurile ACTIVE neconfirmate de fișa proprie și duce la `/anunturi?stare=necitite`,
segment acceptat pe orice rol. Cardurile din listă arată „Citit de X din Y"
(`numarConfirmariPeAnunt`, prin `citesteTot`: 8 angajați × 200 de anunțuri trec de
`max_rows`). Pe fișă, cifra „din Y" duce la „Neconfirmat încă" (`angajatiCuCont` minus
cititorii) doar cu `employees:read = all`. Anunțul expirat deschis dintr-o notificare veche
cade pe `[id]/not-found.tsx` (aplicație și portal), nu în 404-ul rădăcină.

Publicarea face fanout în `notifications` (`0001_kernel.sql`). Poarta de acolo verifică
explicit `announcements:create` pentru cine scrie o notificare în numele altui utilizator —
integrarea era pregătită din nucleu, nu improvizată la `0028`. Ecranul care le arată e
[[modul/notificari]].

## Când NU e suficientă pagina asta

- Tiparul complet al unei pagini noi: `docs/project-overview.md`.
- Ce se întâmplă cu notificarea după fanout: [[modul/notificari]].
- Comportamentul exact al acțiunilor, executabil:
  `src/app/(app)/anunturi/actions.test.ts` — payload-uri, filtre, allow-list de audit, căi
  revalidate, cazurile expirării la editare și cursa pe confirmarea de citire.
  Straturile comune ale lui `createAction` se verifică o singură dată, în
  `src/app/(app)/salarizare/actions.test.ts`.
- Logica pură din spatele stărilor, al extrasului și al expirării (fără I/O, fără ceas
  propriu): `src/domain/announcements/anunt.ts`.
