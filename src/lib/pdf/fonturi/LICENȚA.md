# Fonturile DejaVu

`DejaVuSans.ttf` și `DejaVuSans-Bold.ttf`, versiunea 2.37, din pachetul Debian
`fonts-dejavu-core`.

## De ce sunt aici și nu în `public/`

`public/` e servit clientului. Fonturile astea se folosesc EXCLUSIV pe server,
la generarea PDF-urilor — un font de 760 KB descărcat de fiecare vizitator ar fi
o risipă și, fiindcă nu-l cere nicio pagină, ar sta acolo doar ca suprafață în
plus.

## De ce DejaVu și nu un font standard PDF

Cele 14 fonturi standard din PDF (Helvetica, Times, Courier) folosesc codarea
**WinAnsi**, care NU conține `ș`/`ț` cu virgulă dedesubt (U+0219/U+021B) —
literele pe care întreg proiectul le cere, în locul celor cu sedilă. Un stat de
plată scris cu Helvetica ar fi tipărit „indemnizaie" în loc de „indemnizație".

`pdf-lib` face subsetare la încorporare (`embedFont(..., { subset: true })`),
deci în PDF-ul livrat ajung doar glifele folosite efectiv: proba de control a
produs un document de 6,7 KB, nu 760 KB.

## Licența

Bitstream Vera Fonts Copyright (c) 2003 Bitstream, Inc. · DejaVu changes are in
public domain. Licență permisivă, compatibilă cu redistribuirea comercială:
<https://dejavu-fonts.github.io/License.html>
