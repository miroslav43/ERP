Repo: {{REPO}}
PAGINA: {{PAGINA}}
DIR_LUCRU: {{DIR}}
CORP: {{OCTETI}} octeți, măsurați de lint DUPĂ rescriere (ținta {{TINTA}}, plafonul dur {{DUR}})
SUBPAGINI: {{SUBDIR}}/

A doua trecere: SPARGEREA. Corpul paginii {{PAGINA}} e peste plafonul dur. Așa cum e,
lintul vault-ului o declară eroare, iar poarta de publicare o revertește — în fiecare
noapte, deci pagina nu s-ar mai actualiza niciodată.

Invocă skill-ul `documentatie-erp` din .claude/skills/ și urmează DOAR secțiunea
„Peste plafon: spargi, nu adaugi”. Nu recitești diff-ul și nu rescrii conținut: muți
secțiuni întregi, neschimbate, în subpagini NOI din {{SUBDIR}}/, până când corpul
paginii-mamă coboară sub ținta de {{TINTA}} octeți. Pagina-mamă rămâne trunchiul: „Ce
e”, „Rute și cine ajunge” și tabelul „Paginile modulului”, cu un rând pentru fiecare
subpagină; ce pleacă din „Ce refuză baza tăcut” pleacă împreună cu ruta sau acțiunea
căreia îi aparține.

Modifică DOAR {{PAGINA}} și creează DOAR fișiere noi direct în {{SUBDIR}}/, cu nume
`[a-z0-9-]+.md`. O subpagină care există deja NU se atinge: are rularea ei. Orice alt
fișier scris e aruncat de workflow.

La final, citește {{DIR}}/rezumat.json scris de prima trecere și rescrie-l păstrându-i
cheile, cu `"modificata": true`, `"spart": true` și `"subpagini": [căile create]`.
Nu atinge cod, teste, migrări sau configurație. Nu comite, nu da push.
