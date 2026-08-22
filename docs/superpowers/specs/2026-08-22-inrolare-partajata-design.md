# Înrolare partajată — super-adminul alege cine completează datele firmei

**Stare:** propus · **Dată:** 2026-08-22

---

## De ce

Azi super-adminul completează **toți cei 7 pași** ai asistentului (1013 linii de formular:
identitate, reprezentant legal, financiar, structură, SSM, proprietar, confirmare) înainte ca
firma să existe. Adică platforma cere unei singure persoane date pe care le știe altcineva:
capitalul social, IBAN-ul, responsabilul SSM, structura de departamente.

Rezultatul practic e că înrolarea se blochează pe informații pe care super-adminul trebuie să le
ceară prin telefon sau e-mail, iar firma nu poate fi predată până nu le adună.

## Ce se schimbă

**Super-adminul alege**, la crearea firmei, cine completează datele:

- **Completez eu acum** — intră în asistentul de 7 pași, ca azi. Util când are deja actele
  firmei în față.
- **Le completează administratorul** — creează firma cu minimul necesar (denumire, CUI, e-mail
  administrator) și trimite invitația. Asistentul îl așteaptă pe administrator la prima intrare.

Când sarcina trece administratorului, asistentul e **obligatoriu**: până nu îl termină, nu intră
în aplicație. Nu e o alegere de ton, e o consecință — fără date fiscale nu poate emite un stat de
plată, iar o firmă pe jumătate configurată produce erori care par bug-uri.

**În ambele cazuri, pașii 1–7 se navighează liber.** Azi `ProgresAsistent` e doar afișaj: primește
`pasCurent` și desenează. Devine navigabil — poți sări la orice pas, iar pasul de confirmare
arată explicit ce mai lipsește.

---

## Poarta există deja în schemă

Descoperirea care face designul ieftin: organizațiile **se creează deja** cu `status: "pending"`
(`organizatii/nou/actions.ts:119`), iar `pending` **nu blochează astăzi nimic** — nici
`resolveTenant()`, nici layout-ul aplicației. E o stare pur informativă.

Îi dăm înțeles: **`pending` = datele firmei nu sunt complete.** Terminarea asistentului o trece în
`active`. Nu e nevoie de nicio migrare și de nicio coloană nouă.

Cele trei firme existente sunt toate `active`, deci nu sunt atinse de schimbare.

`activeazaOrganizatie` rămâne — un super-admin poate încă activa manual, pentru cazurile în care
datele au fost completate pe altă cale.

---

## Arhitectura

### 1 · Asistentul devine partajat

Cei 7 pași trăiesc azi în `(platform)/super-admin/organizatii/nou/_components/`. Aplicația de
firmă nu poate importa de acolo — sunt două segmente diferite, iar componentele de zonă trebuie
să rămână în zona lor.

Se mută în `src/components/onboarding/`, cu aceleași fișiere `pas-1..7`. Cele două puncte de
intrare le folosesc pe amândouă:

| Cine | Unde | Ce face la final |
|---|---|---|
| Super-admin | `/super-admin/organizatii/nou` | creează firma **și** o activează |
| Administrator | `/bun-venit` | completează firma existentă, o activează |

Diferența dintre ele e doar pasul 6 (proprietarul): super-adminul îl completează, administratorul
**e** proprietarul, deci pasul îi este sărit și pre-completat cu propriul cont.

### 2 · Navigarea liberă

`ProgresAsistent` primește `onSalt(numarPas)`. Fiecare pas rămâne un `<button>`, nu un `<div>`
colorat — accesibil la tastatură și anunțat corect.

Validarea nu se mută la salt, ci rămâne unde e utilă: pasul de **confirmare** listează ce
lipsește, cu link direct la pasul respectiv. Blocarea saltului ar transforma asistentul într-un
tunel, adică exact ce ceri să nu mai fie.

### 3 · Poarta pentru administrator

În `src/app/(app)/layout.tsx`, după `requireTenant()`:

- organizație `pending` **și** rol `org_admin` → redirect la `/bun-venit`;
- organizație `pending` **și** orice alt rol → ecran explicativ, nu asistentul. Un `hr` sau un
  `employee` nu poate completa capitalul social; a-i arăta formularul ar fi o fundătură cu
  câmpuri pe care nu are cum să le știe.

`/bun-venit` stă în `(app)`, dar în afara `SidebarProvider`: până nu e configurată firma, meniul
n-are ce arăta.

### 4 · Formularul scurt de creare

`/super-admin/organizatii/nou` devine un ecran cu trei câmpuri — **Denumire**, **CUI**,
**E-mail administrator** — plus alegerea „cine completează restul". Când super-adminul alege să
completeze el, continuă în același asistent, de la pasul 2.

Invitația pleacă prin Resend, live de la 2026-08-22, cu expeditorul `noreply@infomeditatii.ro`.

---

## Ce NU se schimbă

- **Cele 7 formulare, ca conținut și validare.** Se mută și devin navigabile; câmpurile rămân.
- **Schema bazei.** Nicio migrare.
- **Firmele existente** — toate `active`, deci în afara porții.
- **`activeazaOrganizatie`** rămâne, ca ieșire manuală.

---

## Riscuri

**Un `org_admin` invitat într-o firmă `pending` nu poate ocoli asistentul.** E intenționat, dar
înseamnă că o firmă creată din greșeală cu e-mailul greșit blochează acel utilizator. Ieșirea:
super-adminul poate oricând completa el datele, sau activa manual.

**Pasul 6 sărit pentru administrator** cere ca formularul să funcționeze cu 6 pași vizibili din 7.
Numerotarea afișată se calculează, nu se scrie de mână.

**Firmele `pending` de dinainte** — dacă apar, intră în poartă la următoarea autentificare.
Astăzi nu există niciuna.

---

## Verificare

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Proba pe roluri, în producție:

| Situație | Așteptat |
|---|---|
| Super-admin creează firmă, alege „completez eu" | asistent 7 pași → firmă `active` |
| Super-admin creează firmă, alege „completează administratorul" | firmă `pending`, invitație primită |
| Administrator invitat intră prima dată | `/bun-venit`, nu poate ieși în aplicație |
| Administrator termină asistentul | firmă `active`, intră în `/panou` |
| `hr` intră într-o firmă `pending` | ecran explicativ, NU asistentul |
| Salt de la pasul 1 la 7 | permis; confirmarea arată ce lipsește |
| Firmă deja `active` | neschimbată, fără poartă |
