# Consola de platformă — separarea contului de super-admin și redesign

**Stare:** APROBAT (2026-08-22) · **Dată:** 2026-08-22 · **Machete:** publicate, varianta A aprobată

---

## De ce

Trei probleme distincte, descoperite împreună, care se rezolvă în aceeași trecere.

**1. Contul de super-admin nu e separat de cel de administrator de firmă.**
Schema separă *rolul* — `organization_members` are un CHECK care interzice valoarea
`super_admin`, iar sursa de adevăr e `platform_admins`. Dar nimic nu împiedică *aceeași
persoană* să fie și una și alta, iar contul curent (`demo_admin@gmail.com`) e exact așa:
platform admin **și** `org_admin` în două organizații. Separarea există în schemă și lipsește
în practică.

**2. Un super-admin aterizează în aplicația de firmă.**
`RUTA_DUPA_AUTENTIFICARE` e constanta `/panou`, fără ramură pentru platform admin. Consola de
platformă e tratată ca o anexă, cu un link discret „Înapoi în aplicație". Consecința care
contează pentru ordinea etapelor: un platform admin **fără** apartenență la vreo firmă ajunge
prin `resolveTenant()` în starea `fara_organizatie` → `/alege-organizatia` cu listă goală.
Adică dacă separăm contul înainte de a repara rutarea, ne blocăm singuri afară.

**3. Zona de platformă arată neterminat.**
Tabloul de bord e un titlu și patru cartele. Meniul are trei intrări, deși există pagini pentru
e-mailuri și pentru panoul propriu-zis. Iar `nav-platforma.tsx:11` trimite la
`/super-admin/jurnal-audit`, în timp ce pagina trăiește la `/super-admin/audit` — de aici
impresia că pagina lipsește.

---

## Ce NU se schimbă

Delimitarea e parte din decizie, nu o notă de subsol.

- **Cele 24 de module de organizație** (`src/app/(app)/**`) rămân neatinse.
- **`src/app/globals.css`** primește **un singur** token nou. Regula „crem = fundal, navy =
  structură, accent rar" rămâne cum e scrisă.
- **Nicio temă întunecată.** `color-scheme: light` e o decizie documentată în `globals.css`, cu
  motivul scris: fără ea, `<select>` și calendarele native se desenează negru pe crem.
- **Fontul aplicației de firmă** rămâne Inter. Plex se aplică doar în `(platform)`.
- **Nicio migrare** nu e necesară. Schema susține deja tot ce urmează.

---

## Decizii luate

| Întrebare | Decizie |
|---|---|
| Contul tău de super-admin | Cont **nou**, doar în `platform_admins`, fără apartenență la vreo firmă. `demo_admin` rămâne neatins, ca date de demonstrație. |
| Cuprinsul redesign-ului | Doar `(platform)/super-admin/**` — ~10 ecrane. |
| Coloana vertebrală a panoului | Panou de sumar la intrare, lista de organizații separat. |
| Chrome | **Varianta A**: rail navy + antet navy + pânză crem. |
| Ce vede super-adminul | Firme, module, înregistrări. **Nimic** operațional — fără angajați, pontaje, salarii. |

---

## Arhitectura

### 1 · Model de conturi și rutare

**Rutarea se repară ÎNAINTE de a atinge conturile.** Ordinea nu e preferință, e dependență.

`isPlatformAdmin()` din `src/lib/auth/platform.ts` există deja, e memoizat cu `cache()` și
citește `platform_admins` cu `revoked_at is null`. Îl refolosim — nu scriem altul.

Trei puncte de decizie:

- **`src/app/auth/callback/route.ts`** — după schimbul PKCE, dacă `isPlatformAdmin()` e adevărat
  și utilizatorul **nu** are nicio apartenență activă, redirecționează la `/super-admin`.
  Baza redirecționării rămâne `NEXT_PUBLIC_APP_URL`, nu `request.url` — comentariul din fișier
  explică de ce (antetul `Host` e controlat de client).
- **`src/proxy.ts`** — regula „autentificat pe `/` → `RUTA_DUPA_AUTENTIFICARE`" capătă aceeași
  ramură. Atenție: proxy-ul **nu** e boundary de autorizare (CVE-2025-29927) și nu trebuie să
  devină unul — aici e strict confort de navigare.
- **`/alege-organizatia`** — când lista e goală *și* utilizatorul e platform admin, ecranul
  oferă „Intră în consola de platformă" în locul fundăturii actuale.

Pentru cine e **și** platform admin **și** membru într-o firmă (cazul `demo_admin`), antetul
consolei primește un comutator explicit între planuri. Înlocuiește linkul „Înapoi în aplicație",
care astăzi sugerează că platforma e o abatere de la aplicație, nu un plan de sine stătător.

**Contul nou** se creează prin Supabase Auth (invitație pe e-mail), apoi un singur `insert` în
`platform_admins`. **Fără** rând în `organization_members`. Un script sub `scripts/` — zona în
care ESLint permite `createAdminSupabase()` — nu o migrare: e un fapt de date, nu de schemă.

> **Confirmat:** contul de super-admin se creează pe `scoala.ai43@gmail.com`.

### 2 · Sistemul vizual al zonei de platformă

**Culoarea ca semnal.** Zona de platformă devine navy-dominantă, aplicația de firmă rămâne
crem-dominantă. Culoarea îți spune singură în ce plan ești — bannerul „Panou de platformă"
devine redundant, nu obligatoriu.

**Un singur token nou**, în `globals.css`, marcat explicit ca fiind al consolei:

```
--color-navy-abis: #0a1428;   /* chrome-ul consolei de platformă */
```

Restul sunt tokenurile existente: `--color-primary` (#0f1e3d), `--color-ring` (#2a3d66),
`--color-background` (#faf7f0), `--color-surface` (#f2ede1), `--color-accent` (#c9a227).
Aurul rămâne rar prin definiție: indicatorul de meniu activ și pastilele de număr. Atât.

**Fonturi.** Inter → **IBM Plex Sans** + **IBM Plex Mono**, doar în `(platform)`.
Subsetul `latin-ext` e **obligatoriu**, din exact motivul documentat în `src/app/layout.tsx`:
fără el, ș și ț cu virgulă (U+0219/U+021B) cad pe un font de rezervă și textul apare cu grosimi
amestecate în mijlocul cuvintelor. Plex Mono poartă cifrele — CUI, ore, sume, ID-uri de cerere —
cu `font-variant-numeric: tabular-nums`, ca să se alinieze în coloane.

Instanța `next/font` se declară la nivel de modul, într-un fișier propriu al zonei, iar variabila
se aplică pe învelișul din layout-ul de platformă. Root layout-ul rămâne neatins.

**Componentele scheletului**, noi, în `(platform)/super-admin/_components/`:
`rail-platforma.tsx` (înlocuiește `nav-platforma.tsx`), `antet-platforma.tsx`,
`cifra.tsx`, `stare-organizatie.tsx`, `module-mini.tsx` (cele 14 pătrățele), `sarcina.tsx`.
Toate în interiorul zonei — nimic în `src/components/`, ca aplicația de firmă să nu moștenească
nimic din greșeală.

### 3 · Ecrane

**Panoul** (`/super-admin`) — banda de stări, coada de lucru, activitatea recentă.
`sumarPlatforma()` din `organizatii/actions.ts` întoarce deja organizațiile pe stări,
cererile demo noi și invitațiile în așteptare. Îi adăugăm ce lipsește pentru coada de lucru:

- firme fără niciun modul în afară de `nucleu` (înregistrate dar nepornite);
- firme fără niciun `org_admin` activ;
- ultimele intrări din `audit_logs`, pe toate organizațiile.

**Constrângere care decide unde stă codul:** citirile de platformă sunt inevitabil
cross-organizație, deci cer `service_role`. ESLint permite `createAdminSupabase()` doar în
`actions.ts`, `api/**/route.ts`, `rate-limit.ts`, `scripts/**`, `tests/**` — prin urmare
**nu** pot merge în `src/lib/queries/` ca restul aplicației. Rămân în `organizatii/actions.ts`,
lângă `sumarPlatforma`, fiecare cu comentariul care spune de ce ocolește RLS.

Coada de lucru arată doar lucruri pe care platforma le poate chiar detecta. Un panou care e
mereu plin nu mai înseamnă nimic; ăsta trebuie să se golească.

**Organizații** (`/super-admin/organizatii`) — starea și modulele citite din rând, fără intrare
în fișă. Modulele ca 14 pătrățele, nu ca „1/14": un rând aproape gol se vede din reflex.

**Jurnal de audit** — ruta se **redenumește** `audit/` → `jurnal-audit/`, nu se schimbă linkul
din meniu. Trei locuri din trei folosesc deja numele „jurnal-audit": meniul
(`nav-platforma.tsx:11`), fișierul CSV exportat (`jurnal-audit-2026-08-22.csv`) și componenta
(`src/components/audit/jurnal-audit.tsx`). Doar ruta se abate — deci ea se aliniază, nu ele.
Schimbarea linkului ar fi fost o literă mai puțin de scris și un nume mai mult de reținut.

**Restul** — fișa organizației, membri, module, permisiuni, cereri demo, e-mailuri și asistentul
în 7 pași — primesc același schelet și aceleași componente.

---

## Etape

Fiecare etapă se termină cu ceva verificabil. Ordinea e impusă de dependențe, nu de preferință.

### Etapa 1 · Rutarea (fără atingerea conturilor)
`auth/callback/route.ts`, `src/proxy.ts`, `/alege-organizatia`, comutatorul de planuri în
antetul consolei.
**Verificare:** `demo_admin` (dublu rol) ajunge în consolă și poate comuta în firmă. Un cont
obișnuit ajunge în `/panou`, neschimbat.

### Etapa 2 · Contul de super-admin
Script sub `scripts/`: invitație Supabase Auth + `insert` în `platform_admins`, fără
`organization_members`.
**Verificare:** contul nou se autentifică, aterizează direct în `/super-admin`, iar
`/panou` nu-l mai blochează într-o fundătură.

### Etapa 3 · Scheletul consolei
Token, fonturi, rail, antet, pânză, componentele comune. Ecranele existente se mută pe schelet
fără modificări de conținut.
**Verificare:** `pnpm build` trece; toate cele 10 ecrane se randează; aplicația de firmă e
neschimbată la pixel.

### Etapa 4 · Panou, organizații, jurnal
Ecranele principale, cu datele noi pentru coada de lucru. Redenumirea rutei de audit intră aici.
**Verificare:** panoul arată cele 3 organizații reale și cererea demo; jurnalul se deschide din
meniu.

### Etapa 5 · Restul ecranelor de platformă
Fișă, membri, module, permisiuni, cereri demo, e-mailuri, asistentul în 7 pași.
**Verificare:** lanțul complet, plus o parcurgere manuală a fiecărui ecran.

> Etapele 1–4 sunt livrabilul care schimbă ceva: cont separat, rutare corectă, consolă
> funcțională pe ecranele care se folosesc zilnic. Etapa 5 e repetiție mecanică a aceluiași
> limbaj pe restul ecranelor și poate fi amânată sau planificată separat, fără ca 1–4 să
> rămână incomplete.

---

## Riscuri și capcane

**Ordinea etapelor 1–2 nu e negociabilă.** Un platform admin fără firmă, cu rutarea nereparată,
ajunge în `/alege-organizatia` cu listă goală. Etapa 2 înainte de etapa 1 înseamnă un cont nou
care nu poate ajunge nicăieri.

**`demo_admin` rămâne cu dublu rol.** E intenționat: e singura cale de a testa comutatorul
între planuri. Nu-l curățăm.

**Imaginea e legată de domeniu la build.** `NEXT_PUBLIC_APP_URL` se coace în bundle-ul de
client, iar `auth/callback` îl folosește ca bază de redirecționare. Orice atingere a rutării de
autentificare cere **rebuild**, nu doar redeploy.

**Tagul imaginii trebuie să se schimbe.** Pe arbore murdar, `administrativo.sh` adaugă un
marcaj de timp; altfel `docker stack deploy` vede aceeași specificație și nu repornește nimic —
un verde fals deja plătit o dată.

**Cele 9 erori de tip din migrarea 0035 rămân.** Nu au legătură cu zona asta și nu se rezolvă
aici. `DOCKER_BUILD=1` continuă să lase build-ul de imagine să treacă.

---

## Verificare

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

`pnpm verify` **nu** include `build`, iar build-ul e singurul care prinde granița server/client —
un fișier `"use server"` care exportă o constantă trece de `tsc` și cade la build. Zona de
platformă are `actions.ts` în fiecare segment, deci riscul e real.

Pe lângă lanț, la final:

- **Proba de rol:** contul nou de super-admin vede consola și **nu** vede aplicația de firmă;
  un `org_admin` obișnuit primește 404 pe `/super-admin` (nu 403 — consola nu se anunță).
- **Non-regresie vizuală:** `(app)/**` neschimbat.
- **Ecranele de platformă:** parcurse manual, toate 10.
- **`./administrativo.sh prod`**, apoi verificarea că imaginea activă e chiar cea construită.
