# F12 — planul de execuție (cele 8 extensii ale flotei)

> Scris pe 12.10.2026, din specificațiile F12a–F12h din acest director (citite integral la
> secțiunile 3, 5, 6, 7 și la „Ce rămâne nesigur”), din planul flotei
> (`/home/miro/.claude/plans/https-administrativo-ro-flota-vreau-sa-m-elegant-walrus.md`) și din
> `main` la `bd516e39`, citit doar. Nimic nu s-a scris în `/srv/apps/ERP` și nimic n-a rulat pe
> vreo bază.
>
> **Autoritatea:** corpul fiecărei specificații bate rezumatul ei. Rezumatele date orchestratorului
> au trei nepotriviri cu textul (§2.4). Unde README-ul corectează o specificație, corectura e scrisă
> și în specificație, la final, în secțiunea „Coordonare F12”.

| Extensie | Ce face | Migrare | Mărime |
|---|---|---|---|
| F12a | OCR pe bonul de combustibil | `0210_flota_bon_ocr.sql` | L |
| F12b | Carduri de combustibil + importul extraselor | `0211_flota_carduri_combustibil.sql` | XL |
| F12c | Proces-verbal de predare-primire, PDF | `0212_flota_proces_verbal.sql` | L |
| F12d | Rezervări pe mașinile de pool | `0213_flota_rezervari.sql` | L |
| F12e | Unelte de flotă în asistentul AI | — | L |
| F12f | Codul UIT (e-Transport) pe cursă | `0214_flota_uit_etransport.sql` | M |
| F12g | Exportul costurilor pentru Saga / WinMentor | — (0216 doar la D-g1 = b) | L |
| F12h | Ieșirea din parc (vânzare, casare, radiere) | `0215_flota_iesire_din_parc.sql` | L |

---

## 1. Ordinea de execuție

### 1.1 Poarta 0, comună tuturor

Nicio extensie F12 nu începe până nu sunt adevărate toate trei:

1. **F3–F11 sunt pe `main`**, cu migrările `0196–0204` aplicate pe banc. Toate specificațiile
   construiesc pe TEXTUL planului, iar primul lor pas (§8.0 / „Înainte de a scrie”) e un grep pe
   numele reale. Fără F3–F11 pe disc, grepul n-are ce găsi.
2. **`src/types/database.ts` regenerat din bancul local**, cu cele două patch-uri manuale
   (memoria „Regenerarea tipurilor”). Altfel, typecheck verde + 42703 la runtime (memoria
   „Tipuri înaintea bazei”).
3. **Cele trei worktree-uri pornesc din ACELAȘI commit** de pe `main` (cel cu F3–F11), detașate
   (`git worktree add --detach`), nu ramuri cu `checkout -b`: arborele principal e partajat, iar
   o ramură mută și celelalte sesiuni (memoria „Index git partajat”).

Dependențele fiecărei extensii de F3–F11 (din §3 al fiecărei specificații):

| Ext. | Tare (blochează) | Moale (se adaptează) |
|---|---|---|
| a | F3, F4, **F6** (poza bonului în Storage) | — |
| b | F3, F4, F7, F9, F11 (toate rescriu `app.poate_vedea_expirabil` înaintea lui) | F5 (lista albă), F6 (`vehicles` în `ENTITATI_DOCUMENT`) |
| c | F3 (seed, `poate_vedea_vehicul`, `/portal/masina-mea`) | F4 (tiparul PDF), F5, F6 (scanul), F7 |
| d | F3, F4, **F5** (`fleet_settings` — 0173 n-a creat-o) | — |
| e | F3, F4 | F6, F7, F8, F9 (a șasea unealtă), F10, F11, F12d |
| f | F3, F4 (`trip_sheet_curse`) | F8 (coloana în XLSX) |
| g | **F7, F8** (`vehicles:export`, `/flota/rapoarte`) | F3, F4, F10, F12a, F12b |
| h | F3, F4, F5, F7, F9, F11 | F12b, F12d (vezi 1.3) |

### 1.2 Graficul

```
                    Poarta 0: F3–F11 pe main (0196–0204), tipuri regenerate
                                          │
          ┌───────────────────────────────┼───────────────────────────────┐
          │ T1 „Foaia și combustibilul”    │ T2 „Parcul”                   │ T3 „Alocări, pool, asistent”
          ▼                               ▼                               ▼
     F12a  0210  (L)                 F12b  0211  (XL)                F12c  0212  (L)
          │                               │                               │
          ▼                               │                               ▼
     F12f  0214  (M)                      │                          F12d  0213  (L) ──┐
          │                               │                               │            │
          ▼                               │                               ▼            │
     F12g  —     (L) ◄── merge F12b ──────┤                          F12e  —     (L)   │
                                          ▼                                            │
                                     F12h  0215  (L) ◄────── merge F12d ───────────────┘
```

Săgețile orizontale sunt **porți între trasee**: extensia de la vârful săgeții începe abia după ce
extensia de la coadă e pe `main` și traseul a făcut `git merge` din `main` în worktree-ul lui.

### 1.3 Cele trei trasee

**T1 — „Foaia și combustibilul”: F12a → F12f → F12g.**
Motivul: a și f ating aceleași cinci fișiere ale foii (`flota/erori.ts` + `erori.test.ts`,
`schemas/fleet.ts`, `queries/fleet.ts`, `flota/foi/[id]/page.tsx`, portalul
`masina-mea/foi/[id]/page.tsx`). Pe trasee diferite s-ar fi ciocnit la merge pe aceleași funcții.
g are nevoie de `fuel_entries.cui_statie` din a (XML-ul Saga, g2) și e singurul alt consumator
al foii.
- Dacă decizia blocantă **B2** (OCR, terți) n-are răspuns la pornire, F12f trece înaintea lui
  F12a. Cele două sunt independente în bază (`trip_sheet_curse` / `fuel_entries`).
- F12g: sub-commitul g1 (jurnalul) pornește imediat; g2 (formatele) după F12a. Excluderea
  alimentărilor plătite cu cardul (`fuel_card_transactions.fuel_entry_id`) intră doar după ce
  F12b e pe `main` (poarta T2 → T1). Dacă F12b întârzie, g se livrează fără ramura asta, iar ea
  vine ca sub-commit separat.

**T2 — „Parcul: cardurile și ieșirea”: F12b → F12h.**
Motivul: amândouă **rescriu integral** `app.poate_vedea_expirabil` și extind lista albă din
`internal.conformitate_zilnica` (F5). Două rescrieri integrale în paralel = una o pierde tăcut pe
cealaltă. Serial, h pornește de la forma lăsată de b, iar garda din 0215 §6 verifică prezența
ramurii `fuel_card`.
- **Poarta T3 → T2:** F12h începe abia după ce F12d e pe `main`, din trei motive:
  1. garda nouă `vehicles_iesire_garda` din 0215 refuză `status='casat'` scris direct, deci
     probele lui b și d care fac asta cad. h le mută pe un INSERT în `vehicle_exits`
     (F12h, „Probe SQL”, punctul 0), iar pentru asta trebuie să le vadă pe disc;
  2. `vehicles_rezervari_la_iesire` (d) reacționează la statusul pus de `iesire_dupa_insert` (h);
  3. c, d și h modifică toate `flota/[id]/page.tsx`.

**T3 — „Alocări, pool, asistent”: F12c → F12d → F12e.**
Motivul: c și d ating `vehicle_assignments` (c scrie km-ul la finalizarea PV-ului, d adaugă
`alocari_rezervari` BEFORE INSERT), `flota/[id]/page.tsx`, `portal/masina-mea/page.tsx`,
`portal/notificarile-mele/legaturi.ts` și trimit notificări din trigger. d și e ating amândouă
`src/lib/asistent/destinatii.ts` (d: destinațiile `/flota/rezervari`; e: exportul
`calculeazaDrum`). e citește rezervările lui d în `cine_are_masina`, deci vine ultima.

**Echilibrul.** Unitatea e o sesiune de agent cap-coadă: M ≈ 0,5, L ≈ 1, XL ≈ 2.
T1 = 1 + 0,5 + 1 = 2,5; T2 = 2 + 1 = 3; T3 = 1 + 1 + 1 = 3. Poarta T3 → T2 cade natural:
F12d se termină după ~2 unități, cam când se termină F12b. Drumul critic e de ~3 unități, plus
confirmările de producție.

### 1.4 Cine face ce

Miro a cerut explicit agenți. CLAUDE.md spune „niciodată un fan-out de implementare”, iar memoria
are două lecții: 6 agenți paraleli au dat 91 de erori din căi de import inventate, iar agenții de
construcție au murit la limita de sesiune. Compromisul (decizia I-T8):

- **Un agent pe traseu, nu unul pe extensie.** În traseu, extensiile merg serial: un commit pe
  extensie, în worktree-ul traseului. Fără fan-out în interiorul traseului.
- **Modelul se pune explicit la fiecare dispatch**: sonnet cu efort înalt sau opus, niciodată
  haiku (memoria „Fără haiku la implementare”).
- **Agenții nu au voie:** la nicio unealtă `mcp__*` (memoria „Workflow blocat pe aprobare MCP”:
  agentul stă ~2 h pe un prompt nevăzut), la `git push`, la `pnpm build`, la baza din cloud.
- **Bancul rulează din worktree-ul traseului:** `bash .claude/skills/administrativo/scripts/banc-migrare.sh`,
  cu cwd = worktree. Scriptul citește `supabase/migrations/` relativ; pornit din `/srv/apps/ERP`,
  ar testa migrările altcuiva. Rulările paralele nu se ciocnesc: containerul are PID-ul în nume,
  iar portul e căutat liber în 55432–55452.
- **Orchestratorul** (sesiunea principală) integrează fiecare extensie:
  1. `git merge` (nu rebase) din worktree în `main`;
  2. rezolvă conflictele din registrele comune (§2);
  3. regenerează `database.ts` din bancul cu TOATE migrările îmbinate;
  4. rulează `pnpm typecheck && pnpm check:server && pnpm lint && pnpm test`, cu ieșirea arătată
     și **durata verificată** (memoria „Workflow verde prin sărire”: sub 30 s = a sărit). Nu pune
     `| tail` în lanțul `&&` (memoria „Pipe-ul înghite codul”);
  5. rulează probele SQL noi + `tests/rls/izolare.sql` pe banc, skill-ul `administrativo-proba-reala`
     și `erp-santinela-tenant`;
  6. **cere confirmarea lui Miro pentru migrare înainte de push** (B1), apoi face push.
- **Între două extensii**, agentul traseului face `git merge main` în worktree. Așa vede ce au
  livrat celelalte trasee (obligatoriu înainte de F12g, F12h, F12e).

---

## 2. Fișierele comune și cum se evită conflictele

### 2.1 Registrele: append-only, cu marcaje

| Fișier | Cine îl atinge | Regula |
|---|---|---|
| `src/types/database.ts` | a, b, c, d, f, h | **Nu se îmbină niciodată de mână.** La conflict se ia oricare parte, apoi se regenerează din bancul local cu toate migrările îmbinate și se reaplică cele două patch-uri manuale. |
| `tests/rls/izolare.sql`, verificarea `(l)` | a, b, c, d, f, h | Fiecare extensie adaugă UN bloc la finalul lui `(l)`, încadrat de `-- ── (l) F12x: <tema> ──` / `-- ── sfârșit (l) F12x ──`. La conflict se păstrează ambele blocuri, în ordinea literelor. |
| `.claude/docs/modul/flota.md` | toate opt | Pagina are **12 203 octeți**, la 85 de octeți sub plafonul dur de 12 KB (`.claude/docs/meta/conventii.md`: țintă 8 KB). Opt secțiuni noi n-ar încăpea. **Fiecare extensie își scrie subpagina** `.claude/docs/modul/flota/<slug>.md` (precedent: `flota/documente-si-erori.md`, `mentenanta/*.md`), cu `cai:` pe fișierele ei. `flota.md` primește doar o linie într-o listă „Extensii”, ordonată după literă. Sluguri: `bon-ocr`, `carduri`, `proces-verbal`, `rezervari`, `uit`, `export-contabil`, `iesire`. F12e scrie în `asistent.md`. |
| `.claude/docs/modul/asistent.md` | a (un paragraf despre `viziune.ts`), e (secțiunea uneltelor) | Pe trasee diferite: fiecare adaugă paragraful lui, în secțiuni diferite. |
| `src/config/porti-ruta.ts`, `src/config/file-module.ts`, `src/lib/audit/etichete.ts`, `src/lib/audit/rute.ts` | b, d | Intrări noi ca blocuri contigue, cu un comentariu `// F12b` sau `// F12d`. Conflictul e append–append: se păstrează ambele. |
| `src/lib/queries/coloane.test.ts` | d, f | Idem. |
| `src/content/landing/fise-module.ts`, `matrice-roluri.ts` | c, d, e (opțional), f (D-f7) | **Nu în trasee.** Orchestratorul le scrie la final, într-un singur commit, după producție (specificațiile spun deja „după producție”). |
| `NOTES.md` (valorile ⚠) | h (cere o intrare), restul implicit | Orchestratorul adaugă la final un singur bloc „F12 — de confirmat de contabil/jurist”, din §5 al acestui README. Agenții nu scriu în NOTES.md. |

### 2.2 Fișierele de cod comune

| Fișier | Cine | Pe același traseu? | Regula |
|---|---|---|---|
| `flota/erori.ts` (+ test), `schemas/fleet.ts`, `queries/fleet.ts`, `foi/[id]/page.tsx`, portal `masina-mea/foi/[id]/page.tsx` | a, f (+ h: doar comentariul din `schemas/fleet.ts:198-212`) | a, f: da (T1) | Serial în T1. Comentariul lui h e într-o zonă disjunctă. |
| `flota/aprobari/page.tsx` | f (pastila „fără UIT”), a (§8.12, „Diferă de bon”, dacă afișarea e și în coadă) | da (T1) | Serial. |
| `flota/actions.ts` | a (`adaugaAlimentare`), c (`alocaVehicul` întoarce și id-ul alocării închise) | nu | Funcții diferite, regiuni diferite. Conflict improbabil; dacă apare, se îmbină de mână. |
| `flota/[id]/page.tsx` | c, d, h; b opțional | c, d: T3; h: T2 după d | **Regula de o linie:** fiecare extensie adaugă în pagină doar un import și un element `<SectiuneX …/>` / o coloană. Logica stă în fișiere proprii (`celula-pv.tsx`, `dialog-pv.tsx`, secțiunea de rezervări, `iesire/sectiune-iesire.tsx`). Modificarea opțională a lui b (§8.7) se amână după h sau se sare. |
| `portal/masina-mea/page.tsx` | c, d, e; b opțional | c, d, e: T3 | Serial în T3. Partea opțională a lui b, după T3, sau deloc. |
| `src/lib/asistent/destinatii.ts`, `unelte/*` | d, e | T3 | Serial. |
| `src/lib/asistent/openrouter.ts` | a (doar `export` pe `ENDPOINT_OPENROUTER`) | — | Nimeni altcineva. |
| `src/app/api/export/flota/route.ts` (F8) | f (opțional, coloana UIT), g (D-g8: jurnalul în ZIP) | T1 | Serial. |
| `src/app/(app)/flota/setari/*` (F5) | d (trei câmpuri); g doar la D-g1 = b | — | g după d (T3 se termină înaintea lui g sau în paralel; dacă se ciocnesc, câmpuri disjuncte). |
| `src/config/env.ts`, `.env.example`, **`docker-stack.yml`** | a | — | `OPENROUTER_MODEL_VIZIUNE` trebuie listată în `docker-stack.yml`, altfel nu ajunge în container (memoria „Timerul systemd…”). Atenție la linia nouă finală la orice `>>`. |
| `src/lib/import/excel.ts` | b | — | Opțiune nouă, implicit neschimbat. |
| `src/lib/documents/cale.ts` | b (condiționat de F6), c (doar sub-commitul 8.8) | nu | c pune scanul sub `{org}/vehicles/{vehicle_id}/…` (D-c5), deci folosește constructorul adăugat de b, dacă există. Altfel 8.8 se amână. |

### 2.3 Obiectele de bază comune

| Obiect | Cine | Regula |
|---|---|---|
| `app.poate_vedea_expirabil` (rescriere integrală) | F7, F9, F11, apoi **b**, apoi **h** | Doar pe T2, serial. Fiecare rescriere pornește de la **forma ultimă de pe disc după `git merge main`**, cu garda „fiecare `entity_type` din `expirables` apare în corp”. |
| `internal.conformitate_zilnica`, lista albă | F5, apoi b (`fuel_card`, condiționat), apoi h (`vehicle_exit`) | Doar pe T2, serial. Memento-ul de rezervare (D-d7) vine mai târziu, după T2. |
| Triggere pe `vehicles` | b `carduri_resincronizeaza_vehicul` (AFTER), d `vehicles_rezervari_la_iesire` (AFTER), h `vehicles_iesire_garda` (BEFORE) + `vehicles_iesire_dupa` (AFTER) | Nume distincte. `vehicles_iesire_garda` sortează înaintea lui `vehicles_normalizeaza`, deci garda răspunde prima. h vine după b și d și le actualizează probele (1.3). |
| Triggere pe `vehicle_assignments` | c (UPDATE de km la finalizarea PV-ului), d `alocari_rezervari` (BEFORE INSERT), h (închide alocarea la ieșire) | `alocari_inainte` < `alocari_rezervari` alfabetic: garda F2 rămâne prima. h după d și c. |
| `trip_sheets` | d: coloana `vehicle_reservation_id` + `foi_parcurs_rezervare` (BEFORE) | Doar d. h citește `trip_sheets.data` (F4). |
| `trip_sheet_curse` | f: coloana `e_transport` + `curse_sterge_uit` (AFTER UPDATE OF deleted_at) | Doar f scrie. e citește. |
| `fuel_entries` | a: `cui_statie`, `ocr_propunere`, `alimentari_ocr_garda` (BEFORE, după `alimentari_inainte`) | Doar a. b are FK spre ea, iar g citește `cui_statie`. **b NU creează `cui_statie`** (verificat: zero `alter table` în F12b), deci clauza de coliziune din F12a §7 nu se activează. |
| `fleet_settings` | d: trei coloane | Doar d în F12, până la D-T1. |
| `notifications` (inserturi din trigger) | c, d | Forma rândului vine din F5; ambele citesc forma de pe disc. |
| Registrul (`internal.inregistreaza_document`, `document_sequences`) | c | Doar c. `registru_config_surse` nu se rescrie. |
| `role_permissions` (seed) + `src/config/permissions.ts` | d (`vehicle_reservations:*`) | Doar d. |

### 2.4 Corecturi de coordonare găsite la citire

Toate cinci sunt scrise și în specificații, în secțiunea finală „Coordonare F12”.

1. **F12c și F12f puneau acțiunile în `flota/actions-pv.ts` și `flota/actions-uit.ts`.**
   Uneltele proiectului recunosc Server Actions doar după numele `actions.ts`. Verificat pe `main`:
   - `audit-actiuni.mjs:38`: `intrare === "actions.ts"`;
   - ESLint, `eslint.config.mjs:99`: `src/**/actions.ts`;
   - garda demo, `eslint.config.mjs:219`: `**/actions`.

   Raționamentul e cel din F12d, decizia 12. Corectura:
   - F12c: `src/app/(app)/flota/[id]/pv/actions.ts` și `flota/[id]/pv/erori.ts` (ca F12h, `flota/[id]/iesire/`);
   - F12f: `src/app/(app)/flota/foi/uit/actions.ts`. `traduEroareUit` rămâne în `flota/erori.ts`, pe T1.
2. **F12g nu exclude cheltuielile create din tranzacțiile de card.** Dacă b primește „da” la
   D-b4 (`treceLaCheltuieli` → `vehicle_expenses`), g le-ar pune în note. Factura emitentului de
   card vine însă prin SPV, deci cheltuiala ar apărea de două ori. Corectura: g tratează
   `vehicle_expenses` referite de `fuel_card_transactions.vehicle_expense_id` ca pe alimentările
   potrivite cu cardul: doar în jurnal, cu motivul „plătit cu cardul de flotă; factura vine prin
   SPV” (decizia I-T4).
3. **Migrarea condiționată a lui F12g** (D-g1 = b) primește numărul fix **0216**, nu „cel mai mare
   liber”.
4. **Vault:** subpagini în loc de secțiuni noi în `flota.md` (2.1).
5. **Rezumatele vs. textul.** Corpul specificației e autoritatea:
   - la F12a, rezumatul spune `flota/actions-bon.ts`, un trigger `alimentari_ocr_neschimbat` și
     un index `fuel_cui_bon_idx`. Textul (§7, §8.6, D18) are `flota/bon/actions.ts`, triggerul
     `alimentari_ocr_garda` și **niciun index nou**;
   - la F12d, rezumatul spune `actions-rezervari.ts`; textul are `flota/rezervari/actions.ts` și
     `flota/rezervari/erori.ts`.

### 2.5 Completitudinea specificațiilor

Toate opt au secțiunile cerute:
- Scop; De ce; Dependențe; Fapte externe cu sursă și grad de certitudine;
- Decizii luate; Decizii pentru Miro;
- Migrarea, sau „Niciuna” cu motiv (e, g);
- Cod cu fișierele; Teste: unitare, probă SQL, verificarea fazei;
- Cazuri-limită; Ce NU se face; Riscuri; Verificare adversarială cu „Ce rămâne nesigur”.

**Lipsea:** estimarea de mărime, în corpul lui a, b, c, d, f și h. Am completat-o în secțiunea
„Coordonare F12”, împreună cu traseul, poarta de start și corecturile din 2.4.

---

## 3. Numerele de migrare

| Nr. | Fișier | Ext. | Traseu | Trebuie după |
|---|---|---|---|---|
| 0210 | `0210_flota_bon_ocr.sql` | F12a | T1 | 0196–0204 (F3, F4, F6) |
| 0211 | `0211_flota_carduri_combustibil.sql` | F12b | T2 | F7/F9/F11 (`poate_vedea_expirabil`) |
| 0212 | `0212_flota_proces_verbal.sql` | F12c | T3 | F3 |
| 0213 | `0213_flota_rezervari.sql` | F12d | T3 | F5 (`fleet_settings`), 0212 doar ca ordine pe traseu |
| 0214 | `0214_flota_uit_etransport.sql` | F12f | T1 | F4 (`trip_sheet_curse`) |
| 0215 | `0215_flota_iesire_din_parc.sql` | F12h | T2 | **0211 și 0213** (dependență reală) |
| 0216 | `0216_flota_conturi_export.sql` | F12g | T1 | doar dacă D-g1 = b |
| 0217–0219 | libere | — | — | rezervate reparațiilor forward-only (memoria „Revizuirea de securitate vine după push”: repararea intră în migrarea următoare, nu în cea aplicată) |

F12e nu are migrare.

- **Ordinea lexicală respectă toate dependențele reale:** 0211 < 0215 și 0213 < 0215. Celelalte
  sunt independente între ele, așa că sosirea pe producție în altă ordine decât cea lexicală (de
  exemplu 0214 înaintea lui 0210, dacă F12f trece primul) nu schimbă rezultatul. Bancul le aplică
  oricum lexical, pe o bază goală.
- **Înainte de fiecare merge, coliziunile:** `ls supabase/migrations | grep '^021'` pe `main`, plus
  registrul `internal.migrari_aplicate` citit de orchestrator prin `psql` (nu MCP). La coliziune,
  se mută migrarea F12 (e a noastră) pe următorul număr liber din 0216–0219, iar referințele din
  specificație și din comentariile migrării se actualizează în același commit.
- **Fiecare migrare cere confirmarea lui Miro înainte de push-ul care o duce pe `main`**: staging
  o aplică pe baza comună în câteva minute (memoria „Staging aplică migrările pe prod”).

---

## 0. Deciziile luate de Miro (12 oct 2026, 14:05) — ÎNCHID cele patru decizii blocante

1. **Migrările (B1): un lot la final.** Agenții nu împing niciodată pe main. Orchestratorul strânge
   F3–F11, mentenanța și F12 pe ramura de integrare, apoi prezintă fiecare migrare (rezumat + sha256),
   iar Miro dă câte un „da” pe fiecare, într-o singură sesiune. Abia după aceea vine push-ul.
2. **OCR pe bon (B2): da, cu ZDR, pe modulul asistent.** (i) Funcția există doar la firmele cu modulul
   asistent activ (comutatorul îl pune platforma); (ii) `provider.zdr: true`, fără `temperature`;
   (iii) se acceptă endpoint-urile Vertex global din afara UE, pe SCC, ca la chat. Avizul juristului pe
   acordul cu clientul se cere ÎNAINTE de livrare, iar apelul real pe staging (R4) e obligatoriu.
3. **HR care conduce (B3, F12c D9): da, ramură îngustă „doar ce e al lui”.** Omul fără `vehicles:read`
   vede PV-urile la care e parte și vehiculul alocat LUI („Mașina mea”), nimic din restul parcului.
   E o abatere asumată de la decizia 3 din 7 oct. Se face în 0212, cu probă pozitivă și negativă pe hr.
4. **Exportul Saga/WinMentor (B4, F12g D7): livrat complet, etichetat „verificat pe documentație,
   neîncercat”**, fără promisiune comercială. Un contabil îl importă într-o bază de test înainte de
   primul client.

Implicită confirmată (F3): `super_admin` nu întocmește foi de parcurs în firmele-client (nu e în
`organization_members`, prin design). Celelalte 67 de implicite din §4 se aplică așa cum sunt scrise.

## 4. Deciziile pentru Miro (deduplicate)

Specificațiile pun **72 de întrebări**. Șase dintre ele au fost contopite în trei decizii
comune: B2 (a M1, M3, M7), I-T2 (f D1, f D2, c D3), I-T3 (h D4, D8) și I-T6 (h D9, e D7). Din
compararea specificațiilor au apărut **patru decizii noi**: B1, I-T4, I-T5 și I-T8. I-T1 adună
cinci întrebări despre `fleet_settings`, care rămân și la extensia lor.

Rezultă **71 de decizii**:
- **4 blocante (B1–B4)**: fără răspuns, extensia respectivă nu pornește sau nu se declară gata;
- **67 cu implicită rezonabilă (I-…)**: agentul implementează implicita. O schimbare ulterioară
  costă o migrare mică sau o modificare de cod, fără date pierdute.

„Toate cele opt extensii intră acum” nu mai e o decizie: ai cerut-o explicit.

Numerotarea locală a specificațiilor (M1, D3…) e trecută în paranteză.

### 4.1 Blocante

**B1. Confirmarea pe producție a fiecărei migrări (0210–0215, eventual 0216).**
- Opțiuni: (a) confirmare separată la fiecare push, cerută de orchestrator împreună cu diff-ul
  migrării și ieșirea bancului; (b) un singur push la final, cu câte un „da” pentru fiecare
  migrare din lot.
- **Recomandare: (a).** Un „da” anterior nu acoperă o migrare nouă (CLAUDE.md). Agenții nu împing
  niciodată.

**B2. F12a: fotografiile bonurilor pleacă la terți (OpenRouter → Google).** Întrebarea are trei
părți (a M1, M3, M7):
- (i) ce pornește OCR-ul: modulul `asistent`, pus de platformă / un steag `fleet_settings.ocr_bonuri_activ`
  pus de firmă / mereu;
- (ii) ZDR obligatoriu (`provider.zdr: true`);
- (iii) endpoint-urile Vertex `global`, în afara listei UE, acoperite de SCC.

**Recomandare: (i) modulul `asistent`, (ii) da, (iii) acceptat, ca la bula de azi.** Fiecare
cu ⚠ jurist: acordul cu clientul descrie probabil asistentul ca chat, nu ca prelucrare de
fotografii, iar comutatorul îl pune platforma, nu firma. Dacă alegi (i) = steagul per firmă,
F12a cere o coloană nouă în `fleet_settings` și un câmp în `/flota/setari`.

Până la răspuns, T1 începe cu F12f. Chiar cu „da”, R4 rămâne obligatoriu înainte de livrare: un
apel real pe staging, cu cheia, ca să se confirme ruta ZDR.

**B3. F12c: omul care conduce, dar are un rol fără `vehicles:read` (de regulă `hr`) și e parte
la PV** (c D9; aceeași gaură o are „Mașina mea” din F3).
- (a) Acceptat: semnează doar pe hârtie. Triggerul nu-i trimite notificare.
- (b) Politicile `select`/`update` primesc o ramură „ești parte la PV”
  (`app.current_employee_id(org) in (predator, primitor)`), fără să-i deschidă parcul.

**Recomandare: (b).** E o abatere de la decizia ta 3 („HR nu vede parcul”), deci nu se ia tacit.
Alegerea schimbă RLS-ul din 0212.

**B4. F12g: cum se declară „gata”, când formatele nu pot fi încercate fără Saga sau WinMentor**
(g D7).
- (a) Livrat cu eticheta „verificat pe documentație, neîncercat într-un import real”. Marketingul
  nu promite nimic până la primul import reușit. Înainte de primul client, un contabil importă
  fișierele într-o bază de test (~5 minute).
- (b) Livrat ca orice altceva.
- (c) Doar g1 (jurnalul și articolele CSV), iar g2 (ZIP-urile WinMentor/Saga) abia după
  acceptanță.

**Recomandare: (a).** Plus numele contabilului care face acceptanța: blochează declararea, nu
codul.

### 4.2 Cu implicită

**Transversale (apar în mai multe specificații sau între ele)**

| # | Întrebarea | Implicita |
|---|---|---|
| I-T1 | Setările noi per firmă în `fleet_settings`: OCR activ (a M1b), UIT vizibil (f D3c), conturile de export (g D1b), termenul RCA (h D3), memento-ul de rezervare (d D7). Acum sau la cerere? | La cerere. Acum intră doar cele trei coloane de rezervări din F12d, fără de care d nu merge. |
| I-T2 | Avertizează sau blochează? UIT expirat (f D1), cursă e-Transport fără UIT (f D2), PV lipsă la predare (c D3), bon dublat (a D18), avertismentele OCR (a D9). | Avertizează peste tot. Baza refuză doar ce e imposibil: formatul UIT, suprapunerile, imuabilitatea. |
| I-T3 | Termenele de ieșire bazate pe o interpretare: „Obligație legală” sau „Recomandat”? (h D4: impozitul pe anul dobândirii; h D8: declarația la vânzare) | „Recomandat”, cu ⚠, până confirmă contabilul. |
| I-T4 | **(nou)** Cheltuielile plătite cu cardul de flotă intră în notele contabile? Interacțiunea b D4 × g D2. | Nu. Doar în jurnal, cu motivul „factura emitentului vine prin SPV”. Se aplică alimentărilor potrivite și cheltuielilor create din tranzacții (2.4 pct. 2). |
| I-T5 | **(nou)** Ieșirea din parc închide alocarea deschisă fără PV de restituire (h × c). | Nu se blochează. Secțiunea de ieșire arată „Întocmește PV de restituire” când alocarea închisă n-are PV, iar semnalul „Fără PV” rămâne. |
| I-T6 | **(nou, din h D9 și e D7)** Ce vede asistentul AI din ieșiri și din curse? | F12e nu expune `vehicle_exits`. Textele uneltelor nu conțin locurile curselor, doar intervalul orar și numărul foii (e D7 a). |
| I-T7 | Retenția: tranzacțiile de card (b D8), propunerile OCR. | Nicio ștergere automată. Ștergerea rămâne logică până la răspunsul juristului și al contabilului. |
| I-T8 | Execuția cu agenți (cererea ta) față de „fără fan-out” din CLAUDE.md. | 3 agenți, câte unul pe traseu, serial în interiorul traseului, cu modelul explicit (sonnet efort înalt sau opus), fără `mcp__*`, push sau build. Integrează orchestratorul (§1.4). |

**F12a**

| # | Întrebarea | Implicita |
|---|---|---|
| I-a1 (M2) | Se păstrează ce a citit AI-ul lângă alimentare? | (c) În `ocr_propunere`, scrisă doar de server în context de serviciu, imuabilă după scriere. Pastila „Necitit” pe alimentările cu poză, dar fără propunere, NU intră implicit: e o linie de UI, la cerere. |
| I-a2 (M4) | Limitele de rată | 20 pe oră pe om, 300 pe zi pe firmă, 30 pe minut global. |
| I-a3 (M5) | Poză HEIC pe Chrome, Firefox sau Edge | (a) Mesaj cu pașii de conversie, fără bibliotecă WASM. |
| I-a4 (M6) | Avertismentul de preț pe litru, între 4 și 12 lei | Se păstrează, ca avertisment: prinde virgula citită greșit. |

**F12b**

| # | Întrebarea | Implicita |
|---|---|---|
| I-b1 (D1) | Presetările pe emitent | Livrate necalibrate, cu mapare manuală salvată per firmă. Se cere un extras anonimizat primului client. |
| I-b2 (D2) | Tranzacție găsită pe o foaie în lucru, fără alimentare | Până la răspuns, doar raport. `adaugaPeFoaie` (recomandarea c, [DECIZIA-2c]) nu intră. |
| I-b3 (D3) | Cine vede tranzacțiile | Până la răspuns, doar `vehicles:read=all`. Clauza 3b (și managerul, și șoferul, read-only, pe foile vizibile) intră după „da”. Atenție: managerul ar vedea atunci și `nota` administratorului. |
| I-b4 (D4) | Tranzacțiile care nu sunt combustibil | Până la răspuns, raport (a). „Trece la cheltuieli” (c) intră după „da” și după F7; vezi I-T4. |
| I-b5 (D5) | Toleranța de potrivire | ±0,5 L sau ±1% și ±3 h, constante în domeniu. |
| I-b6 (D6) | AdBlue | Categoria `necombustibil`. Altfel ar umfla consumul de pe foaie. |
| I-b7 (D7) | Cardurile mașinilor de pool | Vizibile celor care văd vehiculul: ultimele cifre și emitentul. Tranzacțiile rămân închise. |

**F12c**

| # | Întrebarea | Implicita |
|---|---|---|
| I-c1 (D1) | Confirmarea din portal ține loc de semnătură? | (a) Doar completează hârtia semnată (⚠ jurist). |
| I-c2 (D2) | Prefixul numărului | `PVA-2026-0001`. |
| I-c3 (D4) | Rubricile de semnătură la transferul A → B | Trei: predător, primitor, reprezentantul firmei. |
| I-c4 (D5) | Scanul PV-ului semnat | Doar dacă F6 a livrat calea pe `vehicles/{vehicle_id}/…`; altfel sub-commitul 8.8 se amână. |
| I-c5 (D6) | Fotografiile daunelor | Nu în F12c. |
| I-c6 (D7) | Tipul de registru | Același `pv_predare_primire` ca inventarul. |
| I-c7 (D8) | PV întocmit după predare | Ambele date pe PDF („Data predării” / „Întocmit la”), cu avertisment pe ecran la peste o zi diferență (⚠ contabil). |

**F12d**

| # | Întrebarea | Implicita |
|---|---|---|
| I-d1 (D1) | Rezervare pe zile sau pe ore | Zile întregi. |
| I-d2 (D2) | Cine aprobă | Managerul direct și responsabilii de flotă; decide primul care apucă. |
| I-d3 (D3) | Setarea „rezervarea e obligatorie pe pool” | Există, oprită implicit. |
| I-d4 (D4) | Managerul rezervă pentru subordonați? | Nu: `create = own`. |
| I-d5 (D5) | Durata maximă | 14 zile, configurabilă între 1 și 92. |
| I-d6 (D6) | Alocare nouă peste rezervarea altcuiva | Refuz P0001, cu instrucțiunea de anulare. |
| I-d7 (D7) | Memento în ziua dinainte | Mai târziu, după T2 (atinge F5). |
| I-d8 (D8) | Cererea rămasă nedecisă după ultima zi | Rămâne `ceruta`, afișată „Expirată nedecisă”. |
| I-d9 (D9) | Rezervarea proprie a celui cu `approve=all`, când firma cere aprobare | Se confirmă direct. E o excepție de la 0016 (foile), notată. |
| I-d10 (D10) | Vehicul scos din pool, vândut sau casat, cu rezervări viitoare | Anulare automată, cu notificare `warning`. |
| I-d11 (nesigur 7) | Responsabil de flotă cu rol `employee`: n-are unde aproba | Aprobă doar din aplicația mare: un responsabil care trebuie să aprobe are nevoie de rol `manager` sau `org_admin`. Coada „De aprobat” în portal vine doar la cerere. |

**F12e**

| # | Întrebarea | Implicita |
|---|---|---|
| I-e1 (D1) | `vehicule_fara_foi` și pentru manager? | Nu: doar `all`/`all`. |
| I-e2 (D2) | Mențiunea de regim fiscal (după F10) | (b) O propoziție neutră, cu temei și fără verdict (⚠ formularea, de validat cu contabilul). |
| I-e3 (D3) | `scadente_soferi` pentru HR | Da, unealtă separată, după F9. |
| I-e4 (D4) | `cine_are_masina` pe o dată din trecut | Da, orice zi trecută, plus `ora` opțională. |
| I-e5 (D5) | Parametrul `vehicul` pe caseta din portal | F12e îl adaugă, dacă F3 nu l-a pus deja. |
| I-e6 (D6) | Consumul se calculează pe care foi? | Doar pe cele aprobate. Cele trimise se pomenesc separat. |
| I-e7 (D8) | `cine_are_masina` pentru `employee` | Nu: rămâne `team`. |

**F12f**

| # | Întrebarea | Implicita |
|---|---|---|
| I-f1 (D3) | Unde apare secțiunea UIT | Pe vehiculele cu masa maximă ≥ 2.500 kg sau necunoscută, plus pe orice cursă care are deja UIT. |
| I-f2 (D4) | UIT uitat pe o foaie aprobată | Nu se mai adaugă: foaia e înghețată. |
| I-f3 (D5) | Corectarea automată O→0, I→1, Z→2, S→5, G→6, B→8 | Da. Codul corectat se afișează înainte de salvare. |
| I-f4 (D6) | Cifrele de control greșite | Refuz în bază (CHECK) și în client. Riscul asumat: dacă ANAF schimbă algoritmul, trebuie o migrare nouă. |
| I-f5 (D7) | Marketingul | Doar „păstrează și verifică codul UIT”. Niciodată „conform e-Transport”. |
| I-f6 (D8) | Cine trece UIT-ul pe foaia altcuiva | Doar șoferul și `org_admin`. |

**F12g**

| # | Întrebarea | Implicita |
|---|---|---|
| I-g1 (D1) | Unde se țin conturile | În formular, ținute minte în browser. Migrarea 0216 vine abia când un contabil confirmă maparea. |
| I-g2 (D2) | Facturile de service intră în note? | Nu, doar în jurnal: vin prin SPV. |
| I-g3 (D3) | Vehiculul fără regim fiscal declarat | `limitat_50`, cu avertisment (⚠ contabil). |
| I-g4 (D4) | Bonul fără CIF-ul firmei | Proxy: `cui_statie` gol ⇒ TVA nedeductibil, cu avertisment (⚠ contabil), până la o bifă „CIF pe bon”. |
| I-g5 (D5) | Foile neaprobate | Excluse, cu bifa „include și neaprobatele”. |
| I-g6 (D6) | Număr în registrul de documente pentru export | Nu. |
| I-g7 (D8) | Jurnalul în ZIP-ul lunar din F8 | Da, doar `jurnal_csv`, cu conturile marcate „propuse”. |
| I-g8 (D9) | Conturile implicite | Cele din §8.2: 6022, 611, 6024, 628, 635, 6588, 4426, 542, toate ⚠. |
| I-g9 (D10) | Plata bonurilor importate prin XML în Saga | `P_<data>.xml` cu plățile, în același ZIP (⚠ structura e din manual, neîncercată). |
| I-g10 (D11) | Numele șoferului în fișiere | Doar în `jurnal_csv`. Nu intră în explicațiile importate în programul de contabilitate. |
| I-g11 (D12) | Alimentările în străinătate | Un avertisment fix în jurnal. Toate bonurile sunt tratate ca românești. |

**F12h**

| # | Întrebarea | Implicita |
|---|---|---|
| I-h1 (D1) | Statusuri noi pentru vehicul? | Nu. Rămân `vandut`/`casat`, iar tipul ieșirii se vede pe pastilă. |
| I-h2 (D2) | Numărul și VIN-ul unui vehicul ieșit | Se eliberează: indexurile unice exclud vehiculele ieșite (§9). |
| I-h3 (D3) | Termenul intern pentru notificarea RCA/CASCO | 5 zile calendaristice, constantă în SQL. |
| I-h4 (D5) | Copia conformă ARR | În afara F12h. |
| I-h5 (D6) | Cumpărătorul | Text liber opțional, fără CNP, în afara allow-list-ului de audit. |
| I-h6 (D7) | Șoferul și managerul văd ieșirea? | Nu, doar cine are `vehicles:read=all`. |

---

## 5. Faptele ⚠ care cer contabil sau jurist

**Contabil**

1. F12a E24: un bon fiscal cu CIF-ul cumpărătorului, sub 100 €, ține loc de factură simplificată
   (normele HG 1/2016, necitite). Din cauza asta nu se avertizează pe CIF lipsă.
2. F12a E22: elementele obligatorii ale bonului (OUG 28/1999 art. 4). Doar din surse secundare,
   folosite numai în prompt.
3. F12b: Legea 82/1991 art. 25 (10 ani) pentru extrasele de card, nereverificat pe text. Rămân
   de stabilit și: cursul BNR la tranzacțiile în valută; faptul că extrasul NU e document de
   deducere, ci factura emitentului.
4. F12c: dacă OMFP 2634/2015 (E3, E4, E16) se aplică unui PV intern de încredințare. Formularea
   cu două date (D8: „antedatarea”). Ordinul 217/1996 art. 8–9 și Legea 82/1991 art. 25, preluate
   din cod, nereverificate.
5. F12d: consecința fiscală a pool-ului fără uz personal (HG 1/2016 titlul VII pct. 68 alin. 4).
   Rezervarea nu e document justificativ; documentul rămâne foaia.
6. F12e D2: formularea neutră despre regimul fiscal (HG 1/2016 titlul II pct. 16 alin. 2).
7. F12f: posibile modificări ale OUG 41/2022 după consolidarea din 24.04.2025. Ziua de început
   se numără în valabilitate (interpretare). Algoritmul cifrelor de control vine din Schematron-ul
   ANAF, nu din lege. HG 1/2016 pct. 16 și 68 + OMFP 2634/2015 (UIT nu e element obligatoriu al
   foii), nereverificate în F12f.
8. F12g, fiscal și contabil:
   - conturile implicite;
   - cota de TVA pe rovinietă și peaj;
   - TVA-ul nedeductibil pe cheltuială sau pe 635;
   - proxy-ul `cui_statie` gol ⇒ nedeductibil;
   - regimul implicit `limitat_50`;
   - ordinul MFP din art. 319 alin. (13) (bonuri între 100 și 400 €), necitit;
   - OMFP 1802/2014, citit în forma inițială;
   - plus acceptanța formatelor Saga/WinMentor (B4).
9. F12h:
   - art. 471 alin. (5) aplicat la vânzare (interpretare);
   - calculul din alin. (1^1) introdus de OUG 7/2026;
   - consolidarea Codului de procedură fiscală (art. 159);
   - intrarea în vigoare a OMAI 181/2024 (presupusă la publicare);
   - cine notifică asigurătorul RCA la restituirea din leasing;
   - contabilitatea ieșirii (casare, amortizare, TVA la vânzare), în afara F12h.

**Jurist**

1. F12a:
   - DPA și sub-împuterniciții OpenRouter și Google (GDPR art. 28, E25 necitit);
   - transferul în afara SEE pe SCC (M7);
   - acordul cu clientul acoperă fotografii, nu doar chat (D3);
   - comutatorul îl pune platforma, nu firma (M1). Toate patru fac parte din B2.
2. F12b: temeiul și retenția tranzacțiilor de card. Ele leagă un șofer identificat de un loc și o
   oră, deci intră minimizarea (GDPR art. 5).
3. F12c:
   - valoarea confirmării din portal (Legea 214/2024 art. 4 alin. 9 lit. b, art. 5 alin. 3–4);
   - formula de semnare din PDF;
   - varianta „înlocuiește semnătura” cere o procedură internă scrisă.
4. F12d: minimizarea datelor din rezervări. Faptul că nu există o obligație legală de registru e
   o afirmație negativă, nedemonstrată.
5. F12e:
   - localizarea curselor trimisă la terți (Legea 190/2018 art. 5, nerecitită);
   - CNP-ul pe permis (§11), neverificat.
6. F12f: textul de marketing; niciodată „conform e-Transport”.
7. F12g: numele șoferului ajunge la un contabil care e adesea o firmă externă (destinatar,
   eventual împuternicit).
8. F12h: numele cumpărătorului persoană fizică e dată personală. Expunerea lui în asistent e
   exclusă (I-T6).

**De corectat pe `main` (în afara F12, semnalat de specificații)**
- `NOTES.md:329`: eticheta pentru `DetaliiDocument/212504` e greșită. Nu e cea mai nouă formă a
  HG 1/2016; ultima consolidare citită e `307847`, din 31.03.2026 (F12e).
- Garda din `0023:89` are același defect de spațiere pe care F12h îl evită în §6. E datorie
  preexistentă, nereparată.

---

## 6. Mărimea

| Ext. | Mărime | Sesiuni de agent | Migrare | Probă SQL nouă | Intrări în lista de fișiere |
|---|---|---|---|---|---|
| F12a | L | 1 | 0210 | `proba-flota-bon-ocr.sql` | ~30 |
| F12b | XL | 2 | 0211 (4 tabele, 4 triggere, rescrierea `poate_vedea_expirabil`) | `proba-flota-carduri.sql` (6+, 11−) | ~37 |
| F12c | L | 1 | 0212 | `proba-flota-pv.sql` (22 de cazuri) | ~27 |
| F12d | L | 1 | 0213 (+ seed de permisiuni) | `proba-flota-rezervari.sql` (20) | ~32 |
| F12e | L | 1 | — | `proba-asistent-flota.sql` | ~27 |
| F12f | M | 0,5 | 0214 | `proba-flota-uit.sql` (8+, 12−) | ~23 |
| F12g | L | 1 | — (0216 condiționată) | `proba-flota-export-contabil.sql` | ~19 + teste |
| F12h | L | 1 | 0215 (+ backfill) | `proba-flota-iesire.sql` (18) | ~24 |
| **Total** | **1 XL + 6 L + 1 M** | **≈ 8,5** | **6 (+1)** | **8** | **~220 (~140 noi)** |

**Estimarea, nu măsurătoarea:** o sesiune ≈ un agent cap-coadă cu lanțul verde, 4–6 ore. Pe trei
trasee, drumul critic e de ~3 sesiuni. La asta se adaugă:
- așteptarea porților între trasee;
- integrarea fiecărei extensii de către orchestrator (~30–45 min: merge, regenerarea tipurilor,
  lanțul, probele, santinela);
- șase confirmări de producție.

Realist: **3–4 zile lucrătoare după ce F3–F11 sunt pe `main`**, plus acceptanța contabilului
pentru F12g (B4), care nu depinde de noi.
