# Înrolare partajată — plan de implementare

> **Fără agenți de implementare** — `CLAUDE.md` o interzice. Se scrie direct, cu `Write`/`Edit`.

**Scop:** super-adminul alege la creare cine completează datele firmei; dacă alege
administratorul, acesta e obligat prin asistent la prima intrare. Pașii 1–7 se navighează liber.

**Spec:** `docs/superpowers/specs/2026-08-22-inrolare-partajata-design.md`

**Cheia designului:** `status = 'pending'` devine „datele firmei nu-s complete". Organizațiile se
creează deja așa, iar `pending` nu blochează astăzi nimic. **Nicio migrare.**

## Constrângeri globale

- Română cu ș/ț cu **virgulă** (U+0219/U+021B). Mesajele de eroare se termină cu punct.
- `pnpm verify` **NU** include `build`; build-ul e singurul care prinde granița server/client.
- pnpm global e 9.x și moare pe acest repo → `./node_modules/.bin/…`.
- Publicarea se face din **worktree curat pe HEAD** (sesiune paralelă activă) — vezi `DEPLOY.md`.
- `createAdminSupabase()` doar în `actions.ts` / `api/**` / `scripts/**` / `tests/**`.

---

## Task 1: Invitațiile din consolă trimit e-mail

Resend e live de la 2026-08-22, dar fluxurile de platformă încă întorc un link de copiat manual
(„Fluxul nu trimite e-mail" — scris chiar în ecranul de succes). `trimiteEmailInvitatie()` există
și e folosită deja de `(app)/setari/membri/actions.ts`. Se cheamă și din consolă.

**Fișiere:** `(platform)/super-admin/organizatii/nou/actions.ts`,
`(platform)/super-admin/organizatii/[orgId]/membri/actions.ts`

- [ ] **1.1** În ambele acțiuni, după crearea invitației, apelează `trimiteEmailInvitatie(...)` cu
  `db`, `destinatar`, `organizatie`, `invitatDe`, `rol`, `token`, `expiraLa`, `invitationId`.
- [ ] **1.2** Rezultatul devine `{ trimisa: true, prinEmail: boolean, linkInvitatie }` — linkul
  **rămâne** ca plasă de siguranță când e-mailul eșuează, dar nu mai e calea principală.
- [ ] **1.3** Textele din interfață nu mai spun „Fluxul nu trimite e-mail".
- [ ] **1.4** `./node_modules/.bin/tsc --noEmit` + `eslint` pe fișierele atinse. Commit.

---

## Task 2: Asistentul se mută într-un loc partajat

`(app)` nu poate importa din `(platform)`. Cele 7 formulare trebuie să fie accesibile ambelor.

**Mută** `(platform)/super-admin/organizatii/nou/_components/{pas-1..7,campuri-comune,progres-asistent}.tsx`
→ `src/components/onboarding/`, cu `git mv` (păstrează istoricul).

- [ ] **2.1** `git mv` cele 9 fișiere.
- [ ] **2.2** Repară importurile: în orchestrator (`./pas-1-identitate` → `@/components/onboarding/pas-1-identitate`).
- [ ] **2.3** `LinkInvitatie` e importat din `../../[orgId]/membri/panou-membri` — rămâne în
  consolă; orchestratorul de acolo îl păstrează, cel din `(app)` nu-l folosește.
- [ ] **2.4** `grep -rn "nou/_components" src/` → zero. `tsc` + `build`. Commit.

---

## Task 3: Navigare liberă între pași

`ProgresAsistent` e azi doar afișaj: primește `pasCurent`, desenează. Devine navigabil.

- [ ] **3.1** Semnătură nouă: `{ pasCurent, onSalt?, pasiAscunsi? }`. `pasiAscunsi` servește
  Task 5 (administratorul nu vede pasul 6 — el ESTE proprietarul).
- [ ] **3.2** Fiecare pas devine `<button type="button">`, nu `<span>` într-un `<li>` — accesibil
  la tastatură și anunțat ca acțiune. Fără `onSalt`, rămâne `<span>` (nu inventăm interactivitate).
- [ ] **3.3** În orchestrator: `onSalt={setPasCurent}`. **Fără validare la salt** — validarea
  rămâne la „Continuă" și la confirmare. Blocarea saltului ar reface tunelul pe care îl desființăm.
- [ ] **3.4** Pasul 7 (confirmare) listează câmpurile lipsă, fiecare cu buton spre pasul lui.
- [ ] **3.5** `build`. Commit.

---

## Task 4: Formularul scurt de creare + alegerea

`/super-admin/organizatii/nou` devine: **Denumire · CUI · E-mail administrator** + alegerea
„cine completează restul".

- [ ] **4.1** Componentă nouă `_components/alegere-inrolare.tsx`: cele 3 câmpuri și două butoane —
  „Completez eu datele firmei" / „Le completează administratorul".
- [ ] **4.2** „Completez eu" → montează asistentul cu valorile pre-completate, pornit de la
  **pasul 2** (pasul 1 e deja dat).
- [ ] **4.3** „Le completează administratorul" → acțiune nouă `creeazaOrganizatieMinima`:
  `insert` cu `status: "pending"` (denumire, CUI, slug derivat) + invitație + e-mail (Task 1).
  Schemă Zod nouă în `src/schemas/organization.ts`, refolosind `cuiSchema`, `slugSchema`, `emailSchema`.
- [ ] **4.4** Ecran de succes: „Firma a fost creată. Administratorul completează datele la prima
  intrare." + starea invitației.
- [ ] **4.5** `tsc` + `build`. Commit.

---

## Task 5: Poarta și ecranul administratorului

- [ ] **5.1** `src/app/(app)/bun-venit/page.tsx` — server component: `requireTenant()`, verifică
  `status === "pending"` și rol `org_admin`; altfel `redirect(RUTA_DUPA_AUTENTIFICARE)`.
  Randează asistentul cu `pasiAscunsi={[6]}` și valorile existente ale firmei.
- [ ] **5.2** Acțiune `completeazaDateleFirmei` în `(app)/bun-venit/actions.ts`: `update` pe
  organizație + `status: "active"` + `activated_at`. Prin `createAction`, cu
  `permission: "organizations:update"` — **nu** `createAdminSupabase`: administratorul are voie
  pe propria firmă, deci RLS e suficientă și corectă.
- [ ] **5.3** Poarta în `src/app/(app)/layout.tsx`, imediat după `requireTenant()`:
  - `pending` + `org_admin` → `redirect("/bun-venit")`;
  - `pending` + alt rol → `redirect("/firma-in-configurare")`;
  - `active` → neschimbat.
  **Atenție:** `/bun-venit` e ÎN `(app)`, deci ar intra în propria poartă. Se exclude explicit
  după `pathname`, altfel e buclă infinită de redirect.
- [ ] **5.4** `src/app/(app)/firma-in-configurare/page.tsx` — ecran explicativ pentru `hr`,
  `manager`, `employee`: firma nu e configurată, administratorul trebuie să termine.
- [ ] **5.5** `build` + probă manuală pe roluri. Commit.

---

## Task 6: Verificare și publicare

- [ ] **6.1** `./node_modules/.bin/tsc --noEmit` · `eslint .` · `vitest run --project unit` · `next build`
- [ ] **6.2** Publicare din worktree curat pe HEAD (`DEPLOY.md`).
- [ ] **6.3** Proba din spec: cele 7 situații din tabelul de verificare.
- [ ] **6.4** Non-regresie pe vecini.

---

## Riscuri de execuție

**Bucla de redirect** (5.3) e greșeala cea mai probabilă: `/bun-venit` trăiește sub layout-ul
care redirectează spre el. Fără excludere explicită, aplicația intră în buclă și pagina nu se mai
încarcă deloc.

**Ordinea 2 → 3 → 4 → 5** nu e negociabilă: mutarea trebuie să preceadă orice modificare, altfel
importurile se repară de două ori.

**Sesiunea paralelă** lucrează la ticketing în același repo. `git add` doar pe căi explicite.
