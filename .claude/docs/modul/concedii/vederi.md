---
tip: modul
titlu: Concedii — calendar, aprobări și zile ocupate
aliases: [concedii-calendar, concedii-aprobari, concedii-planificator]
cai:
  - "src/app/(app)/concedii/calendar/**"
  - "src/app/(app)/concedii/aprobari/**"
  - "src/domain/leave/zile-ocupate.ts"
  - "src/lib/queries/leave.ts"
tabele: [leave_requests, leave_request_days, leave_types, leave_balances, approval_tasks]
permisiuni: [leave:read, leave:approve]
feature: leave
capcane: [2]
scris_pe: f437506578f23173e26c942102cdd3ddd2d109c8
scris_la: 2026-10-28
tags: [modul, hr]
---

# Concedii — calendar, aprobări și zile ocupate

Secțiune extrasă din [[modul/concedii]]: ce tace pe cele trei ecrane care arată cereri
fără să le scrie — calendarul lunii, planificatorul, coada de aprobări — și marcajul de
zile ocupate din caseta de cerere nouă. Citirile din spate sunt în
[[modul/concedii/actiuni]].

## Ce refuză baza tăcut

- **Marcajul zilelor deja ocupate e semnalizare, nu poartă.** Caseta de cerere nouă
  colorează zilele prinse de o cerere `trimisa`/`in_aprobare`/`aprobata`, dar le blochează
  doar pentru tipurile fără `intrerupe_alte_concedii` — celelalte au voie să se suprapună.
  Lipsa marcajului nu e garanție: fără persoană aleasă harta e goală, iar citirea n-are
  cursor pe o fereastră de trei ani, deci peste `max_rows` PostgREST o taie tăcut
  (capcana #2). Judecătorul rămâne verificarea de la trimitere.
  — `src/domain/leave/zile-ocupate.ts`
- **Angajatul și tipul din calendar pot veni NULL, fără eroare.** `calendarLunii` îi
  aduce prin embed imbricat PostgREST (`angajat:employees!employee_id`,
  `tip:leave_types!leave_requests_leave_type_id_fkey`), deliberat fără `!inner`: un embed
  to-one filtrat de RLS întoarce NULL, nu elimină rândul. Ziua rămâne pe calendar, cu
  „Angajat" și „Concediu" în locul numelui și al tipului — nu o citi ca pe date lipsă din
  bază. — `calendarLunii`, în `src/lib/queries/leave.ts`
- **Soldul lipsă din coada de aprobări nu înseamnă sold zero.** `/concedii/aprobari` arată
  zilele rămase ale celui care cere, din `soldAnual` pe anul PRIMEI cereri din coadă: un
  angajat fără rând de sold pe tipul cerut, un angajat sau tip golit de RLS, ori o coadă
  întinsă peste doi ani calendaristici ascund cifra, în loc s-o inventeze. Tipurile care
  nu scad din sold n-o arată deloc. — `src/app/(app)/concedii/aprobari/page.tsx`
- **Contorul de aprobat urmează lista, nu starea cererii.** `numarDeAprobat` și
  `deAprobat` se citesc din aceeași sursă; un `count()` naiv pe `approval_tasks` rămâne
  blocat pe un număr care nu scade. — `src/lib/queries/leave.ts`
