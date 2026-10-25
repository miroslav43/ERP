---
tip: modul
titlu: Angajați — înrolarea și ce refuză schema tăcut
aliases: [asistent inrolare, inroleazaAngajat, schemas comun, telefonOptional]
cai:
  - "src/app/(app)/angajati/nou/**"
  - "src/schemas/employee.ts"
  - "src/schemas/comun.ts"
tabele: [employees, employment_contracts, inrolare_ciorne, organizations]
permisiuni: [employees:create]
capcane: []
scris_pe: cd77c37564a0a2474dda087e9d2ec85035b57e46
scris_la: 2026-10-25
tags: [modul, hr, nucleu]
---

# Angajați — înrolarea și ce refuză schema tăcut

Secțiune extrasă din [[modul/angajati]] (pagina principală e la plafon): asistentul de
înrolare și ajutoarele comune de validare, cu refuzurile care nu produc nicio eroare.

## Ce refuză schema tăcut

Baza nu e singurul loc care refuză fără să spună. Ajutoarele comune stau în
`src/schemas/comun.ts`; `src/schemas/comun.test.ts` interzice redeclararea lor local
oriunde în `src/schemas/`.

- **Un `<select>` cu opțiune goală trimite ȘIRUL GOL, nu `null`**, iar
  `z.enum(X).nullable()` îl respinge. Se vedea ca un buton „Continuă" mort în asistentul
  de înrolare: validarea pica pe `special_regime` și pe `stare_civila`, iar niciunul nu
  randa vreun mesaj. `enumOptional` normalizează `""`/`null`/`undefined` la `null` și dă
  mesajul de două ori — `zodResolver` citește mesajul RAMURII, iar `z.flattenError` din
  `create-action.ts` pe cel al UNIUNII. —
  `src/app/(app)/angajati/nou/_components/poarta-pasilor.test.ts`
- **`z.coerce.number()` dă `0` și pe `""`, și pe `null`.** Un câmp numeric golit nu
  spunea „lipsește", ci plafonul câmpului calculat pe zero: `salariu_baza` se scria 0 RON
  fără niciun mesaj, iar `norma_ore_saptamana` ieșea cu textul englezesc al lui zod.
  `numarObligatoriu`, `numarOptional` și `numarCuImplicit` scot golul ÎNAINTE de
  coerciție. Pe o coloană întreagă din bază, `intreg: true` e obligatoriu — altfel
  Postgres rotunjește tăcut la inserare. — `src/schemas/comun.test.ts`
- **`z.flattenError` colapsează calea unui câmp-listă la rădăcină**: serverul raportează
  `autorizatii`, clientul `autorizatii.2.numar`. Rezumatul emite amândouă formele, altfel
  una dintre căi dispare de pe ecran. —
  `src/app/(app)/angajati/nou/_components/erori-formular.test.ts`
- **Un text liber nu e un telefon.** `telefon`, `telefon_serviciu` și
  `contact_urgenta_telefon` erau `textOptional(32)`, deci „abc" se salva ca număr pe fișă,
  în asistent și în profilul propriu. `telefonOptional` cere cifre, spații și semnele
  `+ ( ) - . /`, cu un interior opțional la final („int. 12"), între 6 și 32 de caractere.
  NU e `telefonSchema` din `src/schemas/organization.ts` (strict românesc, pentru
  înregistrare): un angajat sau un contact de urgență poate avea un număr străin.
- **`codPostalOptional` (exact șase cifre) se aplică DOAR unde adresa e sigur în
  România** — punctele de lucru. Reședința unui angajat poate fi în străinătate, deci
  câmpurile ei rămân text liber.
- **Harta mesajelor în română se încarcă din `src/schemas/mesaje-zod.ts`**, importat de
  `comun.ts` pentru orice schemă care ia ajutoarele de acolo. `z.config` NU se mută în
  `comun.ts`: el trage nomenclatorul COR, pe care schemele de client fără `./comun` nu-l
  vor. Datele se cer în formatul de citire (`zz.ll.aaaa`) în MESAJ, dar se scriu și se
  validează `AAAA-LL-ZZ`.

## Contractul, la înrolare și pe fișă

`corpContractSchema` e comună casetei „Contract nou" și asistentului, deci regulile de mai
jos prind în ambele:

- **Norma zilnică e plafonată la 8 ore** (Codul muncii, art. 112), mai strict decât
  check-ul `<= 12` din `0004_hr.sql`: un contract cu 12 ore pe zi nu e normă, iar orele
  peste 8 sunt suplimentare.
- **Norma zilnică nu poate depăși norma săptămânală** — prinde inversiunea celor două
  câmpuri. NU se cere „zi × 5 ≤ săptămână": timpul parțial se poate lucra în zile
  întregi, dar în mai puțin de cinci zile (art. 103–105), iar regula veche forța o normă
  zilnică falsă, care ajungea în REGES. Pragul de salariu minim se proporționează din
  norma SĂPTĂMÂNALĂ (`src/domain/payroll/salariu-minim.ts`), cea zilnică fiind doar
  rezerva pentru o săptămânală lipsă.
- **`zile_concediu_anual` nu mai are implicit codificat** pe contract: lipsa e `null`,
  iar `creeazaContract` completează din `organizations.zile_concediu_anual_implicit`.
  La înrolare câmpul e OBLIGATORIU (`numarObligatoriu`), fiindcă asistentul îl
  precompletează din firmă și îl scrie și în documentul CIM.
- **Fișa de aptitudine refuză o valabilitate anterioară examinării**, pe câmpul omului,
  ca oglindă a regulii din `fisaAptitudineSchema` (`src/schemas/ssm.ts`): înrolarea
  inserează aceeași fișă, deci refuzul vine înainte, nu ca avertisment după ce angajatul
  e deja creat.

## Pașii asistentului

Pașii asistentului de înrolare nu mai au clase de câmp proprii: `campuri-comune.tsx` a
dispărut, controalele trec prin `Camp` din `src/components/ui/camp.tsx`, iar mesajele
prin `mesajCamp` din `nou/_components/erori-formular.ts`. Un câmp nou în
`inroleazaAngajatSchema` cere **și** o intrare în `ETICHETE_CAMPURI`
(`nou/_components/etichete-campuri.ts`): tipul e `Record<keyof …, string>`, deci
omisiunea nu compilează — rezumatul de erori numește câmpuri care, de regulă, sunt pe un
pas nemontat, așa că eticheta nu poate fi citită din arbore. Enumerările afișate se
traduc din `src/app/(app)/angajati/etichete.ts` (`ETICHETE_REGIM_SPECIAL`,
`ETICHETE_DURATA_CONTRACT`), nu din valoarea brută a bazei.

Ciorna asistentului stă în `inrolare_ciorne` (`salveazaCiornaInrolare`,
`stergeCiornaInrolare`, `employees:create = all`): datele ei, CNP inclus, nu intră în
jurnalul de audit — doar pasul. Lista acțiunilor: [[modul/angajati/actiuni]].
