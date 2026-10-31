---
tip: modul
titlu: Cursuri — Server Actions
cai:
  - "src/app/(app)/cursuri/actions.ts"
  - "src/schemas/cursuri.ts"
tabele:
  [
    courses,
    course_materials,
    course_material_versions,
    course_items,
    course_enrollments,
    course_answer_keys,
    course_assignment_rules,
  ]
permisiuni: [courses:read, courses:create, courses:update]
capcane: []
scris_pe: a67bb3cc1be0a37072b4d1bb96fb262cf8338586
scris_la: 2026-10-31
tags: [modul, hr]
---

# Cursuri — Server Actions

Secțiune extrasă din [[modul/cursuri]]: tabelul acțiunilor modulului și pragul de scope pe
care îl împart toate.

## Server Actions

`src/app/(app)/cursuri/actions.ts` — **toate** pe `minScope: "team"`, ceea ce face din
`courses` unul dintre puținele module în care managerul e autor, nu doar aprobator.

| Grup      | Funcții                                                                                                                  | Permisiune          |
| --------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| Curs      | `creeazaCurs`; `actualizeazaCurs`, `publicaCurs`, `dezactiveazaCurs`                                                     | `create` / `update` |
| Materiale | `creeazaMaterial`, `pregatesteIncarcareMaterial`, `salveazaVersiuneFisier`, `salveazaVersiuneLink`, `renuntaLaIncarcare` | `courses:create`    |
| Materiale | `actualizeazaMaterial`, `stergeMaterial`                                                                                 | `courses:update`    |
| Lecții    | `adaugaLectie`; `actualizeazaLectie`, `stergeLectie`, `mutaLectie`                                                       | `create` / `update` |
| Înrolări  | `atribuieCurs`, `aplicaRegulile`, `creeazaRegula`; `anuleazaInrolare`, `stergeRegula`                                    | `create` / `update` |
| Test      | `salveazaTest`                                                                                                           | `courses:update`    |
| Materiale | `linkPreviewMaterial`                                                                                                    | `courses:read`      |
