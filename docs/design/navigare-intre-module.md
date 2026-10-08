# Navigare fără frecare între module — sinteza analizei

> Generată pe 2026-10-08 din workflow-ul `wf_a311e448-3e7`: 25 de inventare (24 de module din
> `(app)` + portalul), fiecare verificat adversarial pe două lentile (existență/rute și
> permisiuni/roluri/module opționale), apoi sinteză transversală. Planul de livrare (6 loturi,
> 12 primitive comune) e în `~/.claude/plans/vreau-sa-faci-un-sprightly-puzzle.md`.
>
> Id-uri: `modul-Lx` = lipsă, `modul-Px` = propunere, `modul-Ox` = omisiune găsită de
> verificatori (adesea un link EXISTENT care duce în refuz sau 404). Bilanț: 354 lipsuri,
> 274 propuneri, 28 respinse, 144 omisiuni. Condițiile din tabele sunt cele corectate de
> verificatori. Observație proprie, în afara inventarului: paleta Ctrl+K
> (`src/components/layout/command-palette.tsx`) nu caută entități, doar meniu și firme.

# Navigare fără frecare: sinteza pe module

**Cum se citește.** Id-urile vin din inventar. `modul-Lx` e o lipsă, `modul-Px` e o propunere, iar `modul-Ox` e o omisiune găsită de verificatori; omisiunile sunt numerotate aici în ordinea din date. Condițiile din tabele sunt cele **corectate**, nu cele din propunerea inițială. Notațiile:
- `can(x, s)` este poarta de permisiune.
- „modul X activ” înseamnă `getEnabledFeatures(org).has("X")`, calculat pe server și transmis ca boolean. Pe o pagină care doar afișează un link nu se folosește niciodată `requireFeature`.
- „neșters” înseamnă că rândul a venit prin RLS și are `deleted_at` null.

Registrul a primit deja rândul apăsabil și panoul `?doc=` (a7c2b58), așa că din date mai rămân doar lipsurile lui de după livrare.

---

## 1. Matricea entităților

| Entitate | Rută canonică de detaliu | Module care o afișează CU link | Module care o afișează FĂRĂ link (lipsuri) |
|---|---|---|---|
| **Angajat** | `/angajati/[id]` (ancore existente: `#titlu-incadrare`, `#titlu-contracte`, `#titlu-evaluari`) | angajati (listă, lanțul de manageri); organigrama (cardul); departamente (managerul din listă, persoanele din panou); evaluari (lista anuală); registru (panoul `?doc=`); **cu link necondiționat, deci defect:** rapoarte (rapoarte-L7, O4), reges (registrul de evenimente, reges-O4), salarizare (lista „fără contract”, salarizare-O8) | angajati-L14; anunturi-L1, L2; concedii-L1, L2, L5, L8, L12, L15, O1, O2; cursuri-L1, L2, L6; departamente-L3; diurna-L1, L2, L7; evaluari-L2, L3; flota-L2, L4, L6, L9, L19, O4; inventar-L3, L4, L5, L12; mentenanta-L3, L4, L5, L9; onboarding-L2, L3, L17, O3, O4; organigrama-O1; pontaj-L1, L4, L6, L7, L8, L12, L13, L17; reges-L4, L10, O1, O3; registru-O3, O4; salarizare-L1, L8, L9, L13, L15, O1; setari-L5, L7, O1; ssm-L1–L7; ticketing-L4, L6, L7 |
| **Departament** | nu are rută de detaliu; ținta propusă e `/departamente?departament=<id>` (parametru nou, departamente-P1); filtrul existent e `/angajati?department_id=<id>` | — (panoul se deschide doar din butonul de efectiv) | angajati-L12; concedii-L15; cursuri-L6; departamente-L1, L2, L11, O1; flota-L10; mentenanta-L6; organigrama-L1; panou-L4; pontaj-L17; ssm-L21; ticketing-L18 |
| **Punct de lucru** | nu are rută de detaliu; ținta propusă e `/puncte-lucru#punct-<id>` (puncte-lucru-P1), opțional `/puncte-lucru/[id]` (P9); afișul `/puncte-lucru/[id]/afis` există | puncte-lucru (afișul din rând); pontaj (Coduri QR → afiș) | puncte-lucru-L1, L2, L3, L8, O1 (= angajati-O4); mentenanta-L6; pontaj-L23 |
| **Vehicul** | `/flota/[id]` (`#documente`) | flota (listă clicabilă; fișa → foi prin `?vehicul=`) | flota-L1, L3, L7, L18, O2, O3; angajati-O3; panou-L7 |
| **Foaie de parcurs** | `/flota/foi/[id]` | flota (listă, coada de aprobare, linkul mic din anomalii) | flota-L8, L12, O1, O7; panou-L9 |
| **Echipament (mentenanță)** | `/mentenanta/echipamente/[id]` (`#iscir`, `#contoare`) | mentenanta (listă, „Fără contor”, plan → echipament, sesizare → echipament doar pentru gestionari) | mentenanta-L1, L2, L13, L16, O1, O2, O3; angajati-L10; ssm-L18; portal-L9 |
| **Plan de mentenanță** | `/mentenanta/planuri/[id]` | mentenanta (listă, panoul „De reatribuit”) | mentenanta-L1, L4, L9 |
| **Sesizare** | `/mentenanta/sesizari/[id]`; portal `/portal/sesizari/[id]` | mentenanta (listă, fișa echipamentului, panou); portal; notificări | mentenanta-L11, L17, O1; **linkuri spre o sesizare invizibilă:** mentenanta-O4, O5; notificari-O2, O5 |
| **Bun de inventar** | `/inventar/[id]`; PV `/inventar/[id]/pv/[alocare]`; portal doar `/portal/in-primirea-mea` | inventar (listă, „În primire”) | inventar-L2, L7 (= ticketing-L5), L9, L10, O1, O2, O3; angajati-L4; onboarding-L4; ticketing-L13; portal-L10, L11; **fără poartă:** registru-O5, O6, inventar-O5 |
| **Curs / material** | `/cursuri/[id]`, `/cursuri/[id]/stadiu?angajat=<id>`, `/cursuri/biblioteca/[id]`; portal `/portal/cursurile-mele/[id]` | cursuri (liste, firimituri); portal | cursuri-L2, L3 (= angajati-L5), L4, L5, L10, O1, O2; onboarding-L5, L12, O2; registru-O1; notificari-L3; portal-O1 |
| **Cerere de concediu** | `/concedii/[id]`; portal `/portal/concediile-mele/[id]` | concedii („Cererile mele”, „Echipa”, linkul mic din Aprobări); portal; notificările de decizie | concedii-L4, L5, L7, L12, L13, O3; angajati-L2 (= concedii-L14); notificari-L1; panou-L9; pontaj-L3, L11, L24, O1; portal-L4, L7, L14; rapoarte-O1; salarizare-L3 |
| **Deplasare / diurnă** | `/diurna/[id]`, `/diurna/[id]/decont`; portal `/portal/diurna-mea/[id]` | diurna (listă); portal; coada panoului → `/diurna/aprobari` | diurna-L3 (= angajati-L7), L8, L9, L13, L14 (= salarizare-L5), O3; notificari-L6; panou-L9; portal-L12, O4 |
| **Tichet** | `/ticketing/[id]`; portal `/portal/tichetele-mele/[id]` | ticketing (ambele liste); inventar (fișa obiectului); notificări | ticketing-L14, L16, L18, O2; notificari-O3; panou-L9; inventar-L9, L10 (= ticketing-L15) |
| **Stat de plată / fluturaș** | `/salarizare/[id]`, `/salarizare/[id]/[entryId]`; portal `/portal/salariul-meu` | salarizare (listă, tabelul fluturașilor) | angajati-L9 (= salarizare-L20); salarizare-L6, L10, L21 (= pontaj-L16); rapoarte-L2, L3, L4, L5 |
| **Dosar de poprire** | nu are detaliu; ținta propusă e `/salarizare/popriri#dosar-<id>` | — | salarizare-L14, L18, O3 |
| **Perioadă / săptămână de pontaj** | `/pontaj/perioade/[id]`; foaia `/pontaj?an=&luna=`; săptămâna `/pontaj/saptamana?saptamana=` | salarizare/[id] → perioadă (fără poarta de modul: salarizare-O6); defalcarea pe departamente → aprobare | pontaj-L13, L14, L15, L16, L18, L20, L21, O3; salarizare-L4, L21; rapoarte-L1, O2; notificari-L4, L5, L9, O1; portal-L3, L5 |
| **Anunț** | `/anunturi/[id]`; portal `/portal/anunturi/[id]` | anunturi (card); portal; notificări | anunturi-L3, L4, L6, O1, O4; portal-L8 |
| **Evaluare anuală** | nu are pagină; ținta propusă e `/angajati/[employee_id]#evaluare-<id>` (ancoră nouă); `/evaluari/ale-mele` are ancore | notificarea de finalizare (→ ancoră pe „Ale mele”) | evaluari-L6, L7, L8, L9; angajati-L19 |
| **Luna KPI / set de indicatori** | `/evaluari/kpi/[id]`, `/evaluari/kpi/seturi`; portal `/portal/kpi-ul-meu` | evaluari/kpi (listă) | evaluari-L1, L2, L3, L4, L5, L11, L13, L14, L17, O3, O4 (= portal-L16); angajati-L10 |
| **Accident / instruire / fișă SSM** | `/ssm/accidente/[id]`, `/ssm/stingatoare/[id]`; instruirile n-au detaliu (`/ssm/instruiri?domeniu=&q=`) | ssm (accidente, stingătoare, banda „necomunicate”); registru → accident | ssm-L6, L8 (= angajati-L6), L12, L13, L19, O2; registru-L8 |
| **Parcurs de integrare / ieșire** | `/onboarding/[id]`; portal `/portal/integrarea-mea/[id]` | onboarding (liste, „Sarcinile mele”); notificări în (app) | onboarding-L1 (= angajati-L8), L10, L14, L15, O1; angajati-L16; notificari-L7; portal-L1, L2 |
| **Șablon (integrare, document, evaluare, componentă)** | `/onboarding/sabloane/[id]`, `/angajati/sabloane-documente/[cod]`, `/evaluari/sabloane`, `/salarizare/componente#sablon-<id>` | listele proprii (rând clicabil la integrare) | onboarding-L6, L7, L13, L16; cursuri-L10; angajati-L16, L23; evaluari-L7, L8; salarizare-L17, L18 |
| **Contract de muncă** | nu are rută; `/angajati/[id]#titlu-contracte`; documentul generat `/documente/[id]` | — | angajati-L18, L20 (= panou-L1), O1; reges-L5; salarizare-L8 |
| **Propunere / mesaj / eveniment REGES** | mesajul `/reges/[id]`; propunerile `/reges/propuneri` (fără detaliu); evenimentele `/reges?stare=` | reges (coada → mesaj) | reges-L1, L2, L6, L9, L10, L11, L13, L15, L16, L17, O2; angajati-L18; concedii-L3; panou-L6, O1; pontaj-L5 |
| **Document din registru** | `/registru?an=&doc=<id>` | registru (rând, panou → document și angajat) | registru-L5, L6, L8, L10, O1; angajati-L7 / O5; ssm-O2 |
| **Eveniment de audit** | `/setari/audit?entity_id=` / `?actor=` | — | setari-L1, L2, L3, L4, L8, O1, O2 |
| **Membru / cont / permisiuni** | `/setari/membri`; `/angajati/[id]/permisiuni` | — | setari-L5, L6, L7, L16; departamente-L5; organigrama-O2; profil-L1 |

---

## 2. Primitive comune de construit o singură dată

### 2.1 Registrul porților de rută
**Ce face.** O singură hartă care leagă tipul de entitate sau prefixul de rută de patru lucruri: ruta, modulul, permisiunea și `minScope`. Pe ea stă funcția `poateDeschide(ruta, {features, permisiuni})`. Registrul unifică patru hărți care există deja sau sunt propuse separat:
- `src/app/(app)/registru/legaturi.ts`;
- `RUTA_ENTITATE` din setari-P1;
- harta prefix → modul din notificari-P1;
- `hrefuriPermise` din flota-P9.

Regulile din corecții se aplică peste tot: `null ≠ none` la `scopeFor`, pragul e `all` când sursa arată toată firma, iar fiecare link spre alt modul trece prin poarta țintei, nu a sursei.

- **Acoperă:** setari-L1, L4; registru-O5, O6; notificari-L1, O4; panou-L2, L3, O4, O5; evaluari-O1, O2, O5, O6; inventar-O4, O5; onboarding-O5, O8; pontaj-O6; salarizare-O6; rapoarte-O3; reges-O5. Oferă și condiția pentru fiecare acțiune din `StareGoala` care duce în alt modul (cursuri-O4–O6, ssm-O1, O4–O7, salarizare-O4, organigrama-L9, flota-O6, puncte-lucru-O2).
- **Fișiere:** fișier nou lângă `src/config/navigation.ts`; consumatori: `src/app/(app)/registru/legaturi.ts`, `src/lib/audit/rute.ts` (nou, setari-P1), `src/app/(app)/notificari/legaturi.ts` (nou), `src/components/layout/breadcrumb.tsx`.
- **Efort:** mediu.

### 2.2 `LinkEntitate` / `NumeAngajat`
**Ce face.** O componentă server care primește id-ul, eticheta și un flag „legabil” calculat **per rând**. Flagul e adevărat doar când sunt îndeplinite toate trei condițiile: rândul a venit prin RLS (embed ≠ null sau prezent în `angajatiDupaId`), e neșters, iar `can(...)` trece. Fără flag, componenta afișează text. Pune implicit `relative`. Un singur `can(employees:read, team)` global nu ajunge (corecțiile la anunturi-P1, concedii-P1, diurna-P1, flota-P1, inventar-P3, onboarding-P1, reges-O4, ticketing-P5). Cere `deleted_at` în `angajatiDupaId`, `numeleAngajatilor`, `cititoriAnunt`, embed-urile din tichete și din flotă. Aceeași componentă servește și vehiculul, echipamentul, obiectul, cursul și planul.

- **Acoperă:** toate id-urile din coloana „FĂRĂ link” a rândului **Angajat**, plus flota-L1, L3, L7; mentenanta-L1, L2, L13; inventar-L7; ticketing-L5; cursuri-L4. Corectează și linkurile necondiționate din rapoarte-L7, O4, reges-O4, salarizare-O8.
- **Fișiere:** componentă nouă în `src/components/ui/`; e propusă deja ca `NumeAngajat` în mentenanta-P5.
- **Efort:** mic pentru componentă; mediu pentru aplicare.

### 2.3 Tabel: linkuri imbricate sigure
**Ce face.** Trei schimbări:
- `[&_a]:relative` pe `<p>`-ul de meta din `CardRand`, ca linkurile secundare să nu stea sub overlay-ul `after:inset-0` (mentenanta-P15 corectat). Dispare astfel `relative` pus de mână în fiecare propunere.
- `href` acceptă `string | null` (rapoarte-P5, reges-P7).
- Selectorul `closest` din `RandTabel` include și `dialog` și `summary` (cursuri-P1, rapoarte-P1).

- **Acoperă:** mentenanta-L16; deblochează angajati-P3, departamente-P10, diurna-P1, flota-P1, P2, P11, inventar-P3, rapoarte-L6, L7, reges-L11, cursuri-L1.
- **Fișiere:** `src/components/ui/tabel.tsx`, `src/components/data/rand-tabel.tsx`.
- **Efort:** mic. Se verifică în browser, nu doar în DOM.

### 2.4 Rail „Legături” și secțiuni pe paginile de detaliu
**Ce face.** O bandă de linkuri condiționate plus carduri compacte cu „vezi tot”. Toate legăturile se calculează pe server. Toate citirile intră în **același** `Promise.all`, cu `Promise.resolve([])` pe ramura refuzată. Fără modul nu apare secțiune. În loc de o listă goală falsă din cauza RLS apare „nu aveți acces” (corecția la cursuri-P3).

**Fișa angajatului e punctul central.** O ating angajati-P1, P2, P3, P4, P7, P9, P10, P11, cursuri-P3, diurna-P5, evaluari-P10, P11, P12, flota-P7, inventar-P1, mentenanta-P11, onboarding-P4, P10, pontaj-P9, reges-P10, salarizare-P10, ssm-P2, ticketing-P12 și registru-P7. Are nevoie de un singur proiect de ansamblu și de un singur `Promise.all`.

- **Acoperă:**
  - pe fișa angajatului: angajati-L1, L2, L4–L10, O3; cursuri-L3; diurna-L3; evaluari-L13; flota-L18; inventar-L1; mentenanta-L18; onboarding-L1; reges-L16; salarizare-L20; ssm-L8; ticketing-L14; registru-L7;
  - pe alte pagini de detaliu: concedii-L2; reges-L4–L7; flota-L11; pontaj-L16; puncte-lucru-L2; departamente-L4; evaluari-L3; ssm-L6; cursuri-L5, L10; ticketing-L13; profil-L1, L2.
- **Fișiere:** componentă nouă în `src/components/ui/`; paginile `angajati/[id]`, `concedii/[id]`, `reges/[id]`, `flota/[id]`, `pontaj/perioade/[id]`, `evaluari/kpi/[id]`, `ssm/accidente/[id]`, `ticketing/[id]`, `cursuri/biblioteca/[id]`, `profil`, plus `puncte-lucru/page.tsx` și `departamente/panou-departament.tsx`.
- **Efort:** mic pentru componentă; mare pentru fișa angajatului în ansamblu.

### 2.5 Filtru prepopulat din adresă
**Ce face.** Parametrul nou se validează cu `z.uuid()`. Intră în `cheiExterne` din `BaraFiltre`, nu în `CHEI_PROPRII` (corecțiile la diurna-P4 și inventar-P5). Intră și în `areFiltre`, ca starea goală să spună „filtrat”. Primește o pastilă cu numele. Textul se taie la maximul schemei: altfel `filtreDinUrl` aruncă toată schema (corecția la angajati-P1: `cauta` are cel mult 60 de caractere).

- **Parametri existenți:** `employee_id` (concedii), `angajat` (onboarding, pontaj/saptamana, cursuri/stadiu, registru), `department_id`, `functie`, `template_id`, `responsabil`, `atribuit`, `punct_lucru`, `iscir`.
- **Parametri noi din date:**
  - `?angajat=` pe `/diurna`, `/inventar`, `/evaluari/kpi`, `/pontaj`, `/reges`, listele SSM și `/salarizare/istoric-venituri`;
  - `?sofer=` pe `/flota/foi`;
  - `?solicitant_employee_id=` pe `/ticketing/coada`;
  - `?punct_lucru=`, `?componenta=` și `?contract=expira` pe `/angajati`;
  - `?sablon=` pe `/onboarding`;
  - preselectare prin `?angajat=` / `?sablon=` / `?pentru=` / `?tip=&obiect=` pe formularele de creare.
- **Acoperă:** diurna-L4, L5; inventar-L6; evaluari-L5; pontaj-L19; reges-L16; ssm-L13, L15, L20, L21; salarizare-L16, L17; flota-L13, L18; ticketing-L14, L15; puncte-lucru-L2; onboarding-L7, L13; concedii-L10; angajati-L20.
- **Fișiere:** `src/schemas/*.ts`, `src/lib/queries/*.ts`, `filtre-*.tsx`, `src/components/ui/bara-filtre.tsx`.
- **Efort:** mic pe fiecare listă.

### 2.6 Cifra duce la aceeași listă (inclusiv insignele de meniu)
**Ce face.** Fiecare `Indicator`, cartelă de panou, fișă de sinteză sau insignă primește un `href` spre o listă filtrată cu **aceeași funcție de predicat** ca numărătoarea. `Indicator` acceptă deja `href`. Pentru cartelele cu sparkline e nevoie de `aria-label` explicit (rapoarte-L1). Pentru insigne se adaugă `badgeHref` pe `NavItem` (panou-P6) și surse noi de insignă (anunturi-P7, flota-P8).

- **Acoperă:** panou-L1, L4–L8, O1, O2; angajati-L20; flota-L17; ssm-L9, L10, L11; ticketing-L8, L10, L11; reges-L1, L15; evaluari-L8, L9; cursuri-L12, O3; mentenanta-L12; rapoarte-L1; organigrama-L5; inventar-L13, L14; anunturi-L6, L7, O3; notificari-L11; setari-L10; concedii-L9, L17; portal-L6, L7.
- **Fișiere:** `src/components/ui/indicator.tsx`, `src/app/(app)/panou/page.tsx`, `src/app/(app)/panou/coada.ts`, `src/lib/queries/panou.ts`, `src/config/navigation.ts`, `src/lib/navigation/build-navigation.ts`, `src/components/layout/sidebar-nav.tsx`.
- **Efort:** mic pe filtrele existente; mediu pe cele noi (`contract=expira`, `conformitate`, `scadenta`, `stare=deschise`).

### 2.7 După acțiune: mesaj care rămâne și rând evidențiat
**Ce face.**
- **(a) Toastul cu acțiune nu se mai stinge.** `RandToast` nu pornește cronometrul când toastul are `actiune` (concedii-P3 corectat; azi toastul dispare după 6 s, cum notează cursuri-P7).
- **(b) Rezultatul acțiunii are drum.** `FormularDialog.laReusita` primește deja rezultatul acțiunii, așa că pe el se face fie `router.push` la obiect, fie `?nou=<id>`, citit pe server și transformat în clasă de evidențiere. Singur, `:target` nu evidențiază după navigarea din client (puncte-lucru-P1 corectat; la organigrama-P5 s-a ales `tabIndex={-1}`).
- **(c) Ancore uniforme:** `#angajat-`, `#evaluare-`, `#pas-`, `#saptamana-`, `#dosar-`, `#sablon-`, `#punct-`, `#obiect-`, `#coada-mesaje`.

- **Acoperă:** angajati-L16, L17, L23; anunturi-L4; concedii-L3, L4, L16, O4; cursuri-L7; departamente-L8, O2; evaluari-L10; flota-L12; inventar-L8; mentenanta-L15; onboarding-L10, L11; organigrama-L7, L8; pontaj-L5, L14, L25; puncte-lucru-L6, L7; reges-L9, L13; registru-L6; salarizare-L9, L18, L19; ssm-L14, L15; ticketing-L12; portal-L5, L13.
- **Fișiere:** `src/components/ui/toast.tsx`, `src/components/ui/formular-dialog.tsx` și casetele de creare din fiecare modul.
- **Efort:** mic.

### 2.8 Decizia stă pe fișa obiectului
**Ce face.** Componentele de decizie existente se afișează și pe pagina de detaliu, după precedentul `DecizieAprobare` de pe `/concedii/[id]`:
- `DecizieDeplasare` (diurna-P3);
- `DecizieFoaie` (flota-O1);
- `ButonTransmite` / `ButonAnuleazaMesaj` (reges-P5).

Condiții: starea obiectului, permisiunea `approve`, obiectul nu e fișa proprie și e în echipă. Fără această primitivă, saltul direct din coadă (panou-P7) și notificarea spre detaliu (corecția la notificari-P5) duc pe o fișă fără butoane.

- **Acoperă:** diurna-L6; flota-O1; reges-L8; panou-L9; ticketing-L12 (drumul după decizie).
- **Efort:** mic.

### 2.9 Firimituri cu entitate, conștiente de permisiuni
**Ce face.**
- **(a)** Layout-ul calculează `hrefuriPermise`, evaluând `esteVizibil` pe fiecare intrare de meniu, și le dă lui `<Breadcrumb>` (flota-P9 corectat).
- **(b)** `PREFIXE_FARA_DETALIU` transformă segmentul UUID fără pagină în text (puncte-lucru-P3).
- **(c)** Rutele-filă intră în lista explicită `RUTE_CU_PAGINA`: `/flota/foi`, `/onboarding/sabloane`, rutele SSM.
- **(d)** Paginile de detaliu pasează `firimituri` din `AntetPagina`, cu numele entității și cu părintele ales după proveniență (concedii-P9, ticketing-P2).

- **Acoperă:** angajati-L15; anunturi-L3; concedii-L11; evaluari-L4, O6; flota-L16, O5; onboarding-L16; puncte-lucru-L3; salarizare-L7; setari-L15; ssm-L16, L17; ticketing-L3; portal-L8, L15.
- **Fișiere:** `src/components/layout/breadcrumb.tsx`, `src/components/layout/topbar.tsx`, `src/app/(app)/layout.tsx`, `src/components/ui/antet-pagina.tsx`.
- **Efort:** mic.

### 2.10 Traducerea legăturilor din notificări, în ambele învelișuri
**Ce face.**
- `caleaInAplicatie(link, entityType, entityId, {features, permisiuni})`, oglinda lui `caleaDePortal`, aplicată la randare. Acoperă și rândurile deja scrise, fără migrare.
- `listeazaNotificarile` selectează și `entity_type`, `entity_id`.
- `caleaDePortal` primește reguli noi (`/onboarding/<uuid>`, `/diurna/<uuid>`) cu context de proprietate și păstrează `?saptamana=`.
- Push-ul alege învelișul după rolul destinatarului.

- **Acoperă:** notificari-L1–L5, L7, O1, O6; pontaj-L21, L22, O4, O7; portal-L1, L3; onboarding-O1; concedii-L13; anunturi-O4; reges-L2.
- **Fișiere:** `src/lib/queries/notifications.ts`, `src/app/(app)/notificari/legaturi.ts` (nou), `src/app/(portal)/portal/notificarile-mele/legaturi.ts`, `src/app/(portal)/portal/notificarile-mele/context.ts`, `src/lib/push/mesaj.ts`, `src/lib/push/coada.ts`.
- **Efort:** mediu.

### 2.11 Benzi de file conștiente de module și permisiuni
**Ce face.** Fiecare `NavX` primește booleeni calculați pe server, după modelul `src/app/(app)/pontaj/file-pontaj.ts`. Banda se ascunde când rămâne o singură filă.

- **Acoperă:** flota-L14; evaluari-L12, O2, O5, O7; mentenanta-O6; pontaj-O8; setari-L15; ticketing-L1, L2.
- **Fișiere:** `src/app/(app)/flota/nav-flota.tsx`, `src/app/(app)/evaluari/_components/file-evaluari.tsx`, `src/app/(app)/mentenanta/nav-mentenanta.tsx`, `src/app/(app)/pontaj/setari/nav-setari.tsx`, plus `NavTicketing` și `NavSetari`, ambele noi, construite pe `src/components/ui/file.tsx`.
- **Efort:** mic.

### 2.12 (Opțional) Previzualizare în popover
**Ce face.** Un popover pentru angajat sau pentru o notificare, construit peste 2.2. Datele îl cer explicit în câteva locuri: reges-O3 („Verifică fișa” înainte de transmitere), onboarding-O3, notificari-P7 (clopoțelul) și ssm-P12 (celula matricei de instruiri). Nu înlocuiește linkul. Foaia de stil a browserului pune `inset:0` și `fit-content` pe `[popover]`, deci acestea se suprascriu explicit.

- **Acoperă:** notificari-L10; ssm-L19; reges-O3.
- **Efort:** mediu.

---

## 3. Lista pe module

În fiecare tabel, coloana „Prio” e prioritatea: 1 e cea mai mare, iar „1 (defect)” marchează o legătură existentă care duce în refuz sau în 404.

### 3.1 angajati
Pagina din vault `angajati.md` e scrisă la 2026-08-30 și nu descrie secțiunile mai noi ale fișei.

| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție (rol / modul) | Efort |
|---|---|---|---|---|---|
| 1 (defect) | angajati-O5, O6, O7, O8, O9 | `/angajati/[id]`, `/angajati/[id]/documente` | „Vezi în registru” doar cu drept (O5); „Permisiuni” ascuns pe fișa proprie (O6); „Evaluare nouă” ascuns pe fișa proprie la scope team (O7); secțiunea Evaluări doar cu modulul (O8); Scutiri și Sporuri doar cu modulul (O9) | `can(registru:read, all)`; `poateAcordaPermisiuni && !esteFisaProprie`; `!(esteFisaProprie && scope=team)`; evaluations activ; payroll activ | mic |
| 1 | angajati-P1 (L1, L2, L8) | `/angajati/[id]` | Rail „Legături”: pontaj → `/pontaj/saptamana?angajat=<id>` (pentru manager `/pontaj?cauta=<nume ≤60>`); cereri → `/concedii/echipa?employee_id=<id>` (fișa proprie → `/concedii`); integrare → `/onboarding?angajat=<id>` | `can(attendance:create, all)` sau `can(attendance:read, team)`; `can(leave:read, team)`; `can(checklists:read, team)`; fiecare cu modulul activ | mic |
| 1 | angajati-P3 + P4 (L3, L12, L13, L14) | `/angajati`, `/angajati/[id]` | Departament → `/angajati?department_id=`; funcție → `/angajati?functie=`; „Manager direct” → `/angajati/<id>`; „Editați regulile” doar pentru cine poate; „Vezi cererile” → `/concedii/echipa?employee_id=` | `can(leave:update, all)`; `can(leave:read, team)` + leave activ; link `relative` în celulă | mic |
| 1 | angajati-P2 (L4, L5, L6, L7, L9, L10) | `/angajati/[id]` | Carduri „În alte module”: bunuri → `/inventar/[item]`, cursuri → `/cursuri/[id]`, deplasări → `/diurna/[id]`, SSM → `/ssm/instruiri?q=<nume>`, echipamente → `/mentenanta/echipamente/[id]`, ultimul fluturaș → `/salarizare/<period>/<entry>` | inventory:read team; courses:read team; per_diem:read team (hr nu); ssm:read team; maintenance:read team (hr nu); payroll:read all; fiecare cu modulul; `inPrimireaMea` primește mereu `angajat.id` | mediu |
| 2 | angajati-P5 + P6 + P7 (L16, L17, L18) | `/angajati/nou`, `/angajati/import`, `/angajati/[id]` | Confirmarea înrolării: checklist → `/onboarding?angajat=`, sold → `/concedii/sold`, avertismentele primesc `href`; după import „Vezi lista de angajați” → `/angajati`; Contracte → `/reges`; Callout salariu → `/salarizare` | booleeni calculați pe server: onboarding + checklists:read/create; leave + leave:read own; reges + reges:read all; payroll + payroll:read all | mic |
| 2 | angajati-P8 + P9 (L11, L20) | `/angajati`, `/panou`, `/angajati/[id]` | Filtru nou `?contract=expira`, pe același predicat ca în panou (cartela panoului duce aici); secțiune „Permis de muncă” | employees:read all; cifra numără `DISTINCT employee_id` | mediu |
| 2 | angajati-O1, O2, O3, O4 | `/angajati/[id]`, `/angajati` | Contract → `/documente/<id>?format=pdf` (se citește `contract_id`); fișa de cumul → fișa principală; vehiculul în folosință → `/flota/[id]`; punctul de lucru al contractului → `/puncte-lucru#punct-<id>` | O3: fleet activ + `can(vehicles:read)`; O4: departments:read ≠ null/none | mic–mediu |
| 3 | angajati-P10, P11, P12, P14 (L15, L19, L21, L23) | `/angajati/[id]`, `/angajati/sabloane-documente(/nou)` | Firimituri cu numele angajatului; Evaluări → `/evaluari`, `/evaluari/kpi`; „Creați unul” doar pentru cine poate; „profilul firmei” doar pentru cine poate; după un șablon nou → `/angajati` | evaluations / kpi activ; `evaluations:update all`; `organizations:update all` | mic |

### 3.2 anunturi
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | anunturi-P1 (L1) | `/anunturi/[id]` | Numele cititorului → `/angajati/[employee_id]` | `can(employees:read, all)` && angajat ≠ null && neșters (se adaugă `deleted_at` în embed) | mic |
| 1 | anunturi-P2 (L3) | `/portal/anunturi/[id]` | `AntetPagina` cu firimitura „Anunțuri” → `/portal/anunturi` | — | mic |
| 1 (defect) | anunturi-O1, O4, O5 | `/anunturi/[id]`, `/portal/anunturi/[id]`, `/anunturi` | `not-found.tsx` propriu în ambele învelișuri („Anunțul a expirat”, cu link spre avizier); butonul „Anunț nou” pe poarta acțiunii | `can(announcements:create, all)` | mic |
| 2 | anunturi-P4 (L4) | `/portal` | Sarcina „Un anunț necitit” → `/portal/anunturi/<id>` când e unul singur | — | mic |
| 2 | anunturi-P3 (L2) | `/anunturi/[id]` | Secțiunea „Neconfirmat încă”, cu nume → fișa; „din Y” devine ancoră | `poateAdministra && can(employees:read, all)`; doar angajați activi și neșterși | mediu |
| 3 | anunturi-P7 + O3 (L7) | meniu, `/anunturi` | Insigna `announcements_unread` și segmentul `?stare=necitite` (ținta insignei și a numărului din descriere) | announcements activ + `announcements:read own`; null fără fișă proprie | mediu |
| 3 | anunturi-P5 + O2 (L5) | `/anunturi/[id]` | Ciornă: „Editează”, „Șterge ciorna” (→ `/anunturi?stare=ciorne`); anunț publicat: „Retrage”, „Desfixează”, „Editează” | `poateAdministra`; `announcements:update all`; `.select()` după UPDATE, iar un rezultat gol înseamnă conflict | mediu |
| 3 | anunturi-P6 (L6) | `/anunturi` | „Citit de X din Y” pe card; cardul → `/anunturi/[id]#cititori` | `poateAdministra`; citire prin `citesteTot` | mediu |

### 3.3 concedii
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | concedii-P1 (L1) | `/concedii/echipa` | Coloana îngustă „Fișa” → `/angajati/[id]` (fallback `/concedii/echipa?employee_id=`) | `can(employees:read, team)` && angajat în `hartaAngajati` și neșters; `peTelefon: "actiuni"` | mic |
| 1 | concedii-P2 + O1 + O2 (L2) | `/concedii/[id]` | Rail: fișa angajatului, alte cereri, sold, „cine mai lipsește”, pontajul lunii, REGES; aprobatorul fiecărei trepte și decidentul sunt numiți și legați | angajat ≠ null + employees:read team; leave:read team (fișa proprie → `/concedii?vedere=cereri`); attendance activ; reges activ + reges:read all; soldul fără ancoră până la P8 | mediu |
| 1 | concedii-P3 + O4 (L3) | `/concedii/aprobari`, `/concedii/[id]`, caseta „Cerere nouă” | Avertismentele de după decizie ca toasturi cu acțiune care nu se sting: „Deschide REGES” → `/reges`; „Vezi pontajul” → `/pontaj?vizualizare=luna&an=&luna=` | booleenii `poateVedeaReges` / `poateVedeaPontaj` vin de pe server, implicit false; niciodată în portal | mic |
| 1 | concedii-P4 + O3 (L4) | caseta „Cerere nouă” | După o cerere pentru alt angajat: „Deschide cererea” → `/concedii/<id>`; mesajul de suprapunere leagă cererea existentă (`cereriCareOcupaZile` selectează și `id`) | `poateAlegeAngajat && can(leave:read, all)` | mic |
| 2 | concedii-P5 + P7 (L5, L6, L9) | `/concedii/aprobari`, calendar, sold, setări | Titlul cardului → `/concedii/<id>`; pictogramă spre fișă; „Cine mai lipsește atunci” → planificator; contorul „Aprobări” pe toate filele | pictograma: angajat ≠ null + employees:read team; calendarul: `poateVedeaCalendar` | mic |
| 2 | concedii-P6 + P14 (L7, L8, L17) | `/concedii/calendar` | Pastila → `/concedii/<cerereId>` (`leave_request_id` se citește din nou); numele rândului → `/concedii/echipa?employee_id=`; ziua și „+N altele” → `/concedii/echipa?de_la=&pana_la=&status=trimisa,in_aprobare,aprobata` | rândul propriu → `/concedii?vedere=cereri`; fișa: employees:read team | mediu |
| 2 | concedii-P8 + P9 + P10 (L10, L11, L12) | sold, `/concedii/[id]`, calendar, echipa | Ancore `#angajat-<id>`; numele → cererile; consum/restituire → `/concedii/<leave_request_id>`; firimitura după proveniență; „Cerere nouă” pe calendar și pe Echipa (`?cerere=noua&pentru=<id>`) | precompletarea doar cu `leave:create all` și id-ul în `date.angajati` | mic |
| 2–3 | concedii-P11, P13 (L13, L15, L16) | notificări, `/concedii/setari` | Notificarea aprobatorului → `/concedii/<id>` (migrare nouă sau, fără migrare, notificari-P1); în setări: angajat → fișa, departament → `/departamente`, după „Aplică” → `/concedii/sold?an=` | migrarea e forward-only, iar aplicarea pe producție cere confirmare; `employees:read all`; `departments:read` ≠ none | mediu |

Trimiteri: concedii-P12 și O5 sunt tratate la angajati-P4; concedii-P15 la salarizare-P2.

### 3.4 cursuri
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | cursuri-P1 (L1) | `/cursuri/[id]/stadiu` | „Persoană” → `/angajati/[employee_id]`; `href` pe tot rândul doar după 2.3 | link în celulă când `nume.has(id)`; pe rând doar dacă scope employees:read acoperă scope courses:read | mic |
| 1 | cursuri-P2 (L2) | `/cursuri/conformitate` | Antetul de curs → stadiu; numele → fișa; celula → `stadiu?angajat=`; „Neatribuit” → atribuire | fișa: employees:read team; atribuirea: `courses:create team` | mic |
| 1 | cursuri-P3 (L3) | `/angajati/[id]` | Secțiunea „Cursuri” (`cursurileMele` + anulări cu motiv) → `/cursuri/<id>/stadiu?angajat=<id>` | courses activ + courses:read team; fără linkuri spre `/portal`; fără listă goală falsă | mediu |
| 1 | cursuri-P4 (L4) | `/cursuri/[id]` | Titlul lecției și al materialului → `/cursuri/biblioteca/<id>`; insigna „Fără conținut” → același link | eticheta „Încărcați conținut” doar cu `poateEdita` + courses:create team | mic |
| 1 (defect) | cursuri-O4, O5, O6 | stadiu, conformitate, atribuire | „Atribuie cursul” din starea goală doar pentru cine poate atribui; „Deschideți lista de angajați” doar cu drept de citire; textul despre adăugare doar cu drept de creare | `courses:create team`; `scopeFor(employees:read)` ≠ null/none; `employees:create all` | mic |
| 2 | cursuri-P8 + O2 + O3 (L8) | `/cursuri/[id]/stadiu` | „Atribuie” în antet; `BaraFiltre` cu filtrele active; Paginare; „Atribuit automat” → `/cursuri/[id]/reguli`; indicatorii calculați din `total` | `courses:create team && publicat` | mic |
| 2 | cursuri-P6 + P7 + O1 (L6, L7) | reguli, atribuire | Ținta regulii: departament → `/angajati?department_id=`, persoană → fișa; după „Aplică acum” → „Vedeți stadiul”; „Are deja cursul” → `stadiu?angajat=` (în afara label-ului) | employees:read team; doar nume rezolvate | mic |
| 2–3 | cursuri-P5, P11, P10, P12, P13 (L5, L10, L11, L12, L13) | `biblioteca/[id]`, `[id]`, stadiu, `biblioteca/nou`, conformitate | „Folosit în” pe material; „Folosit în integrare” pe curs; „Adeverință” pe înrolările finalizate (verificată întâi empiric); pasul 5 → `/cursuri/nou`; `?arata=probleme` (se decide cu proprietarul) | onboarding activ + checklists:read own pentru șabloane | mic–mediu |

### 3.5 departamente
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | departamente-P1 (L1) | `/departamente` | Panou adresabil: `?departament=<id>` sau `nerepartizati`; starea derivată din `useSearchParams`, scrisă cu `history.replaceState` | un id necunoscut lasă panoul închis | mediu |
| 1 | departamente-P2 + P3 (L2, L3) | `/departamente` | Denumirea și stiva de avatare deschid panoul; managerul numit în capul panoului → `/angajati/<id>`; insignă „Manager” | link doar când embed-ul manager ≠ null (trei stări) | mic |
| 2 (defect) | departamente-P5 + P6 (L5, L6) | listă, panou | „rol de Angajat” → `/angajati/<id>/permisiuni`; „Invită un cofondator” doar pentru cine poate | roles:update all + users:update all + employees:read all; `users:update all` | mic |
| 2 | departamente-P4 (L4) | panou | Rail: `/angajati?department_id=`; `/pontaj?departament=`; `/pontaj/aprobare?departament=`; `/ticketing/coada?department_id=` | attendance activ + read all / approve team; ticketing activ + tickets:read team (în practică doar org_admin) | mediu |
| 2 | departamente-P10 + P8 (L8, L11) | `/angajati`, `/angajati/[id]`, caseta „Departament nou” | „Departament” → `/departamente?departament=<id>`; după creare se deschide panoul noului departament | departments:read ≠ null/none; depinde de P1 | mic |
| 2 | departamente-P7 + O3 (L7) | acțiunile cardului | Refuzul dezactivării → „Vezi persoanele departamentului”; `numarAngajati` = toate fișele neșterse; nerepartizații fără încetați și fără arhivați, cu insigna tradusă | — | mic |
| 3 | departamente-P9 + O1 + O2 (L10) | panou | „Ierarhia managerială” → `/organigrama`; subdepartamentele și departamentul părinte în panou; după „Mută N persoane” → „Deschide <țintă>” | employees:read all | mic |

### 3.6 diurna
Capcana #16 din vault (managerul nu poate aproba) e reparată de `0155`.

| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | diurna-P3 + O5 (L6) | `/diurna/[id]` | `DecizieDeplasare` pe fișă, plus „Înapoi la De aprobat” | `poateAproba && in_aprobare && employee_id ≠ fișa proprie && în echipă`; înainte, proba de scriere pe autoaprobarea managerului (O5) | mic |
| 1 | diurna-P1 + P2 (L1, L2, L7) | `/diurna`, `/diurna/[id]`, `/diurna/aprobari` | Numele angajatului → `/angajati/[id]`; „Alte deplasări” → `/diurna?angajat=` | per rând: `angajatiDupaId` a întors fișa și e neșters | mic |
| 1 | diurna-P4 (L4) | `/diurna` | Filtrul `?angajat=` (prin `cheiExterne`, `areFiltre`, `faraFiltre`) | — | mic |
| 1 | diurna-P5 (L3) | `/angajati/[id]` | Secțiunea „Deplasări”: ultimele 3 → `/diurna/[id]`; „Toate”; „Deplasare nouă pentru el” | per_diem activ + `can(per_diem:read, scope employees:read)` (hr nu o vede); „nouă” doar cu per_diem:create all, angajat activ și politică existentă | mediu |
| 2 | diurna-P8 + O2 + O3 (L9) | `diurna/actions.ts`, portal | Notificări la trimitere (aprobatori) și la decizie (proprietar), cu link `/diurna/<id>` tradus în portal; fișa din portal arată starea și motivul cheltuielilor | link null pentru destinatarul fără per_diem:read; context de proprietate în portal | mediu |
| 2 | diurna-P6 + P7 (L5, L8) | `/diurna/noua`, `/diurna/aprobari` | `?angajat=` preselectează angajatul; „Decontul” pe cardurile aprobate | per_diem:create all, id-ul în listă | mic |
| 3 | diurna-P9 + P10 + O1 + O4 (L10, L11, L12) | `/diurna/[id]`, noua, politica, `/diurna` | Politica aplicată → `/diurna/politica` (pe fișă, în previzualizare și pe rândurile „fără politică valabilă”); pontajul perioadei; după salvarea politicii → `/diurna/noua` | pontajul: attendance activ și aria attendance:read ≥ aria per_diem:read; în previzualizare boolean primit din (app); `per_diem:create own` | mic |
| 3 | diurna-P11 + P12 (L13, L14) | portal, `/salarizare/[id]/[entryId]` | Decontul în portal (rută nouă `/portal/diurna-mea/[id]/decont`); diurna din fluturaș → `/diurna?angajat=` | per_diem activ + per_diem:read all (în practică org_admin) | mediu |

### 3.7 evaluari
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | evaluari-P1 (L1, L2) | `/evaluari/kpi` | „Seturi de indicatori” → `/evaluari/kpi/seturi`, în antet, ca `actiune` în `StareGoala` și în dialogul „Deschide luna” | — | mic |
| 1 | evaluari-P2 + P3 (L3, L4, L5) | `/evaluari/kpi/[id]`, `/evaluari/kpi` | Titlul → fișa; „Toate lunile lui” → `/evaluari/kpi?angajat=`; „Evaluările anuale” → `#titlu-evaluari`; firimitura cu an și lună; filtrul `?angajat=` (+ status) | angajat ≠ null; evaluations activ pentru legătura anuală | mic |
| 1 | evaluari-P4 + P5 + P6 (L6, L7, L8, L9) | `/evaluari`, `/evaluari/sabloane` | „Vezi” pe evaluarea finalizată → `/angajati/<id>#evaluare-<id>` (ancoră nouă); coloana Șablon și „folosit în N” → `?template_id=`; „Evaluări finalizate” → `?status=finalizat&de_la=&pana_la=` | — | mic |
| 1 (defect) | evaluari-P9 + O1 + O2 + O5 + O6 (L12) | file, meniu, asistent, firimitura | `FileEvaluari` primește modulele active; intrare de meniu `/evaluari/kpi` cu `featureKey: "kpi"`; destinațiile KPI din asistent pe `kpi`; firimitura „Evaluări” condiționată | evaluations / kpi activ | mic |
| 1 (defect) | evaluari-O7 + O8 + O9 | ale-mele, `/evaluari`, `/angajati/[id]` | Filele de pe „Ale mele” doar pentru cine are drept; „Creează un șablon” doar pentru cine poate; secțiunea Evaluări de pe fișă cu modul și permisiune | `evaluations:read team`; `evaluations:update all` | mic |
| 2 | evaluari-P7 + P8 + O3 (L2, L10, L11) | planificare, „Deschide luna”, seturi | După programare → `/evaluari?status=draft`; angajații fără funcție → `/angajati/<id>#titlu-incadrare`; refuzul „luna e deja deschisă” → luna existentă; funcția → `/angajati?functie=`, abia după un filtru normalizat | — | mic |
| 2 | evaluari-P10 + P11 (L13, L14, L17) | `/angajati/[id]`, `/evaluari/ale-mele` | Secțiunea „KPI lunar” pe fișă → `/evaluari/kpi/<id>`; ajustarea țintei; „KPI-ul meu” pe Ale mele (read-only pe luna proprie) | kpi activ + `evaluations:read team`; ajustarea doar pentru managerul direct (`evaluations:update team`) | mediu |
| 3 | evaluari-P12 + P13 (L15, L16) | `/angajati/[id]`, acțiuni | „Redeschide” pe evaluarea finalizată; notificări la programare și la închiderea lunii KPI, cu link la luna anume | `evaluations:update all`; destinatarul doar cu evaluations:read efectiv | mediu |

Trimitere: evaluari-O4 e tratată la portal-P16.

### 3.8 flota
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 (defect) | flota-P3 + O5 + P9 (L5, L14, L16) | NavFlota, `foi/[id]`, aprobari, firimituri | Fila „Vehicule” doar pentru cine are drept; „Vezi anomaliile” doar pe anomaliile neconfirmate (→ `/flota/anomalii?vehicul=`); „Parc auto” și numărul de înmatriculare din firimituri legate doar cu drept; breadcrumb global cu `hrefuriPermise` | `vehicles:read own`; `confirmat_la === null` | mic |
| 1 | flota-P1 + O4 (L2, L4, L6, L9) | `[id]`, foi, `foi/[id]`, aprobari, anomalii | Șoferul → `/angajati/[id]`; coloana „Șofer” în anomalii | `employees:read team` && angajat în map && neșters | mic |
| 1 | flota-P2 + O2 (L1, L3, L7) | foi, `foi/[id]`, anomalii, aprobari | Numărul de înmatriculare → `/flota/[vehicle_id]`; pe aprobari, un al doilea link „fișa vehiculului” | `vehicles:read own` && vehicul în map | mic |
| 1 | flota-O1 + P8 (L15) | `/flota/foi/[id]`, meniu | `DecizieFoaie` pe foaia „trimis”; intrare de meniu „Foi de parcurs” pentru manager, ascunsă cui vede „Parc auto”, cu insignă | `trip_sheets:approve team`; meniul pe `trip_sheets:read team` | mic |
| 2 | flota-P4 (L12) | `/flota/foi` | După „Salvează ciorna” un singur toast cu „Deschide foaia” | — | mic |
| 2 | flota-P5 + O3 (L10, L11, L13) | `/flota/[id]`, `/flota/foi?vehicul=` | Rail: foi, de aprobat, „Foaie nouă pe acest vehicul” (`?vehicul=&foaie=noua`), anomalii; Departament → `/angajati?department_id=`; starea goală filtrată oferă „Înapoi la vehicul” | foaia nouă: trip_sheets:create + read own și vehicul activ; anomaliile: vehicles:update team | mediu |
| 2 | flota-P6 + P7 (L17, L18) | `/panou`, `/flota`, `/angajati/[id]` | `?conformitate=lipsa` / `expira`, ținta cartelelor de pe panou; secțiunea „Parc auto” pe fișa angajatului (vehicul → `/flota/[id]`, foi → `/flota/foi?sofer=`) | fleet activ; vehicles:read own; trip_sheets:read team | mediu |
| 3 | flota-P10 + P11 + O6 + O7 (L8, L19) | anomalii, `/flota`, caseta „Foaie nouă” | Rândul anomaliei → foaia sau vehiculul; coloana „Șofer” în parc; „Adăugați întâi un vehicul” și „Deschide foaia” condiționate | `trip_sheets:read all` pentru foaie; `poateVedeaParcul` | mic |

### 3.9 inventar
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | inventar-P1 (L1) | `/angajati/[id]` | „Bunuri în primire” → `/inventar/[item]`; „Vezi în inventar” → `/inventar?angajat=` | inventory activ + `inventory:read team` | mic |
| 1 (defect) | inventar-P2 + O4 (L2) | `/onboarding/[id]` | Fiecare bun nereturnat → `/inventar/<item.id>`; linkul generic „Inventar” primește aceeași condiție | inventory activ + `inventory:read team` | mic |
| 1 | inventar-P3 (L3) | `/inventar` | „Deținut de” → `/angajati/<id>` | per rând: angajat rezolvat și neșters | mic |
| 1 | inventar-P4 + O1 (L4, L5, L12) | `/inventar/[id]` | „La {nume}” → fișa; „Alte obiecte la el” → `/inventar?angajat=`; cronologia leagă persoana și propriul PV (`alocareId`); primitorul din PV → link în bara `print:hidden` | `detinatorId` în tipul `Custodie`; neșters | mic |
| 2 | inventar-P5 (L6) | `/inventar` | Filtrul `?angajat=` (prin `cheiExterne`, `areFiltre`, `in` în `filtreaza`) | — | mediu |
| 2 | inventar-P6 + O3 (L7) | `/ticketing/[id]`, `/portal/tichetele-mele/[id]` | Obiectul stricat → `/inventar/<id>`; în portal → `/portal/in-primirea-mea#obiect-<id>` | inventory activ + `inventory:read team`; `Rand` lărgit la `ReactNode` | mic |
| 2 | inventar-P8 + P9 (L9, L10) | `/inventar/in-primire`, `/portal/in-primirea-mea` | „Proces-verbal”; „Raportează o defecțiune” → `/ticketing/nou?tip=defectiune&obiect=` (în portal `/portal/tichetele-mele/nou?…`) | ticketing activ + `tickets:create own` | mic–mediu |
| 3 | inventar-P7, P10, P11, O2, O5 (L8, L11, L13, L14) | `[id]`, portal, `/angajati/nou`, registru | PV după returnare (și după predare); categoria de pe fișă → `?category_id=`; „Predări” → `#titlu-cronologie`; sarcina „N obiecte așteaptă confirmarea” în portal; ecranul de reușită al înrolării listează bunurile și PV-ul; poarta de modul în `registru/legaturi.ts` (cod lucrat de altă sesiune) | inventory activ + `inventory:read own` | mic |

### 3.10 mentenanta
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | mentenanta-P1 + P2 (L1, L2, L14) | `/mentenanta`, `/mentenanta/planuri/[id]` | Planul scadent → `/mentenanta/planuri/<id>`; echipamentul (sub nume și în antetul planului) → fișa lui; callout-ul de contor → `#contoare` și `/mentenanta/contoare` | — | mic |
| 1 | mentenanta-P3 + P9 + P4 (L7, L10, L15) | fișa echipamentului, sesizarea închisă, `/mentenanta/planuri` | „Sesizare nouă” pe utilaj (`?sesizare=noua&echipament=`); „Raportează din nou” (în aplicație și în portal); planul nou → fișa lui | `maintenance:create own`; utilaj necasat; echipament ≠ null | mic |
| 1 | mentenanta-O2 + O3 + O1 | sesizari, `sesizari/[id]`, panou | Titlul sesizării și „Toate intervențiile” pe permisiunea de citire, nu pe cea de actualizare; din listă și din panou un drum spre utilaj; cronologia arată echipamentul și duplicatul ca nume legate, nu ca UUID | `maintenance:read team` | mic |
| 1 (defect) | mentenanta-O4 + O5 + O6 + O7 | caseta „Sesizare nouă”, fișa echipamentului, NavMentenanta, butoane | „Sesizarea existentă” și „Deschideți sesizarea” doar dacă sesizarea e vizibilă sub RLS; filele doar cu citire pe echipă; „Sesizare nouă” doar pentru cine poate raporta | `fault_report_id` în `sesizariEchipament`; `read team`; `maintenance:create` | mic |
| 2 | mentenanta-P5 (L3, L4, L5) | panou, `echipamente/[id]`, planuri, sesizari | `NumeAngajat` → fișa sau filtrul din modul (`?responsabil=`, `?atribuit=`) | zona app && `employees:read all` (sau team cu nume rezolvat) && neșters | mediu |
| 2 | mentenanta-P6 + P7 + P8 (L8, L9, L12) | `echipamente/[id]`, `/mentenanta`, interventii | „Vezi toate” filtrate pe utilaj; titlurile și totalurile din panou legate (`?deschise=da`, `?iscir=da`, `#iscir`, `#contoare`); coloanele „Plan” și „Executant” | planul neșters | mic |
| 2 | mentenanta-P10 + P11 (L6, L18) | echipamente, `/angajati/[id]`, `/puncte-lucru` | Punctul de lucru vizibil pentru orice cititor → `?punct_lucru=`; legături din fișa angajatului (echipamente, planuri, sesizări atribuite) și de pe punctele de lucru | maintenance activ + `maintenance:read team` (hr nu); pentru manager fără link spre `/puncte-lucru` | mediu |
| 3 | mentenanta-P12–P16 (L11, L13, L16, L17, L19) | `sesizari/[id]`, contoare, tabel, „Sesizările mele”, ISCIR | Duplicatul se alege din listă; echipamentul din Contoare → `#contoare`; `[&_a]:relative` în `CardRand`; cardurile „Sesizările mele” devin clicabile (pentru un rol cu suprascriere); tipul de autorizație → `/ssm/autorizatii` | ssm activ + `ssm:read team` | mic |

### 3.11 notificari
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | notificari-P1 (L1, L4) | `/notificari` | `caleaInAplicatie`: „Cerere de concediu de aprobat” → `/concedii/<entity_id>`; săptămâna de aprobat → `/pontaj/aprobare#saptamana-<id>` (cu `id` pe `<li>`) | leave activ + `leave:read own`; attendance activ + `attendance:approve team`; restul prin harta prefix → modul | mic |
| 1 | notificari-P2 (L2, L3) | `/notificari` | `/portal/pontajul-meu*` → `/pontaj?vizualizare=saptamana&saptamana=<luni>`; orice alt `/portal/*` → null (rândul doar se marchează citit) | attendance activ + `attendance:read own` | mic |
| 1 | notificari-O6 | push | Push-ul alege învelișul după rolul destinatarului, cu aceeași traducere ca ecranul | — | mediu |
| 2 | notificari-P3 + O1 (L5, L9) | migrare nouă | Decizia pe săptămână și mementourile din 0166 primesc `?saptamana=`; „săptămână aprobată fără pontaj” primește luna primei zile lipsă și angajatul; `caleaDePortal` păstrează `?saptamana=` | forward-only; aplicarea pe producție cere confirmarea utilizatorului | mediu |
| 2 | notificari-P5 + P6 (L6, L7) | `diurna/actions.ts`, portal | Deplasările scriu notificări (diurna-P8); `/onboarding/<uuid>` se traduce în portal pentru parcursul propriu (portal-P1) | context de proprietate | mic–mediu |
| 2 | notificari-P4 + O4 (L8) | `src/lib/reges/genereaza-evenimente.ts` | REGES → `/reges?stare=de_transmis`; nicio notificare când modulul e oprit | reges activ + `reges:read all` | mic |
| 2 | notificari-O2 + O5 + O3 + O7 | migrări noi peste 0181, 0046, 0017/0041 | Destinatarii aleși după cine poate deschide ținta: sesizarea (fără link pentru cine n-o vede), bug-ul rezolvat → propriul tichet (`d.id`), aprobatorii cu precedența per membru | forward-only | mediu |
| 3 | notificari-P7 + P8 (L10, L11) | clopoțelul, `/notificari` | Popover cu ultimele necitite, încărcat la deschidere; „N necitite” → `/notificari?necitite=1` | aceleași condiții ca P1 | mediu |

### 3.12 onboarding
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | onboarding-P1 + O3 (L2, L14, L17) | `/onboarding/[id]`, dovada, `/onboarding` | Numele angajatului → fișa; „Toate parcursurile lui” → `/onboarding?angajat=`; în listă, link secundar spre fișă | `angajat !== undefined` && neșters | mic |
| 1 | onboarding-P4 (L1) | `/angajati/[id]` | Secțiunea „Integrare”: ultimele 5 cu progres → `/onboarding/[id]`; „Pornește checklist” → `/onboarding/noua?angajat=` | onboarding activ + `checklists:read team`; pornirea cu `checklists:create all` | mediu |
| 1 (defect) | onboarding-P3 + O5 (L4) | `/onboarding/[id]` | La fel ca inventar-P2 și O4 | inventory activ + `inventory:read team` | mic |
| 1 (defect) | onboarding-O6 + O7 + O8 | `/onboarding/[id]`, wizardul de angajat nou | „Vezi dovada” doar când dovada se citește sub RLS; „Finalizează” și „Anulează” doar pe subordonați; wizardul verifică modulul onboarding | la scope team, `angajat !== undefined` | mic |
| 2 | onboarding-P2 + P5 + O2 (L3, L5) | `/onboarding/[id]` (comun cu portalul) | Responsabilul pasului cu nume → fișa; pasul de tip curs numește cursul → `/cursuri/<id>/stadiu` (în portal `/portal/cursurile-mele`); materialul numit → `/cursuri/biblioteca/<id>` | `href` calculat pe server, null în portal; courses activ + courses:read team/own | mediu |
| 2 | onboarding-P6 + P7 + P8 + P10 (L6, L7, L8, L15) | noua, `sabloane/[id]`, wizardul, încetarea | `/onboarding/noua?sablon=&angajat=` (inclusiv angajat inactiv, pentru ieșire); „Pornește o instanță” pe șablon; șablonul de origine legat; wizard → instanța creată; „Pornește checklistul de ieșire” | `checklists:create all`; `sablon.activ` | mic |
| 2–3 | onboarding-P9 + P11 + P12 (L9, L10, L11) | panou, „Sarcinile mele”, `/onboarding/[id]` | Rând în coada panoului → `/onboarding/sarcinile-mele`; ancora `#pas-<id>`; după finalizare → dovada; butonul spre dovadă doar când dovada există | `checklists:read own`; în portal doar cu context de proprietate | mic |
| 3 | onboarding-P13 + P14 + P15 + O4 (L12, L13, L16) | șabloane, „Sarcinile mele” | Șablonul în citire numește cursul, materialul și responsabilul; `?sablon=` pe lista de instanțe; `/onboarding/sabloane` în `RUTE_CU_PAGINA`; eticheta unificată „Integrare angajați”; subiectul din „Sarcinile mele” (cardul se restructurează) | — | mic–mediu |

Trimitere: onboarding-O1 e tratată la portal-P1.

### 3.13 organigrama
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | organigrama-P1 (L2) | `/organigrama` | „Setează managerul direct” → `/angajati/<id>?din=organigrama#titlu-incadrare`, link frate al cardului | `can(employees:update, all)` | mic |
| 2 | organigrama-P2 (L3) | `/organigrama` | Rădăcinile cu manager nevizibil primesc o notă și același link | scope `all` | mic |
| 2 | organigrama-P3 (L1, L10) | `/organigrama` | Departamentul → `/angajati?department_id=&status=activ`; funcția → `?functie=` (stretched link) | `functie !== null` | mic |
| 2 | organigrama-P4 (L6) | `/organigrama` ↔ `/departamente` | „Structura pe departamente” și „Ierarhia managerială” | `departments:read` ≠ none; `employees:read` ≥ own | mic |
| 2 | organigrama-P5 (L7) | `/organigrama`, `/angajati/[id]` | Ancora `#angajat-<id>` cu evidențiere (`?angajat=`); „Vezi în organigramă” lângă „Manager direct” | angajat activ | mic |
| 3 | organigrama-P6 (L4, L5, L9) | `/organigrama` | „lista de angajați”; „N fișe active” → `?status=activ`; starea goală → `/angajati/nou` | `employees:create all`, altfel `/angajati` | mic |
| 3 | organigrama-P7 (L8) | fișa angajatului | Întoarcere în organigramă prin `?din=organigrama` (enumerare închisă) | — | mediu |
| 3 | organigrama-O1 + O2 | `/organigrama` | Managerul inactiv numit și legat; eticheta derivată din rol → `/angajati/<id>/permisiuni` | scope all; `users:update all` | mic |

### 3.14 panou
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | panou-P1 (L5, L6) | coada | Tichete → `/ticketing/coada?status=in_aprobare`; REGES → `/reges?stare=de_transmis`, cu contorul pe `STATUSURI_NETRANSMISE` | porțile nu se schimbă | mic |
| 1 | panou-P2 (L4) | „Firma azi” | Angajați activi → `/angajati?status=activ`; în concediu azi → `/concedii/calendar` (sau Echipa cu `de_la=pana_la=azi`); departamente → `/departamente` | employees:read team; leave activ + leave:read team; `departments:read all`, altfel `/organigrama` | mic |
| 1 (defect) | panou-P4 + O3 + O4 (L2, L3) | „Pornire” | „Definește” doar pentru cine poate crea departamente; „Vezi modulele” doar pentru administrator (→ `/setari/organizatie#module` după setari-P8); „Datele firmei” → `/setari/organizatie` | `departments:create all`; `organizations:update all` | mic |
| 1 | panou-P3 + P5 (L1, L7) | cartele de expirare | Contracte → `/angajati?contract=expira` (angajati-P8); documente de flotă → `/flota?conformitate=` (flota-P6) | același predicat ca numărătoarea | mediu |
| 2 | panou-P6 + O1 + O2 (L8) | meniul lateral | `badgeHref`: concedii → `/concedii/echipa?status=trimisa,in_aprobare`; pontaj → `/pontaj/aprobare`; reges → `?stare=de_transmis`; flota → `?conformitate=`; vehiculele fără documente aprind insigna | porțile insignelor = porțile țintelor | mic |
| 3 | panou-P7 (L9) | coada | Un singur obiect în coadă → `/concedii/<id>`, `/ticketing/<id>` (diurnă și foi abia după 2.8) | id cu același `.neq` pe fișa proprie | mediu |
| 3 (defect) | panou-O5 | meniu / scurtătură | Intrarea „Salarizare” cu `minScope: "all"` | — | mic |

### 3.15 pontaj
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | pontaj-P1 (L1, L6) | `/pontaj` | Numele din foaie și din avertismente → `/angajati/<id>` | `angajatId !== null` | mic |
| 1 | pontaj-P3 + P11 + O1 (L3, L11) | foaia, săptămâna proprie | Ziua din concediu → `/concedii/<leaveRequestId>`; „Zile speciale” CO/CM → `/concedii/echipa?employee_id=&de_la=&pana_la=` (rândul propriu → `/concedii?de_la=&pana_la=`) | leave activ + `leave:read team` | mic |
| 1 | pontaj-P4 (L4, L5) | panoul de absențe | Numele → fișa; după emitere, mesaj și „Transmiteți-o în REGES” → `/reges?stare=de_transmis` | reges activ + `reges:read all`; doar nume citite | mic |
| 2 | pontaj-P2 + P5 + P6 + O3 (L2, L12, L13, L14) | foaia, `/pontaj/aprobare` | Celula „așteaptă decizia” → `/pontaj/aprobare?an=&luna=&departament=`; în aprobare, „Fișa” și „În foaie” lângă butonul de pliere; săptămâna → `/pontaj/saptamana?angajat=&saptamana=`; după aprobarea în bloc, mesaj cu „Vezi lotul”; antetul leagă perioada și foaia | `poateAproba`; `attendance:create all` pentru săptămâna altcuiva | mic |
| 2 | pontaj-P9 (L19) | `/pontaj`, `/angajati/[id]` | `?angajat=<uuid>` cu pastilă; „Pontajul lunii” pe fișa angajatului | attendance activ + `attendance:read team` | mediu |
| 2 | pontaj-P7 + P8 + O5 (L15, L16, L17, L18) | perioade, `perioade/[id]`, arhiva | „Foaia lunii” pe fiecare lună; rândul din arhivă → foaia; rail pe perioadă (foaia, arhiva, statul de plată); departamentul → foaia filtrată; linkurile spre aprobare doar pentru cine poate aproba | `attendance:export all`; payroll activ + `payroll:read all`; `poateAproba` | mediu |
| 2 | pontaj-P10 + O4 + O7 (L20, L21, L22) | notificări | Migrare nouă (`create or replace` pornind de la 0166, 0118, 0169), cu `legaturi.ts` în același commit; ziua respinsă: cale din aplicație tradusă în portal, sau învelișul ales după rol | forward-only, confirmare pe producție | mediu |
| 3 | pontaj-P12 + P13 + O2 + O6 + O8 (L7–L10, L23, L24, L25) | calendar, CelulaZi, săptămâna, setări | Numele din calendar și din CelulaZi → fișa; „Perioade”, „Angajat nou” și punctul QR devin linkuri; concediul din formularul săptămânii; „Vezi în Prezența”; motivele de blocare din săptămâna proprie; „Salarizare → Setări” doar cu payroll activ; fila „Coduri QR” cu `poateVedeaCoduriQr` | după link (vezi corecțiile) | mic |

### 3.16 profil
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | profil-P1 (L1) | `/profil` | Cardul „Fișa mea de angajat” → `/angajati/<id>` (prin `fisaMea`) | `employees:read own` && stare ok; `getPermissionMap` cu `memberId`; `profil.md` se actualizează | mic |
| 2 | profil-P2 (L2) | `/profil` | „Ce ține de mine”: `/concedii?vedere=cereri`, `/pontaj?vizualizare=saptamana`, `/evaluari/ale-mele`, `/onboarding/sarcinile-mele`, `/inventar/in-primire` | fiecare cu modulul și permisiunea `own`; doar cu fișă proprie | mediu |
| 2 | profil-O1 | `/profil` | „Tichetele mele” → `/ticketing` | ticketing activ + `tickets:read own` | mic |

### 3.17 puncte-lucru
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | puncte-lucru-P1 (L1, L8) | `/puncte-lucru` | Ancora `#punct-<id>`, evidențiată pe server (`?punct=<id>#punct-<id>`) | — | mic |
| 1 (defect) | puncte-lucru-P3 (L3) | firimitura afișului | Segmentul UUID devine text (fără link spre o pagină inexistentă); eticheta „Afiș de pontare” | — | mic |
| 1 | puncte-lucru-P4 (L4) | `/puncte-lucru/[id]/afis` | Butoane în callout-urile „cod lipsă” și „inactiv”; „← Puncte de lucru” vizibil și pe telefon; link spre Coduri QR | attendance activ pentru Coduri QR | mic |
| 2 | puncte-lucru-P2 (L2, L5) | `/puncte-lucru` | Rail pe card: „Echipamente aici (N)” → `/mentenanta/echipamente?punct_lucru=`; „Cod QR în pontaj”; „Angajați cu contract aici (N)” | maintenance activ + read team; attendance activ + `poateEdita`; `employees:read all`; numărătoare per punct, fără trunchiere | mediu |
| 2 | puncte-lucru-P5 (L6, L7) | caseta „Punct de lucru nou”, rotirea codului | Rândul nou evidențiat; după rotire, mesaj și „Tipărește afișul nou” → `/puncte-lucru/<id>/afis` | — | mic |
| 2 | puncte-lucru-P6 (L8) | fișa echipamentului, CelulaZi, Coduri QR | Numele punctului → `/puncte-lucru#punct-<id>` | `scopeFor(departments:read)` ≠ null/none | mic |
| 2 | puncte-lucru-P7 + O1 (L2) | `/angajati`, `/angajati/[id]` | Filtrul `/angajati?punct_lucru=`; punctul de lucru al contractului afișat pe fișă | `employees:read all` | mediu |
| 3 | puncte-lucru-P8 + P9 + O2 (L5) | antetul, rută opțională `[id]`, starea goală din Coduri QR | Antetul descrie legăturile reale, cu link „Coduri QR”; fișa `/puncte-lucru/[id]` (opțională); starea goală din Coduri QR doar cu drept de citire | `departments:read` ≠ none | mic / mare (P9) |

### 3.18 rapoarte
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 (defect) | rapoarte-O3 + O4 | `/rapoarte` | „Deschide salarizarea” doar cu modulul activ; linkul spre fișă doar cu drept și pentru angajați existenți | payroll activ; `employees:read all && exista` | mic |
| 1 | rapoarte-P1 + O1 + O2 (L5) | `/rapoarte` | Defalcarea lunară în `PanouLateral`: fiecare lună → `/salarizare/<period>/<entry>`; zilele CO/CM → `/concedii/echipa?employee_id=&de_la=&pana_la=`; orele suplimentare pe lună → `/pontaj?an=&luna=&cauta=` | payroll activ; leave activ + `leave:read team`; `attendance:read team` | mediu |
| 1 | rapoarte-P2 (L3, L4, L8) | `/rapoarte` | Lunile din avertismente și din starea goală → `/salarizare/<periodId>`; o singură lună necalculată → „Calculează {luna}” | payroll activ | mic |
| 2 | rapoarte-P3 (L1) | `/rapoarte` | Cartelele: cost și tichete → `/salarizare`; zile de concediu → `/concedii/sold?an=`; ore suplimentare → `/pontaj?an=` | modulul fiecărei ținte + permisiunea ei; `aria-label` pe cartelele cu sparkline | mic |
| 2 | rapoarte-P4 (L2) | `/rapoarte` | Rând separat de linkuri pe luni sub grafic → `/salarizare/<periodId>` | payroll activ | mic |
| 3 | rapoarte-P5 (L6, L7) | `/rapoarte` | Rândul angajatului clicabil, fără link mort pentru angajații șterși | `employees:read all && exista` | mic |
| 3 | rapoarte-P6 (L9) | `/salarizare`, `/salarizare/[id]` | „Rapoarte” → `/rapoarte?an=` | modulul rapoarte activ | mic |

### 3.19 reges
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | reges-P1 (L1) | `/reges` | Fișele de sinteză → `?stare=intarziate` / `de_transmis` / `transmise` | — | mic |
| 1 | reges-P2 + O5 (L2) | notificare | „Aveți N de transmis” → `/reges?stare=de_transmis`; nicio notificare cu modulul oprit | reges activ | mic |
| 1 | reges-P4 (L4, L5, L6, L7) | `/reges/[id]` | Numele → fișa; „Contractele” → `#titlu-contracte`; „Mesajul precedent” → `/reges/<depindeDe>`; motivul respingerii → `/reges/setari` | `employees:read all` && `angajatId` ≠ null; `reges:configure all` | mic |
| 1 (defect) | reges-O4 + O1 + O3 | `/reges` | Rândul registrului → fișa, doar pentru cine poate deschide fișa; numele din coadă într-o coloană proprie → fișa; „Verifică fișa” în confirmarea de transmitere | `employees:read all` | mic |
| 2 | reges-P5 (L8) | `/reges/[id]` | Transmite și Anulează pe detaliu | `reges:transmit all` / `reges:update all`, mesaj „de_transmis” | mic |
| 2 | reges-P10 + P11 (L16, L17) | `/reges`, `/angajati/[id]`, concedii | `?angajat=` pe registru și coadă; „Evenimente REGES” pe fișa angajatului; „Deschide în REGES” în mesajele din concedii | reges activ + `reges:read all`; în portal niciodată | mediu |
| 2 | reges-P7 + P9 (L10, L11, L13) | `/reges/propuneri` | Propunerile trimise: salariatul (prin `contract_id`) → fișa, rândul → `/reges/<mesajId>`; confirmare după „Pune în coadă” | `directie = trimisa`; `employees:read all` | mediu |
| 3 | reges-P6 + P12 + O2 (L9, L15) | `/reges` | `#coada-mesaje` după „Pregătește”; `?mesaje=` din sumarul cozii (statisticile rămân independente de filtru); evenimentul ↔ mesajele lui (`eveniment_id`) | — | mic–mediu |

### 3.20 registru
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 (defect) | registru-O5 + O6 | panoul `?doc=` | „Deschide documentul” / „Deschide lista modulului” trec prin porțile țintei (diurnă, foi, vehicule, mentenanță pentru hr) | 2.1: modulul activ + permisiunea țintei; altfel text | mic |
| 1 (defect) | registru-O2 (= angajati-O5) + P7 (L7) | `/angajati/[id]/documente`, `/angajati/[id]` | „Vezi în registru” → `/registru?an=<an>&angajat=<id>` | `can(registru:read, all)`; niciodată în portal | mic |
| 1 | registru-O1 | panoul `?doc=` | Adeverința de curs → `/cursuri/<course_id>/stadiu` (`course_completion_records` intră în `TIPURI_CU_PARINTE`) | courses activ + `courses:read` | mic |
| 2 | registru-P6 (L6) | caseta „Document primit” | După înregistrare → `/registru?q=<numarAfisat>` (sau `?doc=<id>`), cu numărul în mesaj | — | mic |
| 2 | registru-P5 (L5) | `/registru/nomenclator` | Fiecare tip clasat → `/registru?an=&tip=` | — | mic |
| 2 | registru-O3 + O4 | `/registru` | Antetul grupului „Pe angajat” → fișa; „Pe dosar” → `/registru/nomenclator#dosar-`; eticheta filtrului `?angajat=` → fișa | `employees:read all` | mic |
| 3 | registru-P8 (L8) | arhiva de pontaj și documentele-sursă | Numărul de înregistrare → `/registru?an=&doc=<id>` | `can(registru:read, all)` | mediu |
| 3 | registru-P9 (L10) | `/registru` | Celula „Tip document” → același filtru cu `tip=` | — | mic |

### 3.21 salarizare
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | salarizare-P1 (L1, L7) | `/salarizare/[id]/[entryId]` | „Fișa angajatului”; firimitura „Salarizare › {Luna} {An}” | `employees:read all` | mic |
| 1 | salarizare-P2 (L2) | fluturașul | Fiecare atenționare → ecranul care o repară, pe listă albă (fișă, pontaj, concedii, diurnă, setări, istoric, popriri); `cod` validat pe `CODURI_PROBLEMA` | ținta fiecărui link cu modulul și permisiunea ei; prop-ul nu se transmite din portal | mediu |
| 1 | salarizare-P5 + P9 (L8, L13, L15) | `/salarizare/[id]` (ciornă), popriri, istoric | Numele și salariul de bază → `/angajati/<id>#titlu-contracte`; numele din popriri și istoric → fișa | `employees:read all` | mic |
| 1 | salarizare-P10 (L20) | `/angajati/[id]` | Secțiunea „Salarizare”: fluturași → `/salarizare/<p>/<e>`; dosare → `#dosar-<id>`; „Istoric venituri” → `?angajat=` (livrată împreună cu P11 și P12) | payroll activ + `payroll:read all` + `employees:read all`; istoricul cu `payroll:create all` | mediu |
| 1 (defect) | salarizare-O5 + O6 + O7 + O8 | `/salarizare`, `/salarizare/[id]` | „Istoric venituri” doar pentru cine poate crea; „pontajul lunii” doar cu modul și drept; Livrabile doar pentru cine poate exporta; lista „fără contract” legată doar pentru cine poate deschide fișa | `poateCrea`; attendance activ + `attendance:read team`; `poateExporta` (+ `employees:read all` pentru bancar și D112); `employees:read all` | mic |
| 2 | salarizare-P3 + P4 (L3, L4, L6) | fluturașul | Zilele lucrate și orele → `/pontaj?an=&luna=&cauta=`; zilele CO/CM → `/concedii?employee_id=&de_la=&pana_la=`; fluturașul anterior și următor | attendance activ + `attendance:read all`; leave activ + `leave:read all` | mic |
| 2 | salarizare-P6 + P7 + P8 + O1 + O2 + O4 (L9, L10, L11, L12) | `/salarizare`, `/salarizare/[id]` | Angajații fără e-mail și fără IBAN numiți → `/angajati/<id>/editeaza`; insigna „N atenționări” pe rând; refuzurile de creare și de aprobare leagă `/pontaj/perioade` și `/salarizare/setari`; ciorna fără angajați → `/angajati` | `employees:update all`, altfel fișa; attendance activ; `payroll:update all` | mic–mediu |
| 3 | salarizare-P11–P16 + O3 (L5, L14, L16, L17, L18, L19, L21) | popriri, componente, istoric, setări, `pontaj/perioade/[id]`, fluturașul | Ancorele `#dosar-` și `#sablon-` cu evidențiere; istoricul cu `?angajat=`; „asociat la N angajați” → `/angajati?componenta=`; setările → `/pontaj/setari`; perioada de pontaj → statul de plată; diurna → `/diurna?employee_id=`; reținerea de tip poprire → dosarul | modulul fiecărei ținte + permisiunea ei | mic–mediu |

### 3.22 setari
Pagina din vault `setari.md` nu există, nici ca fișier, nici ca subdirector.

| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | setari-P1 (L1) | `/setari/audit` | Entitatea evenimentului → ruta obiectului; harta e cheiată pe numele de tabelă, plus acțiunile al căror `entityId` e confirmat ca id de rută | per tip: modul + permisiune la `all`; fără pereche, text | mediu |
| 1 | setari-P5 + P6 (L5, L6, L8) | `/setari/membri` | Numele → fișa principală; „Permisiuni” → `/angajati/<id>/permisiuni`; „Activitate” → `/setari/audit?actor=` | `employees:read all`; `roles:update all && !esteEu`; `audit:read all` | mic |
| 1 (defect) | setari-P10 + O3 + O4 (L14, L16) | `card-antet.tsx`, panoul departamentului, `/setari/membri` | „profilul firmei” → `#org-<cheie>` doar pentru administrator; „Invită un cofondator” → `?rol=org_admin`; formularul de invitație și „Revocă” doar pentru cine poate crea | `organizations:update all`; `users:update all` + `users:create all` | mic |
| 2 | setari-P2 + P3 (L2, L3) | `/setari/audit` | Autorul → `?actor=`; etichete românești pentru toate tipurile de entitate | — | mic |
| 2 | setari-P4 (L4) | paginile de detaliu | „Istoric modificări” → `/setari/audit?entity_id=` (după `.eq` pe UUID complet, verificat cu o sondă) | `audit:read all` | mediu |
| 2 | setari-P8 (L9) | `/setari/organizatie` | Secțiunea „Module pornite”, cu link doar pentru modulele care au intrare de meniu | `organizations:update all` | mediu |
| 3 | setari-P9 + P11 + P12 (L10, L11, L13, L15, L17) | `/setari/*` | Locuri folosite → membri; zile de concediu → `/concedii/setari`; antetul documentelor; punctele de lucru; bandă de file comună; întoarcerea la antet după salvare | modulul + permisiunea țintei; SEPA: `unde: null` | mic |
| 3 | setari-P7 + O1 + O2 (L7) | membri, audit, consola de platformă | Invitația → fișa; cheile străine din diferență ca nume legate; coloana „Organizație” din consolă → `/super-admin/organizatii/[orgId]` | `employees:read all` | mic |

### 3.23 ssm
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | ssm-P1 (L1–L5) | instruiri, medicina muncii (inclusiv banda de restricții), EIP, autorizații | Numele → `/angajati/<id>` (`#ssm` după P2) | pe instruiri fără condiție suplimentară; în rest `employees:read team` && neșters | mic |
| 1 | ssm-P2 (L8) | `/angajati/[id]` | Secțiunea „SSM și PSI” cu „Vezi tot” și acțiuni rapide | ssm activ + `ssm:read team`; acțiunile cu `ssm:create team` | mediu |
| 1 | ssm-P3 (L6, L7) | `/ssm/accidente/[id]` | „Accidentat” → fișa; instruirea și fișa de aptitudine valabile **la data producerii** | `employees:read team` && neșters | mic |
| 1 (defect) | ssm-O1, O5, O6, O7 + O4 + O8 | stările goale, EIP, autorizații, `/ssm` | Butoanele de creare din stările goale doar pentru cine poate crea; textul „formularul de mai sus” doar când formularul există; cardurile de instruiri cu poarta dublă | `ssm:create team`; `ssm:read team` + `employees:read team` | mic |
| 1 | ssm-P4 + O3 (L14, L15) | formularele noi | Instruirea → `/ssm/instruiri?domeniu=`; „Instruire nouă” păstrează domeniul; fișa medicală se întoarce pe `/angajati/<id>#ssm` doar cu `inapoi` validat | — | mic |
| 2 | ssm-P5 + P6 + P10 (L9, L10, L11, L12) | `/ssm`, listele | Cardurile → `?scadenta=…`; `?doar=atentie`; pastila „Scadență” pe EIP; bara de filtre pe accidente | aceeași regulă ca numărătoarea | mic–mediu |
| 2 | ssm-P7 + P8 (L13, L20) | listele SSM, matricea | `?angajat=` cu pastilă; celula „Expirat/Lipsă” → `/ssm/instruiri/noua?tip=&angajat=`; rândurile expirate → `/ssm/medicina-muncii/noua?angajat=` | `poateCrea` | mic |
| 3 | ssm-P9 + P11 + P12 + P13 + O2 (L16, L17, L18, L19, L21) | stingătoare, autorizații, matricea, departamente, accidente | „← {cod}” la editare; rutele-filă în `RUTE_CU_PAGINA`; „Echipamente ISCIR” → `/mentenanta/echipamente?responsabil=&iscir=da`; popover cu „Marchează semnat”; `?department_id=` pe instruiri; numărul de registru pe accident | maintenance activ + read team; `ssm:update team`; `registru:read all` | mic–mediu |

### 3.24 ticketing
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | ticketing-P1 + P2 (L1, L2, L3) | `/ticketing`, `/ticketing/[id]` | „Deschide coada echipei” în starea goală; banda „Tichetele mele / Coada echipei”; firimitura după proveniență | `tickets:read team` | mic |
| 1 | ticketing-P3 + P4 (L5, L11) | `/ticketing/[id]`, panou | Obiectul stricat → `/inventar/<id>` (cu garanția); contorul de pe panou → `?status=in_aprobare` | inventory activ + `inventory:read` ≠ null/none | mic |
| 1 (defect) | ticketing-O5 + O6 | `/ticketing/[id]`, `/ticketing`, `/ticketing/nou` | Decizia pentru managerul direct doar dacă are dreptul de aprobare; „Tichet nou” ascuns și o `StareGoala` pe formular când contul n-are fișă | `can(tickets:approve, team)`; `faraFisa` | mic |
| 2 | ticketing-P5 + P11 (L4, L6, L7) | fișa, coada | Persoanele de pe fișă → fișele lor; asignatul → coada filtrată pe el; solicitantul → fișa | `employees:read all` && neșters (solicitantul și pentru managerul lui direct) | mic |
| 2 | ticketing-P6 + P7 + P8 (L8, L9, L10, L12) | coada, fișa | Bara de filtre; „Asignate mie”; `?stare=deschise`, `?fara_miscare=7`, `?asignat=niciunul`; după decizie → cererile rămase | `poateVedeaCoada` | mediu |
| 2 | ticketing-P9 + P10 + O3 + O4 (L13, L15) | fișa, inventar, portal | „Are deja în primire” → `/inventar/<id>`; „Raportează o defecțiune” cu obiectul ales (în aplicație și în portal) | inventory activ; ticketing activ + `tickets:create own` + obiectul alocat privitorului | mediu |
| 3 | ticketing-O1 + O2 | raportarea unei probleme, fișa | Captura păstrează pagina de origine (`de_la`); rândul „Modul” → ruta modulului, doar la potrivire exactă | — | mic |
| 3 | ticketing-P12 + P13 + P15 + P16 (L14, L16, L18, L19) | `/angajati/[id]`, fișa, departamente | „Tichete IT” pe fișa angajatului; duplicat ↔ părinte (împreună cu caseta de marcare); tichetele departamentului; „Înregistrează echipamentul” → `/inventar?obiect=nou&denumire=` | `tickets:read all` sau managerul direct; `tickets:read all` pe departament; `inventory:update all` | mic–mediu |

### 3.25 portal
| Prio | Id | Pagină | Ce devine clicabil → țintă | Condiție | Efort |
|---|---|---|---|---|---|
| 1 | portal-P1 (L1) | notificări, acasă, push | `/onboarding/<uuid>` → `/portal/integrarea-mea/<uuid>` | onboarding activ + `checklists:read own` + instanța e a destinatarului (contextul se filtrează și pentru push) | mediu |
| 1 | portal-P3 (L4) | zi, listă, grilă, ceas, pontare cu cod | Ziua din concediu → `/portal/concediile-mele/<id>`; „deja înregistrată” → `/portal/pontajul-meu/zi/<azi>` | leave activ + `leave:read own` (doar pe linkurile de concediu); `poateVedeaConcediul` separat de `poateEdita` | mic |
| 1 | portal-P4 (L5) | zi, săptămână | După salvare → `/portal/pontajul-meu?an=&luna=` ale zilei salvate; „Înapoi” pe aceeași lună | `attendance:read own` | mic |
| 1 (defect) | portal-O5 + O6 + O7 + O8 | layout, pontaj, `/portal/ponteaza`, anunțuri | „Raportează o problemă” doar pentru cine poate crea tichete; linkurile spre luna de pontaj doar cu drept de citire; preambul pe `/portal/ponteaza`; anunțurile traduse doar pentru cine le poate citi | `tickets:create own`; `attendance:read own`; attendance activ + `attendance:create own`; `announcements:read own` | mic |
| 2 | portal-P6 + O3 + O4 (L6) | `/portal` | „De făcut” include obiectele de confirmat, sesizările atribuite, pașii de integrare, ziua respinsă, deplasările respinse și ciornele | modulul + permisiunea `own` pentru fiecare | mediu |
| 2 | portal-P5 + P8 + P9 + O2 (L3, L8, L9) | notificări, anunț, sesizări | Notificarea de săptămână → `?saptamana=<start>` (context de proprietate); anunțul primește firimituri și „Următorul necitit”; „Raportează o defecțiune” pe utilajul din grijă; „Tichetele IT” → `/portal/tichetele-mele/nou` | `maintenance:create own`; ticketing activ + `tickets:create own` | mic–mediu |
| 2 | portal-P2 + O1 (L1, L2) | `/portal/integrarea-mea(/sarcini)` | Pașii mei din integrarea colegilor (rută nouă); pasul automat numește cursul → `/portal/cursurile-mele/<id>` | instanța vizibilă prin RLS și pas cu responsabil = fișa mea | mare |
| 3 | portal-P7, P10–P16 (L7, L10–L16) | acasă, tichet, în primire, fluturaș, pontare, cerere, detalii, KPI | Cifrele de acasă → listele lor; obiectul din tichet → `#obiect-<id>`; „S-a stricat” → tichet precompletat; legături sub fluturaș; „Vezi luna întreagă”; „Vezi în pontaj”; firimituri pe detalii; lunile KPI anterioare se deschid | modulul + permisiunea `own` | mic–mediu |

---

## 4. Fundături și cozi care nu duc nicăieri

### 4.1 După acțiune, utilizatorul rămâne fără drum
| Pagină | Acțiunea | Ce lipsește | Id |
|---|---|---|---|
| `/angajati/import` | Import încheiat | niciun link spre listă | angajati-L17 |
| `/angajati/nou` | Înrolare reușită | checklistul, soldul și avertismentele sunt text; bunurile și PV-ul nu apar | angajati-L16, inventar-O2, onboarding-L8 |
| `/angajati/[id]` | Concediere | toast fără drum spre REGES sau spre checklistul de ieșire | angajati-L18, onboarding-L15 |
| `/angajati/sabloane-documente/nou` | Șablon nou | toastul spune „din fișa oricărui angajat”, dar n-are link | angajati-L23 |
| `/anunturi/[id]` | „Salvează ca ciornă”, publicare | ciorna nu se poate edita sau șterge; anunțul publicat nu se poate retrage | anunturi-L5, O2 |
| `/concedii` | Cerere pentru alt angajat | cererea nu apare în lista pe care aterizezi | concedii-L4 |
| `/concedii/aprobari`, `/concedii/[id]` | Decizie / trimiterea ciornei | avertismentele REGES și pontaj dispar odată cu componenta | concedii-L3, O4 |
| `/concedii/setari` | „Aplică drepturile” | nicio confirmare, niciun drum spre solduri | concedii-L16 |
| `/cursuri/[id]/reguli` | „Aplică acum” | toast fără drum spre stadiu | cursuri-L7 |
| `/cursuri/biblioteca/nou` | Pasul 5 | „puneți-l într-un curs”, fără buton | cursuri-L13 |
| `/departamente` | Departament nou; refuzul dezactivării; „Mută N persoane” | panoul nu se deschide; refuzul e text roșu; niciun drum spre ținta mutării | departamente-L7, L8, O2 |
| `/diurna/[id]` | Aprobatorul deschide deplasarea | nu poate decide pe fișă | diurna-L6 |
| `/diurna/politica` | Salvarea versiunii | niciun drum spre „Deplasare nouă” | diurna-L12 |
| `/evaluari` | Programare | lista rămâne nefiltrată, fără evidențiere; evaluarea finalizată n-are destinație | evaluari-L10, L6 |
| `/evaluari/kpi` | „Deschide luna” refuzată | niciun drum spre seturi, spre fișă sau spre luna existentă | evaluari-L2, O3 |
| `/flota/foi` | „Salvează ciorna” | niciun link spre ciornă | flota-L12 |
| `/flota/foi/[id]` | Aprobatorul deschide foaia trimisă | nu poate decide pe fișă | flota-O1 |
| `/inventar/[id]` | Predare / returnare | PV-ul cere încă un clic; după returnare dispare din card | inventar-L8 |
| `/mentenanta/planuri` | Plan nou | rămâi pe listă, fără evidențiere | mentenanta-L15 |
| `/mentenanta/sesizari/[id]` | Sesizare închisă sau respinsă | „raportați din nou” fără buton | mentenanta-L10 |
| `/onboarding/[id]` | „Finalizează” | dovada rămâne un link discret la subsol | onboarding-L11 |
| `/onboarding/sabloane/nou` | Șablon salvat | lipsește „Pornește o instanță” | onboarding-L7 |
| `/organigrama` → fișa | Corectarea managerului | nu există întoarcere în arbore | organigrama-L8 |
| `/pontaj` | „Emite decizia” de suspendare | seria dispare fără mesaj și fără drum spre REGES | pontaj-L5 |
| `/pontaj/aprobare` | „Aprobă lotul” | nici mesaj, nici link spre lot | pontaj-L14 |
| `/pontaj/saptamana` | Trimiterea săptămânii | niciun drum spre Prezența | pontaj-L25 |
| `/puncte-lucru` | Punct nou; generarea codului QR | rândul nu e evidențiat; după rotire ecranul arată identic | puncte-lucru-L6, L7 |
| `/puncte-lucru/[id]/afis` | Tipărire | niciun drum înapoi; firimitura duce în 404 | puncte-lucru-L3, L4 |
| `/reges` | „Pregătește”, „Anulează” | mesajele create nu sunt legate; nicio confirmare | reges-L9 |
| `/reges/[id]` | Verificarea mesajului | Transmite și Anulează lipsesc | reges-L8 |
| `/reges/propuneri` | „Pune în coadă”, răspuns | nicio confirmare, nicio evidențiere | reges-L13 |
| `/registru` | „Document primit” | numărul alocat nu se arată; rândul poate fi ascuns de filtre | registru-L6 |
| `/salarizare` | Crearea perioadei refuzată | refuz în text, fără link | salarizare-L12 |
| `/salarizare/[id]` | „Trimite fluturașii”, fișier bancar, „Aprobă” | doar contoare, fără nume; refuzul „schimbați setarea” n-are link | salarizare-L9, O1, O2 |
| `/salarizare/setari`, popriri, componente, istoric | Salvare | pasul următor lipsește; elementul nou nu e evidențiat | salarizare-L18, L19 |
| `/setari/organizatie` | Salvare, venind de la antetul documentelor | niciun drum înapoi | setari-L17 |
| `/ssm/instruiri/noua`, `/ssm/medicina-muncii/noua` | Salvare | instruirea PSI aterizează pe fila SSM; fișa nouă ajunge într-o listă generală | ssm-L14, L15 |
| `/ssm/stingatoare/[id]/editeaza` | Renunțare | niciun drum înapoi | ssm-L16 |
| `/ssm/autorizatii` | Suspendare | echipamentele afectate nu sunt arătate | ssm-L18 |
| `/ticketing/[id]` | Decizia pe cerere | niciun drum spre cererile rămase | ticketing-L12 |
| `/ticketing` | org_admin fără fișă | „Coada e accesibilă din meniu”, fără buton | ticketing-L1 |
| `/portal/pontajul-meu/zi/[data]` | Salvarea zilei | aterizare pe luna curentă, nu pe luna zilei | portal-L5 |
| `/portal/ponteaza/[cod]` | Pontare cu cod | niciun link spre lună | portal-L13 |
| `/portal/anunturi/[id]` | Confirmare automată | fără drum înapoi; în aplicația instalată, doar meniul secundar | anunturi-L3, portal-L8 |
| `/portal/integrarea-mea/[id]` | Responsabil pe pasul unui coleg | 404 | portal-L2 |
| `/portal/instruirile-mele` | „Verificați cu responsabilul” | în aplicație nu există acțiunea de confirmare a semnăturii | ssm-L19 |
| `/rapoarte` | Starea goală | trimite la lista perioadelor, nu la luna de calculat | rapoarte-L4 |

### 4.2 Contoare și insigne fără țintă (sau cu țintă nefiltrată)
| Unde | Cifra | Duce azi la | Id |
|---|---|---|---|
| `/panou` | Contracte care expiră | `/angajati` nefiltrat | panou-L1, angajati-L20 |
| `/panou` | Cifrele din „Firma azi” | nicăieri | panou-L4 |
| `/panou` | Tichete în aprobare; REGES | listă nefiltrată | panou-L5, L6, ticketing-L11 |
| `/panou` | Documente de flotă / Lipsesc | `/flota` nefiltrat | panou-L7, flota-L17 |
| `/panou` | Coada cu un singur obiect | lista, nu obiectul | panou-L9 |
| meniul lateral | `leave_pending`, `attendance_pending`, `reges_pending`, `fleet_expiring` | intrarea modulului, nu lista numărată | panou-L8, O1, O2 |
| meniul lateral | anunțuri necitite | nu există insignă | anunturi-L7 |
| `/anunturi`, `/anunturi/[id]` | „X din Y”, „N necitite”, progresul de pe card | nicăieri | anunturi-L2, L6, O3 |
| `/concedii/*` | Fila „Aprobări” fără contor; „+N altele” | nicăieri | concedii-L9, L17 |
| `/cursuri/conformitate`, `/cursuri/[id]/stadiu` | Neatribuite / Expirate; indicatorii stadiului | nicăieri; calculați pe rânduri filtrate | cursuri-L12, O3 |
| `/evaluari`, `/evaluari/sabloane` | Evaluări finalizate; „folosit în N” | nicăieri | evaluari-L8, L9 |
| `/inventar/[id]` | „Predări N” | nicăieri | inventar-L13 |
| `/mentenanta` | Cifra mare și totalurile panourilor | doar peste 8; sesizări nefiltrate | mentenanta-L12 |
| `/organigrama` | „N fișe active”; rădăcini cu manager nevizibil | nicăieri / nemarcate | organigrama-L3, L5 |
| `/rapoarte` | Cele șase cartele | nicăieri | rapoarte-L1 |
| `/reges` | Fișele de sinteză; sumarul cozii | nicăieri | reges-L1, L15 |
| `/salarizare/[id]` | „N fără e-mail”, „N fără IBAN” | fără nume | salarizare-L9, O1 |
| `/setari/organizatie` | Locuri contractate | nicăieri | setari-L10 |
| `/ssm` | Cardurile de stingătoare, fișe, EIP, instruiri | liste nefiltrate | ssm-L9, L10, L11 |
| `/ticketing/coada` | Deschise; Fără mișcare de 7 zile | nicăieri | ticketing-L8 |
| `/notificari` | „N necitite” | nicăieri | notificari-L11 |
| `/portal` | „De făcut” incomplet; cifrele de start | sarcinile lipsesc; cifrele nu duc nicăieri | portal-L6, L7, O3, O4; inventar-L14 |

### 4.3 Notificări care nu duc la obiect
| Notificarea | Duce azi la | Id |
|---|---|---|
| Cerere de concediu de aprobat | coada `/concedii/aprobari` | concedii-L13, notificari-L1 |
| Plan / pontaj săptămânal de aprobat; mementoul de după 2 zile | coada, fără ancoră | notificari-L4 |
| Plan aprobat / respins; mementourile de vineri–duminică | săptămâna implicită, nu cea în cauză | notificari-L5, O1, pontaj-L21, portal-L3 |
| Zi de pontaj respinsă | luna, nu ziua; pentru rolurile din aplicație, `/panou` | pontaj-L22, O4, O7, notificari-L2 |
| Înrolare la curs (destinatar din aplicație) | redirect la `/panou` | notificari-L3 |
| Săptămână aprobată fără pontaj | `/pontaj` gol | pontaj-L20, notificari-L9 |
| Evenimente REGES de transmis | `/reges` nefiltrat; 404 la firmele fără modul | reges-L2, O5, notificari-L8, O4 |
| Integrare (pornire, termen) în portal | text, fără link | notificari-L7, onboarding-O1, portal-L1 |
| Anunț nou, după expirare sau cu modulul oprit | 404 | anunturi-O1, O4, portal-O8 |
| Sesizare nouă / comentariu către responsabili | AccesRestrictionat sau 404 | notificari-O2, O5 |
| Bug rezolvat, trimis autorilor duplicatelor | tichetul-părinte, invizibil pentru ei | notificari-O3 |
| Deplasare trimisă / decisă; programarea evaluării; luna KPI închisă; predare de inventar | nu se trimite nicio notificare | diurna-L9, O3, notificari-L6, evaluari-L16, inventar-L14 |
| Orice notificare primită prin push de manager, hr sau org_admin | `/portal/*`, de unde layout-ul trimite la `/panou` | notificari-O6 |
| Aprobări cu suprascriere per membru | sarcina ajunge la cine nu mai poate aproba | notificari-O7 |

### 4.4 Legături existente care se termină în refuz sau în 404
| Legătura / controlul | Cine pică | Id |
|---|---|---|
| „Editați regulile” pe fișa angajatului | manager | angajati-L3, concedii-O5 |
| „profilul firmei” din antetul documentelor | hr | angajati-L21, setari-L14 |
| „Vezi în registru” din dosarul angajatului | manager | angajati-O5, registru-O2, O7 |
| „Permisiuni” / „Evaluare nouă” pe fișa proprie | org_admin, manager | angajati-O6, O7 |
| Evaluări, scutiri și sporuri pe fișă, cu modulul oprit | orice rol | angajati-O8, O9, evaluari-O9 |
| „Anunț nou” păzit de altă permisiune decât acțiunea | rol cu suprascriere | anunturi-O5 |
| Acțiunile din starea goală la cursuri | rol fără `create` sau `employees:read` | cursuri-O4, O5, O6 |
| „Invită un cofondator” | hr | departamente-L6 |
| Fila KPI, firimitura „Evaluări”, filele de pe „Ale mele”, „Creează un șablon” | firmă fără kpi/evaluations; manager | evaluari-L12, O1, O2, O5, O6, O7, O8 |
| Fila „Vehicule”, „Vezi anomaliile”, firimitura „Parc auto” | manager | flota-L5, L14, O5 |
| „Adăugați întâi un vehicul”, „Deschide foaia” din anomalii | rol cu suprascriere | flota-O6, O7 |
| Linkul „Inventar” din offboarding; legăturile din registru spre inventar | firmă fără inventory | inventar-O4, O5, onboarding-O5 |
| Sesizarea duplicat, opririle, filele, „Sesizare nouă” | manager, angajat, rol own | mentenanta-O4, O5, O6, O7 |
| „Vezi dovada”, „Finalizează” / „Anulează”, avertismentele din wizard | manager responsabil; firmă fără onboarding | onboarding-O6, O7, O8 |
| „Vezi modulele”, „Definește”, scurtătura „Salarizare” | hr, manager, rol cu suprascriere | panou-L2, L3, O4, O5, setari-O3 |
| Aprobare din perioadă; „Salarizare → Setări”; fila „Coduri QR” | hr; firmă fără payroll; rol cu suprascriere | pontaj-O5, O6, O8 |
| Firimitura „Detaliu” pe afiș; starea goală din Coduri QR | toate rolurile; rol cu suprascriere | puncte-lucru-L3, O2 |
| „Deschide salarizarea”; numele din rapoarte | firmă fără payroll; rol cu suprascriere; angajat șters | rapoarte-O3, O4, L7 |
| Rândul registrului REGES → fișa | rol cu `reges:read` și `employees:read=team` | reges-O4 |
| „Deschide documentul” din panoul registrului | hr; firmă cu modulul oprit | registru-O5, O6 |
| „Istoric venituri”, „pontajul lunii”, Livrabile, lista „fără contract” | rol cu suprascriere; firmă fără attendance | salarizare-O5, O6, O7, O8 |
| Formularul de invitație și „Revocă” | rol cu `users:update` fără `create` | setari-O4 |
| Butoanele de creare din stările goale SSM; cardurile de instruiri | manager; rol cu suprascriere | ssm-O1, O4, O5, O6, O7, O8 |
| Decizia pe cerere pentru managerul direct; „Tichet nou” fără fișă | hr manager direct; org_admin fără fișă | ticketing-O5, O6 |
| „Raportează o problemă”, linkurile de pontaj, `/portal/ponteaza`, anunțurile | angajat cu suprascriere sau cu modulul oprit | portal-O5, O6, O7, O8 |
| Aprobarea propriei deplasări (inversul: o permisiune care pare să treacă) | manager, org_admin | diurna-O5, de verificat prin probă |

---

## 5. Ordine de livrare recomandată

Loturile 2–6 depind doar de lotul 1. Între ele se pot livra în orice ordine. Propunerile de prioritate 3 care nu sunt numite mai jos intră în lotul care atinge aceeași pagină.

### Lotul 1 — Porți și fundație: niciun clic în refuz
- **Conținut:** primitivele 2.1 (registrul porților), 2.3 (Tabel), 2.9 (firimituri) și 2.11 (benzi de file), plus repararea tuturor legăturilor din 4.4.
- **Criteriu de acceptare:**
  - Pentru fiecare rol din seed (org_admin, hr, manager, employee) și pentru o firmă cu modulele opționale oprite, niciun link, filă, firimitură, buton din starea goală sau acțiune afișată nu se mai termină în AccesRestrictionat, în 404 sau într-un refuz la trimitere. Ce rolul nu poate deschide apare ca text.
  - Pe telefon, linkurile secundare din cardurile de tabel primesc clicul înaintea rândului.
  - Verificarea se face cu conturile demo pe staging, pe paginile atinse, și cu teste pe funcția de poartă.

### Lotul 2 — Numele duc la entitate
- **Conținut:** primitiva 2.2 aplicată pe tot rândul **Angajat** din matrice, plus vehicul, echipament, plan, obiect, curs, material, cerere și mesaj REGES. Concret: anunturi-P1; concedii-P1, P5, P6; cursuri-P1, P2, P4, P6; departamente-P2, P3; diurna-P1, P2; evaluari-P2, P4, P5; flota-P1, P2, P11; inventar-P3, P4, P6; mentenanta-P1, P2, P5, P8, O1–O3; onboarding-P1, P2, P5, P7; organigrama-P3; pontaj-P1, P3, P12; rapoarte-P5; reges-P4, P7, O1, O3; salarizare-P1, P5, P9; setari-P1, P5, P6; ssm-P1, P3; ticketing-P3, P5, P11, O1, O2.
- **Criteriu de acceptare:** din orice listă, card sau fișă care afișează una dintre aceste entități, un clic duce la pagina ei când rolul o poate deschide. Când rolul nu poate, sau rândul e șters, numele rămâne text. Niciun nume de angajat afișat într-un modul nu mai obligă la căutarea lui în `/angajati`.

### Lotul 3 — Fișa angajatului ca punct de plecare, cu filtre pe angajat
- **Conținut:** primitivele 2.4 și 2.5.
  - Pe fișa angajatului: angajati-P1, P2, P4, P7, P9, O1–O4; cursuri-P3; diurna-P5; evaluari-P10, P11; flota-P7; inventar-P1; mentenanta-P11; onboarding-P4; pontaj-P9; reges-P10; salarizare-P10, P11, P12; ssm-P2; ticketing-P12; registru-P7.
  - Filtrele de pe listele-țintă: diurna-P4, inventar-P5, evaluari-P3, ssm-P7, puncte-lucru-P7.
  - Adresele noi: departamente-P1, P10 și puncte-lucru-P1, P2.
  - Profilul: profil-P1, P2, O1.
  - Paginile din vault `angajati.md` și `profil.md` se rescriu în același lot.
- **Criteriu de acceptare:**
  - De pe `/angajati/[id]`, org_admin, hr și manager ajung într-un singur clic, fără meniu, la fiecare modul activ, prefiltrat pe omul respectiv: pontaj, concedii, integrare, bunuri, cursuri, deplasări, SSM, echipamente, KPI, flotă, fluturași, REGES, tichete, registru.
  - Fiecare legătură apare doar unde rolul are drept: hr nu vede diurna, mentenanța și flota; managerul nu vede salarizarea, REGES și registrul.
  - Fiecare listă-țintă arată o pastilă „Angajat: Nume” care se poate șterge.
  - Departamentul și punctul de lucru au o adresă la care se poate trimite.
  - `/profil` duce rolurile din aplicație la fișa proprie și la ecranele „ale mele”.

### Lotul 4 — Decizia pe obiect și drumul după acțiune
- **Conținut:** primitivele 2.7 și 2.8, cu: diurna-P3, P6, P7; flota-O1, P4, P5, O3; reges-P5, P6, P9; concedii-P3, P4, P9, P10, O4; cursuri-P7, P8; departamente-P7, P8, O2; evaluari-P7, O3; inventar-P7, P8, P9; mentenanta-P3, P4, P9; onboarding-P6, P8, P10, P12; organigrama-P1, P5, P7; pontaj-P2, P4, P5, P6; puncte-lucru-P4, P5; registru-P6; salarizare-P6, P8; setari-P12; ssm-P4, P8; ticketing-P1, P2, P8, P10; anunturi-P2, P5, O1, O2; angajati-P5, P6, P14; portal-P3, P4, P8, P13, P15.
- **Criteriu de acceptare:**
  - Deplasarea, foaia de parcurs, cererea și mesajul REGES se decid pe fișa obiectului.
  - După orice creare, decizie, import sau salvare, utilizatorul vede rezultatul: un mesaj care nu dispare cât timp are acțiune, rândul evidențiat sau obiectul deschis.
  - Tot de acolo are un clic spre pasul următor: PV, stadiu, coada REGES, lotul aprobat, fișa nouă.
  - Nicio pagină de detaliu nu mai rămâne fără drum înapoi pe telefon.

### Lotul 5 — Cifre, cozi și insigne care duc la rândurile numărate
- **Conținut:** primitiva 2.6, cu: panou-P1–P7, O1–O3; angajati-P8; flota-P6; ssm-P5, P6, P10; ticketing-P4, P6, P7; reges-P1, P12; evaluari-P1, P6; cursuri-P13, O3; mentenanta-P6, P7; rapoarte-P1–P4, O1, O2; anunturi-P3, P6, P7, O3; concedii-P7, P14; organigrama-P2, P6; inventar-P10, P11; salarizare-P7; setari-P9; portal-P6, P7.
- **Criteriu de acceptare:**
  - Fiecare cifră de pe `/panou`, din antetele modulelor și din meniu deschide o listă care conține **exact** rândurile numărate, pe același predicat, cu filtrul vizibil ca pastilă.
  - Coada unui singur obiect duce direct la el, unde detaliul permite decizia.
  - „De făcut” din portal include tot ce i se cere angajatului.

### Lotul 6 — Notificări și push la obiect
- **Conținut:** primitiva 2.10, cu: notificari-P1–P6, O1–O7; pontaj-P10; concedii-P11; diurna-P8, O2; evaluari-P13; reges-P2; anunturi-O4; onboarding-P11; portal-P1, P2, P5. Popoverul de la clopoțel (notificari-P7 și P8, primitiva 2.12) vine la final.
- **Criteriu de acceptare:**
  - Fiecare notificare, în listă, pe ecranul de start al portalului și în push, deschide obiectul sau lista lui filtrată, în învelișul destinatarului.
  - Când destinatarul nu poate deschide ținta, notificarea devine text care se marchează citit.
  - Niciun clic pe o notificare nu mai duce la `/panou`, în 404 sau în AccesRestrictionat. Rândurile vechi sunt acoperite de traducerea la randare.
  - Migrările sunt noi, forward-only (`create or replace`) și se aplică prin `psql`. Aplicarea pe producție cere confirmarea explicită a utilizatorului.