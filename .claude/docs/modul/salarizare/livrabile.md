---
tip: modul
titlu: Salarizare — livrabilele perioadei
aliases: [d112, fișier bancar, stat de plată, notă contabilă]
cai:
  - "src/app/(app)/salarizare/[id]/page.tsx"
  - "src/app/api/export/salarizare/**"
tabele: [payroll_periods, payroll_entries]
permisiuni: [payroll:read, payroll:export, employees:read]
feature: payroll
capcane: []
scris_pe: 3760e43cc77bfb934a236ef82ab1475d647c0a11
scris_la: 2026-10-30
tags: [modul, finance]
---

# Salarizare — livrabilele perioadei

Secțiune extrasă din [[modul/salarizare]]: cele patru descărcări ale perioadei aprobate,
porțile lor și cifrele de control pe care le întorc.

## Panoul „Livrabile"

Panoul „Livrabile" de pe `/salarizare/[id]` apare doar când perioada e `aprobat` sau
`inchis` **și** rolul are `payroll:export` all — fără el erau patru butoane care așteptau
să dea 403. Cele patru descărcări — `bancar`, `nota`, `stat`, `d112`, sub
`src/app/api/export/salarizare/` — se cer prin `ButonDescarcare`
(`src/components/incarcare/buton-descarcare.tsx`), **nu** prin `<a href>`: rutele refuză
în `text/plain`, nu în JSON (`d112/route.ts:43`, `bancar/route.ts:31`), iar printr-o
navigare refuzul înlocuia ecranul cu pagina aia de text; prin `fetch` ajunge într-o
notificare și omul rămâne pe perioadă.

`d112` cere `payroll:export` all **și** `employees:read` all (`d112/route.ts:70-78`) —
declarația conține CNP-ul fiecărui asigurat, deci `payroll:export` singur nu ajunge.
Fișierul bancar decriptează IBAN-ul, deci cere același drept. Ecranul nu mai arată niciun
buton pentru ele fără `employees:read` all: rămân „nota" și „stat", plus o propoziție care
spune ce drept lipsește, în locul a două refuzuri în așteptare.

`angajatiFaraIban` (`src/lib/queries/payroll.ts`) numește, ÎNAINTE de descărcare, oamenii
care vor lipsi din fișierul bancar, cu drum spre fișa unde se completează IBAN-ul;
raportul venea doar după descărcare, ca număr. Verifică rând cu rând, prin
`hr_read_sensitive`, deci se cere numai când rolul poate și exporta și deschide fișa.

Cifrele de control ale exportului nu sunt în corpul răspunsului, ci în antete:
`bancar/route.ts:174-176` trimite `x-plati-incluse`, `x-suma-control` și `x-fara-iban` —
ce NU a intrat în fișier. `ButonDescarcare` le citește și le pune în notificarea de
reușită. `d112/route.ts` trimite și `x-atentionari` (atenționări ANAF neblocante, câte
una pe asigurat cu sumă neimpozabilă), iar butonul îl are în `ANTETE_CONTROL`: numărul
apare în notificare, dar NU cine sunt — mesajele rămân în ruta de generare.

`d112` citește `calc_breakdown` și declară `A_5` (baza CAM) = brut − suma neimpozabilă.
Tipul de asigurat 51 și `A_13S` nu se generează, iar fișierul nu trece XSD-ul ANAF, nici
cel curent, nici cel din 2019 (validat): [[modul/salarizare/calcul]], `NOTES.md` §3.

## Ce refuză baza tăcut

- **`zile_fara_plata` e cheie OBLIGATORIE în `payroll_scrie_rezultate`** de la
  `0126_d112_ore_suspendate.sql`: omisă, lotul cade cu `P0001`. Până atunci se agrega
  (`0064`) și se pierdea la ieșirea din RPC, iar D112 declara `A_7 = 0` fără eroare;
  perioadele calculate înainte de 0126 rămân pe zero.
