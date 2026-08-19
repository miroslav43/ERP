# Înrolarea companiei — pasul zero

Data: 2026-08-19
Status: aprobat pentru implementare

## Context și decupaj de scop

Promptul original ("Modul de Înrolare Companie") descrie trei bucăți distincte:

1. **Înrolarea propriu-zisă** — un administrator al platformei introduce CUI-ul unei
   firme, confirmă/corectează datele fiscale și creează contul de owner (super-admin
   al companiei). Acesta e "pasul zero": fără el nu există organizație, deci nici
   restul aplicației nu are sens.
2. **Wizard-ul post-login** — conturi bancare, avans/lichidare, valoare tichete de
   masă, puncte de lucru, politică de concediu implicită, furnizori SSM/PSI/medicina
   muncii. Fiecare din acestea atinge un modul deja construit separat (Salarizare,
   Fleet, SSM) și are propriile reguli de business netratate încă.
3. **Autentificare 2FA** — nu există NICIO infrastructură de 2FA în aplicație; e o
   schimbare cross-cutting pentru toți utilizatorii, nu doar pentru owner.

Acest document acoperă **doar punctul 1**. Punctele 2 și 3 rămân spec-uri separate,
brainstormate ulterior, când modulele pe care le ating (Salarizare, Fleet, SSM) sunt
gata să primească setări globale de companie.

## Ce există deja în codebase (constatări din analiză)

- `organizations.cui_normalizat` are deja `UNIQUE` — cerința de unicitate CUI e
  deja satisfăcută.
- `src/domain/organization/cui.ts` validează deja cifra de control CUI, client și
  server, cu aceeași funcție pură.
- Există deja un formular de creare organizație
  (`super-admin/organizatii/nou` + `FormularOrganizatieNoua` + acțiunea
  `creeazaOrganizatie`), dar:
  - nu are CAEN, capital social, stradă/număr/sector separate, funcție/CNP
    reprezentant;
  - **nu creează owner-ul** — doar organizația, în stare `pending`. Owner-ul se
    adaugă separat, dintr-o pagină de membri, prin **invitație pe email cu magic
    link** (fără parolă, fără telefon).
- Pagina "Cereri de demo" are un buton "Creează organizație din această cerere"
  care duce la `organizatii/nou?cerere=<id>` și pre-completează nume/email/telefon
  din cererea de demo. **Acest comportament trebuie păstrat.**
- Convenția de criptare pentru date sensibile (CNP, IBAN) există deja și e solidă:
  AES-GCM cu key versioning, hash pentru deduplicare, `last4` pentru afișare
  mascată (`employee_sensitive_data` + `src/lib/crypto/aes-gcm.ts` +
  `src/lib/crypto/sensitive-data.ts`). O reluăm identic pentru CNP-ul
  reprezentantului legal.
- Clientul `service_role` (`src/lib/supabase/admin.ts`) documentează deja explicit
  că "crearea organizațiilor și a primului org_admin" e cazul de utilizare
  canonic — exact ce construim aici.
- Trigger-ul `internal.handle_new_user()` creează automat rândul din `profiles`
  la orice inserare în `auth.users` (citește `raw_user_meta_data.full_name`) —
  se declanșează și la `admin.auth.admin.createUser()`, nu doar la signup normal.
- `profiles.phone` există deja ca și coloană, dar trigger-ul nu o populează —
  trebuie setată explicit după creare.
- Autentificarea cu parolă există deja (`autentificarePrinParola`,
  `signInWithPassword`), separat de magic link. Pagina `/parola-noua` există deja
  (folosită azi la resetare parolă) și poate fi refolosită neschimbată pentru
  schimbarea obligatorie a parolei temporare.
- Ruta `(app)/onboarding` există deja, dar e modulul de onboarding **al
  angajaților** (checklist-uri HR) — nu are nicio legătură cu înrolarea companiei.
  Noul flux NU trebuie să folosească acest nume de rută.
- Nu există nicăieri un nomenclator CAEN local (denumire după cod) — doar codul se
  stochează.
- API-ul public ANAF (v9, gratuit, fără cheie) **nu oferă capitalul social** —
  acesta vine din Registrul Comerțului, nu din ANAF. Câmpul rămâne mereu
  completare manuală, indiferent de ce răspunde ANAF.

## Decizii confirmate cu utilizatorul

| Întrebare | Decizie |
|---|---|
| Scope faza 1 | Doar înrolarea (ecranele 1-2). Wizard post-login și 2FA — spec-uri separate. |
| API extern pentru CUI | ANAF (public, gratuit, fără cheie). |
| Creare cont owner | Super-adminul platformei setează o parolă temporară (generată de sistem, afișată o singură dată, ca la linkul de invitație actual). |
| Structură adresă | Câmpuri separate: stradă, număr, sector (opțional, doar București). Județ/localitate/cod poștal rămân ca acum. |
| Livrare parolă temporară | Afișată o singură dată super-adminului; owner-ul e obligat să și-o schimbe la primul login. |
| Activare organizație | Automată, la finalul înrolării — NU mai rămâne „pending” ca în fluxul vechi. |
| Formular existent | Se evoluează in-place (nu se creează un flux paralel). |

## Model de date

### `organizations` — coloane noi (toate nullable, nu ating rândurile existente)

```
cod_caen        text            -- 4 cifre; poate lipsi (PFA/II); fără nomenclator local
capital_social  numeric(14,2)   -- mereu manual
strada          text
numar           text
sector          text            -- relevant doar când judet = 'București'
reprezentant_functie text       -- text liber (Administrator, Director General, ...)
```

`adresa` (coloana existentă, text liber) rămâne pentru detalii reziduale (bloc,
etaj, birou) — nu se elimină.

### Tabel nou: `organization_legal_representative`

1:1 cu `organizations`, pe modelul `employee_sensitive_data` (separare de date
sensibile de tabela principală, citită des):

```
organization_id  uuid primary key references organizations(id) on delete cascade
nume             text
functie          text
cnp_ciphertext   bytea
cnp_iv           bytea
cnp_tag          bytea
cnp_key_version  int
cnp_last4        text
created_at / created_by / updated_at / updated_by / deleted_at  -- convenția standard
```

Fără `cnp_hash`: spre deosebire de CNP-ul angajaților, nu impunem unicitate pe CNP-ul
reprezentantului legal (aceeași persoană poate reprezenta legal mai multe firme —
administrator la mai multe SRL-uri e o situație normală în România).

CNP-ul e opțional la înrolare (cerință explicită din prompt) și rămâne editabil
ulterior din fișa organizației — acest tabel separat face exact asta posibil fără
să atingă restul câmpurilor organizației.

### `profiles` — coloană nouă

```
must_change_password boolean not null default false
```

Setată `true` la crearea owner-ului; resetată la `false` când owner-ul își schimbă
parola prin `/parola-noua`.

## Fluxul UI

Rămâne la ruta existentă `super-admin/organizatii/nou`, restructurată în doi pași
în aceeași pagină (state local, nu rute separate) — mai simplu decât un wizard
multi-rută, și păstrează neschimbat prefill-ul din "Cerere de demo".

### Ecranul 1 — doar CUI

- Un singur câmp: CUI. Validare cifră de control client-side (`cui.ts`, deja
  existent), apoi submit.
- Server Action nouă `cautaCuiAnaf` (doar pentru super-admin, rate-limited ca
  restul acțiunilor de platformă) verifică ÎNTÂI dacă CUI-ul normalizat există
  deja într-o organizație (aceeași interogare ca la submit) — dacă da, oprește
  aici cu mesajul „Există deja o organizație cu acest CUI”, ca utilizatorul să
  nu completeze degeaba tot ecranul 2. Abia apoi apelează API-ul public ANAF
  server-side.
- Extragem ce oferă sigur ANAF: denumire, adresă (parsată best-effort în
  componente — utilizatorul corectează în ecranul 2), nr. reg. com., stare
  (activă/radiată — dacă radiată, afișăm avertisment, NU blocăm: poate fi
  eroare temporară ANAF), plătitor TVA. Cod CAEN — dacă lipsește (frecvent la
  PFA/II), rămâne gol pentru completare manuală.
- Eșec/lipsă răspuns ANAF → trecem direct la ecranul 2, complet gol, completare
  100% manuală (fallback cerut explicit în prompt). Niciun caz nu blochează
  utilizatorul la ecranul 1.

### Ecranul 2 — confirmare + cont owner

Extinde formularul actual cu:
- CAEN, capital social, stradă, număr, sector (afișat condiționat de județ);
- funcție reprezentant + CNP (opțional);
- secțiune nouă **„Cont proprietar”**: nume, email de business, telefon.

`reg_com` primește o validare de FORMAT neblocantă (avertisment, nu eroare):
regex permisiv pentru `J../…/….`, `F../…/….`, `C../…/….` — formatul variază
suficient de mult între tipuri de entități încât o validare strictă ar respinge
firme reale. Câmpul rămâne opțional, ca acum.

Fără câmp de parolă în formular — sistemul generează o parolă temporară
(`randomBytes`, ca la tokenul de invitație actual) și o afișează o singură dată
super-adminului, imediat după succes, într-un banner care dispare la navigare
(exact modelul `linkInvitatie` din fluxul de invitație existent).

Fără 2FA — scos explicit din scop.

## Acțiunea de server

`creeazaOrganizatie` din `organizatii/actions.ts` se **redenumește
`inroleazaOrganizatie`** (comportamentul se schimbă fundamental: nu mai creează
doar o organizație goală, ci organizație + reprezentant legal + owner activ).

Pași, în această ordine (motivul ordinii: organizația e ieftin de compensat dacă
pasul de creare user eșuează; un `auth.users` orfan e un cost mai mic de curățat
manual decât un CUI/slug blocat de o organizație fără niciun membru):

1. Validează unicitate CUI + slug (ca acum).
2. Inserează organizația cu `status: 'active'`, `activated_at: now()` (schimbare
   față de fluxul vechi, care rămânea `pending`).
3. Activează modulele `is_core` (ca acum, neschimbat).
4. Dacă CNP-ul reprezentantului a fost introdus, îl criptează și scrie
   `organization_legal_representative` (reține și `nume`/`functie` necriptat).
5. Generează parola temporară; creează owner-ul prin
   `admin.auth.admin.createUser({ email, password, email_confirm: true, phone,
   user_metadata: { full_name } })`.
6. **Dacă pasul 5 eșuează**: șterge rândul din `organizations` inserat la pasul 2
   (compensare) și întoarce eroare de reîncercat. CUI-ul/slug-ul nu rămân
   blocate de o înrolare eșuată pe jumătate.
7. Inserează `organization_members` cu `role: 'org_admin'`, `status: 'active'`,
   fără `invitation_id` (creare directă, nu invitație — trigger-ul de audit
   existent pentru `member_added` nu se aplică, deci scriem auditul explicit,
   ca restul acțiunilor de platformă).
8. Setează `profiles.phone` și `profiles.must_change_password = true` pentru
   userul nou creat (trigger-ul `handle_new_user` nu populează telefonul).
9. Audit: `org_created` (ca acum) — plus intrare separată pentru crearea
   owner-ului, cu allow-list care EXCLUDE parola.

Toate erorile (CUI/slug duplicat, ANAF indisponibil, eșec creare user) folosesc
mesajele și `ActionResult`-ul existent din `createPlatformAction` — fără cod nou
de eroare în afara celor deja gestionate.

## Login owner și schimbare parolă obligatorie

Owner-ul se autentifică normal, cu parolă (`autentificarePrinParola`, neschimbat).
În `(app)/layout.tsx`, în `requireTenant()`, după ce tenantul e rezolvat, se
verifică `profiles.must_change_password`; dacă `true` → `redirect("/parola-noua")`.

Pagina `/parola-noua` rămâne neschimbată în UI (copy-ul generic "Alegeți o parolă
nouă" funcționează la fel de bine pentru "prima parolă" ca pentru "am uitat
parola"). Acțiunea `seteazaParolaNoua` primește un singur adaos: după
`updateUser({password})` reușit, setează `must_change_password = false`.

## Securitate și audit

- Parola temporară nu ajunge NICIODATĂ în `audit_logs` (allow-list explicit,
  ca la toate acțiunile de platformă) și nu se loghează în `console.error` la
  eșec.
- CNP-ul reprezentantului urmează exact regula de aur existentă: valoarea
  decriptată nu ajunge niciodată într-un Server Component, doar mascată
  (`ultimele4`); citirea în clar se face exclusiv dintr-un Server Action explicit.
- `admin.auth.admin.createUser` rulează în `organizatii/actions.ts`, singurul loc
  unde clientul `service_role` e deja permis (ESLint `no-restricted-imports` +
  `server-only` — neschimbate).

## Explicit în afara scopului (spec-uri viitoare)

Conturi bancare (IBAN companie), flag avans/lichidare + zile de plată, valoare
tichete de masă, puncte de lucru, politică de concediu implicită, furnizori
SSM/PSI/medicina muncii, autentificare 2FA. Niciunul din acestea nu se atinge în
această implementare.
