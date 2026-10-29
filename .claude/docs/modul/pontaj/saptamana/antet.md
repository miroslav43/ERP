---
tip: modul
titlu: Pontaj — planul săptămânii — butonul de setări din antet
aliases: [pontaj-saptamana-antet]
cai:
  - "src/app/(app)/pontaj/saptamana/**"
tabele: []
permisiuni: [attendance:update, departments:update]
feature: attendance
capcane: []
scris_pe: 6e0792e9aa37ea9f4b874d856489a4f0b9344c20
scris_la: 2026-10-29
tags: [modul, hr]
---

# Pontaj — planul săptămânii — butonul de setări din antet

Secțiune extrasă din [[modul/pontaj/saptamana]]: corpul paginii trecuse de plafonul dur,
iar antetul ecranului e partea care nu se schimbă odată cu formularul.

## Simetria se oprește la antet

Simetria se oprește la antet: `ButonSetariPontaj`
(`src/app/(app)/pontaj/buton-setari.tsx`, componentă a MODULULUI) stă pe AMÂNDOUĂ ramurile
paginii `/pontaj/saptamana` — cea care cere alegerea angajatului și cea cu formularul —
dar pe niciuna din portal.

Butonul scoate două linkuri, cu porți DIFERITE, amândouă din `fileDePontaj`:
`poateConfigura` (`attendance:update` la `all`) pentru „Setări" și `poateVedeaCoduriQr`
(`departments:update` la `all`) pentru „Coduri QR" — cheia altui modul, fiindcă cine vede
codul poate ponta de oriunde. Când niciuna nu e adevărată, componenta întoarce `null`.

`poateVedeaCoduriQr` e OPȚIONALĂ, cu implicit `false` — invers față de regula
`ZiFormular` din pagina-mamă, unde proprietățile noi se declară obligatorii ca să oblige
compilatorul. Aici o ramură care uită s-o paseze pierde linkul TĂCUT, fără eroare de tip;
pagina o pasează explicit pe amândouă ramurile. `buton-setari.test.tsx` ține cele patru
combinații.
