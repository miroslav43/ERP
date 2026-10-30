---
tip: modul
titlu: Salarizare — Server Actions
aliases: [payroll-actions, calculeazaPerioada, salveazaSetari]
cai:
  - "src/app/(app)/salarizare/actions.ts"
  - "src/schemas/payroll.ts"
tabele:
  [
    payroll_periods,
    payroll_entries,
    payroll_bonuses,
    payroll_deductions,
    payroll_settings,
    payroll_personal_deduction_brackets,
    payroll_prior_income,
  ]
permisiuni: [payroll:create, payroll:update, payroll:approve, payroll:export]
feature: payroll
capcane: []
scris_pe: 3760e43cc77bfb934a236ef82ab1475d647c0a11
scris_la: 2026-10-30
tags: [modul, finance]
---

# Salarizare — Server Actions

Secțiune extrasă din [[modul/salarizare]]: scrierile modulului, poarta fiecăreia și ce
întreabă ele înaintea bazei.

## Server Actions

`src/app/(app)/salarizare/actions.ts` (inclusiv `salveazaSetari`), plus
`popriri/actions.ts` și `componente/actions.ts`.

| Funcție                                                                                     | Permisiune / minScope                    |
| ------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `creeazaPerioada`, `calculeazaPerioada`                                                     | `payroll:create` / all                   |
| `aprobaPerioada`, `inchidePerioada`                                                         | `payroll:approve` / all                  |
| `redeschidePerioada`                                                                        | `payroll:update` / all                   |
| `adaugaPrima`, `adaugaRetinere`, `salveazaIstoricVenit`                                     | `payroll:create` / all                   |
| `stergePrima`, `stergeRetinere`                                                             | `payroll:update` / all                   |
| `trimiteFluturasii`                                                                         | `payroll:export` / all                   |
| `creeazaPoprire` / `inchidePoprire`                                                         | `payroll:create` / `payroll:update`, all |
| `creeazaSablonComponenta` / `actualizeazaSablonComponenta` / `dezactiveazaSablonComponenta` | `payroll:create` / `payroll:update`, all |
| `salveazaSetari`                                                                            | `payroll:update` / all                   |

`calculeazaPerioada` pune ÎNTÂI întrebările triggerului: pontajul lunii blocat
(`citestePerioadaDupaId`) și nicio cerere de concediu în așteptare peste lună
(`numarCereriInAsteptareLuna`). Bariera rămâne triggerul din `0026_payroll.sql:314-339`
— între citire și UPDATE poate interveni altă sesiune — dar el rulează la UPDATE-ul de
stare, DUPĂ ce `payroll_scrie_rezultate` a scris rândurile în tranzacția ei, deci refuzul
lui lăsa intrări `calculat` pe o perioadă `draft`, cu totaluri 0. Mesajul spune și CINE
poate bloca pontajul: `hr` are `payroll` la `all`, dar `attendance:approve` la `none`,
deci fără fraza aia salarizarea era pentru el un drum înfundat. Ambele citiri trec prin
RLS: un rol fără `attendance:read` e refuzat cu „nu este blocat" — refuz onest, fiindcă
triggerul l-ar fi refuzat oricum.

`adaugaPrima` și `adaugaRetinere` precitesc starea perioadei (`cerePerioadaInCiorna`):
`payroll_bonuses_insert` și `payroll_deductions_insert` cer perioada în `draft`, iar
respingerea din `WITH CHECK` iese ca `42501` — „nu aveți dreptul" — deși dreptul există
și doar luna nu mai e în ciornă. Ștergerile o făceau deja.

`trimiteFluturasii` întoarce și `faraAdresaAngajati` — cine n-are adresă de e-mail, nu
doar câți; ecranul perioadei le pune numele, cu drum spre fișă dacă poate.

Cele trei formulare de adăugare — `FormularSablonComponentaNou`, `FormularPoprireNoua`,
`FormularIstoricVenit` — se cer dintr-un buton și se deschid în casetă, prin
`FormularDialog` (`src/components/ui/formular-dialog.tsx`), nu desfăcute sub antet: în
spate rămâne vizibilă lista de citit înainte de a scrie — cod intern liber, dosare de
poprire, luni de venit deja introduse. Închiderea și `router.refresh()` le face
componenta, deci ecranele nu mai țin `deschis` și `laReusita`. `FormularIstoricVenit` își
dezactivează butonul când nu are niciun angajat de ales, și preselectează omul din
`?angajat=`. `setari/formular-setari.tsx` rămâne în pagină — e ecranul însuși, nu o
adăugare.

## Ce refuză baza tăcut

- **O versiune de setări scrisă fără praguri de deducere dă deducere personală ZERO**,
  tăcut (`cautaPragDeducere`), și devine cea în vigoare, blocând data prin
  `payroll_settings_valabil_uq`. Cele două scrieri ale lui `salveazaSetari` nu stau într-o
  tranzacție comună, deci acțiunea își anulează logic propria versiune când inserarea
  pragurilor cade; eroarea anulării nu o ascunde pe cea originală. `pragDeducereSchema`
  oglindește și `ppdb_persoane_ck` din `0026_payroll.sql`, ca minimul mai mare decât
  maximul să nu ajungă la bază.
