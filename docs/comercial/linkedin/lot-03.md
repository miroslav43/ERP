# Lotul 3 — uneltele noi, postările #23–#27 (2 – 6 nov 2026)

**Stare: scris.** Cinci postări, câte una pe unealtă, fiecare cu linkul direct
spre unealtă în primul comentariu, nu spre pagina de start. Continuă ritmul
lotului 2: doar pagina de firmă, fără unghiul „AI”, o postare pe zi lucrătoare,
la **8:30**. Programarea concediilor intră prima: cererea are vârf în
noiembrie–decembrie, înaintea termenului din art. 148 alin. (1).

**Ce urmărim:** ca la lotul 2, afișările, salvările, redistribuirile și
urmăritorii noi, plus vizitele UTM pe fiecare unealtă. Aici linkul duce direct
în unealtă, deci clicul are ce măsura. Tabelul de rezultate din README era gol
pe 22 oct, așa că lotul nu e ajustat după rezultate.

Fiecare cifră și fiecare articol de mai jos au fost găsite pe 22 oct 2026 pe
pagina live a uneltei (`curl https://administrativo.ro/unelte/<unealta>`) și
reverificate în `src/content/legal/*.ts`. Datele și numărătorile sunt calculate
cu motorul aplicației (`aNaZiLucratoareDupa` și `numaraInterval` din
`src/domain/calendar/interval-lucrator.ts`), apoi reluate în unealta live, cu
parametrii scriși la fiecare postare. Imaginea se urcă ca **fotografie**, iar
linkul merge în **primul comentariu**.

| #   | Ziua     | Format  | Subiect                                         | Pilon  | Imaginea            |
| --- | -------- | ------- | ----------------------------------------------- | ------ | ------------------- |
| 23  | Lu 2 nov | imagine | Programarea pe 2027, până la sfârșitul lui 2026 | Unelte | captură             |
| 24  | Ma 3 nov | imagine | Preavizul: 23 noiembrie sau 3 decembrie?        | Unelte | captură             |
| 25  | Mi 4 nov | imagine | Decembrie 2026: 21 de zile lucrătoare, nu 23    | Unelte | șablonul 5          |
| 26  | Jo 5 nov | imagine | Adeverința de salariat, fără CNP în formular    | Unelte | captură             |
| 27  | Vi 6 nov | imagine | 21–31 decembrie: 8 zile de concediu, nu 11      | Unelte | șablonul „Interval” |

Capturile vin din `public/capturi/unelte/` (modelul completat al firmei demo,
`EXEMPLE_UNELTE` din `src/content/landing/exemple-unelte.ts`). Calculatorul de
zile lucrătoare și cererea de concediu n-au captură acolo, așa că #25 și #27
folosesc un șablon fără captură.

---

## #23 · luni 2 nov · imagine

**Pilon:** Unelte (pătrat verde). **Sursă:** pagina `/unelte/programare-concedii`
(art. 148 alin. (1), alin. (2)–(4) și alin. (5); art. 149; zilele lucrătoare
din antet: ianuarie 2027 are 18, martie 23), `concediu-odihna.ts` (aceleași
temeiuri), `numaraInterval` pe fiecare lună din 2027: 18, 20, 23, 21, 20, 20,
22, 22, 22, 21, 21, 22.

### Textul postării

> Programarea concediilor pe 2027 are un termen, și nu e în ianuarie.
> E sfârșitul lui 2026.
>
> Art. 148 alin. (1) din Codul muncii cere ca concediile de odihnă să fie
> programate până la sfârșitul anului, pentru anul următor: colectiv, cu
> consultarea sindicatului sau a reprezentanților salariaților, ori individual,
> cu consultarea fiecărui om.
>
> Codul nu impune un formular. Așa că am pus unul gratuit pe site: un rând pe
> om, o coloană pe lună, iar în antetul fiecărei luni stau zilele ei lucrătoare.
> Ianuarie 2027 are 18, martie are 23. Se vede dintr-o privire cât consumă un
> interval.
>
> Înainte de semnare, trei reguli de verificat:
>
> → dacă un concediu se împarte, fiecare om trebuie să aibă în an cel puțin 10
> zile lucrătoare de concediu neîntrerupt (art. 148 alin. 5)
> → în perioada programată, salariatul poate cere concediul cu cel puțin 60 de
> zile înainte (art. 148 alin. 2–4)
> → salariatul e obligat să ia concediul în perioada programată, cu excepțiile
> prevăzute de lege sau din motive obiective (art. 149)
>
> Completați numele, câte unul pe rând, și descărcați în Excel, Word sau PDF,
> fără cont. Tabelul are o coloană pentru semnătura fiecărui om și locuri de
> semnătură pentru întocmire, consultarea reprezentanților și aprobare.
>
> Voi faceți programarea colectiv sau om cu om?

**Primul comentariu:**
`Tabelul de programare pe 2027, cu zilele lucrătoare din fiecare lună: https://administrativo.ro/unelte/programare-concedii?utm_source=linkedin&utm_medium=social&utm_campaign=t4-23-programare-concedii`

**Hashtag-uri:** #concediu #resurseumane #legislatiamuncii

### Imaginea

Șablonul 6, „Captură”: **2027** · „se programează până la sfârșitul lui 2026.” ·
„Un rând pe om, o coloană pe lună, cu zilele lucrătoare în antet.” · rama foii
în jurul capturii `programare-concedii-exemplu-1200.webp`, decupată pe titlu și
pe tabelul firmei demo, de la ianuarie la iunie · temei art. 148 alin. (1)
Codul muncii · administrativo.ro/unelte/programare-concedii.

**Text alternativ:** Cifra „2027” mare, cu textul „se programează până la
sfârșitul lui 2026”. Dedesubt, modelul completat: programarea concediilor de
odihnă pe anul 2027 pentru Administrativo Demo SRL, compartimentul Producție,
cu trei angajați și zilele lucrătoare ale fiecărei luni în antet: ianuarie 18,
februarie 20, martie 23. Temeiul: articolul 148 alineatul 1 din Codul muncii.

---

## #24 · marți 3 nov · imagine

**Pilon:** Unelte (pătrat verde). **Sursă:** pagina `/unelte/cerere-demisie`
(art. 81 alin. (4): cel mult 20 de zile lucrătoare la execuție, 45 la
conducere; întrebarea „zile lucrătoare sau calendaristice?”; curgerea din ziua
următoare înregistrării, RIL nr. 8/2024; variantele art. 81 alin. (8), art. 31
alin. (3), art. 55 lit. b)). Ultima zi, din unealta live
(`?tip=preaviz&categorie=executie&depunere=2026-11-03&preaviz=20`): joi,
3 decembrie 2026, cu 30 noiembrie și 1 decembrie sărite. Varianta în zile
calendaristice e o adunare: a 20-a zi după 3 noiembrie, luni, 23 noiembrie.

### Textul postării

> O demisie înregistrată marți, 3 noiembrie, cu 20 de zile de preaviz.
> Ultima zi e 23 noiembrie sau 3 decembrie?
>
> Depinde de un cuvânt din contract. Art. 81 alin. (4) din Codul muncii spune
> că preavizul e cel din contractul individual sau colectiv, dar cel mult 20 de
> zile lucrătoare pentru o funcție de execuție și 45 pentru una de conducere.
>
> Preavizul curge din ziua următoare înregistrării, deci de miercuri,
> 4 noiembrie:
>
> → 20 de zile calendaristice: ultima zi e luni, 23 noiembrie
> → 20 de zile lucrătoare: ultima zi e joi, 3 decembrie
>
> Zece zile de diferență. Sâmbetele și duminicile nu intră în numărătoare, iar
> în interval cad și două sărbători legale: Sfântul Andrei și Ziua Națională.
>
> De ce din ziua următoare? Pentru preavizul la concediere, Înalta Curte a
> stabilit exact asta (RIL nr. 8/2024), iar Codul nu spune altceva pentru
> demisie.
>
> Cererea de demisie de pe site e gratuită și scrie singură ultima zi de
> preaviz, numărată în zile lucrătoare, fără weekenduri și sărbători. Are și
> variantele fără preaviz, în perioada de probă sau când angajatorul nu își
> respectă obligațiile, plus încetarea prin acordul părților. Word sau PDF,
> fără cont.
>
> În contractele voastre, preavizul e scris în zile lucrătoare sau
> calendaristice?

**Primul comentariu:**
`Cererea de demisie, cu ultima zi de preaviz calculată: https://administrativo.ro/unelte/cerere-demisie?utm_source=linkedin&utm_medium=social&utm_campaign=t4-24-cerere-demisie`

**Hashtag-uri:** #resurseumane #legislatiamuncii #demisie

### Imaginea

Șablonul 6, „Captură”: **20 de zile** · „lucrătoare, cel mult, la demisie pe o
funcție de execuție.” · „45 pe una de conducere. Ultima zi o scrie cererea.” ·
rama foii în jurul capturii `cerere-demisie-exemplu-1200.webp`, decupată pe
primele două paragrafe: Popescu Ana, cerere înregistrată joi, 8 octombrie 2026,
ultima zi de preaviz joi, 5 noiembrie 2026 · temei art. 81 alin. (4) Codul
muncii · administrativo.ro/unelte/cerere-demisie.

**Text alternativ:** Textul „20 de zile lucrătoare, cel mult, la demisie pe o
funcție de execuție; 45 pe una de conducere”. Dedesubt, modelul completat al
cererii de demisie: pentru o cerere înregistrată joi, 8 octombrie 2026, ultima
zi de preaviz este joi, 5 noiembrie 2026. Temeiul: articolul 81 alineatul 4 din
Codul muncii.

---

## #25 · miercuri 4 nov · imagine

**Pilon:** Unelte (pătrat verde). **Sursă:** pagina
`/unelte/calculator-zile-lucratoare` (cele 17 sărbători legale, art. 139
alin. (1); Paștele ortodox; ambele capete incluse între două date, numărătoarea
de a doua zi peste N zile; zilele libere din contractul colectiv nu se scad;
250 de zile lucrătoare în 2026, 252 în 2027), `zile-libere.ts` (17 sărbători,
art. 139 alin. (1)). Decembrie 2026, din unealta live
(`?mod=interval&de_la=2026-12-01&pana_la=2026-12-31`): 21 de zile lucrătoare,
31 calendaristice, 8 în weekend, 2 sărbători în timpul săptămânii.

### Textul postării

> Decembrie 2026 are 23 de zile de luni până vineri. Lucrătoare sunt doar 21.
> Marți, 1 decembrie, e Ziua Națională. Vineri, 25, e Crăciunul.
>
> Două zile par puțin, dar schimbă norma lunii, durata unui concediu și ultima
> zi a unui preaviz. Pentru socoteala asta am pus pe site un calculator gratuit
> de zile lucrătoare, cu două întrebări:
>
> → câte zile lucrătoare sunt între două date, cu ambele capete incluse, ca
> într-o cerere de concediu
> → ce dată cade peste un număr de zile lucrătoare, cu numărătoarea pornită a
> doua zi, ca la preaviz
>
> Weekendurile și cele 17 sărbători legale din art. 139 alin. (1) din Codul
> muncii se scad singure. Paștele e cel ortodox, așa că Vinerea Mare și
> Rusaliile se mută în fiecare an fără să le căutați voi.
>
> Un singur lucru nu se scade: zilele libere date de firmă prin contractul
> colectiv sau prin regulamentul intern. Sunt ale fiecărei firme. Dacă aveți
> una în interval, o scădeți din rezultat.
>
> Ca reper: 2026 are 250 de zile lucrătoare, iar 2027 are 252.
>
> Voi cum numărați zilele lucrătoare: pe calendar, în Excel sau din cap?

**Primul comentariu:**
`Calculatorul de zile lucrătoare între două date: https://administrativo.ro/unelte/calculator-zile-lucratoare?utm_source=linkedin&utm_medium=social&utm_campaign=t4-25-calculator-zile-lucratoare`

**Hashtag-uri:** #resurseumane #contabilitate #zilelibere

### Imaginea

Fără captură: calculatorul nu are un model completat în `public/capturi/unelte/`.
Șablonul 5: **21** · „de zile lucrătoare în decembrie 2026, din 23 de luni până
vineri.” · „1 decembrie și 25 decembrie sunt sărbători legale. Calculatorul le
scade singur.” · temei art. 139 alin. (1) Codul muncii ·
administrativo.ro/unelte/calculator-zile-lucratoare.

**Text alternativ:** Cifra „21” mare, cu textul „de zile lucrătoare în
decembrie 2026, din 23 de luni până vineri”. Dedesubt: 1 decembrie și
25 decembrie sunt sărbători legale, iar calculatorul le scade singur. Temeiul:
articolul 139 alineatul 1 din Codul muncii.

---

## #26 · joi 5 nov · imagine

**Pilon:** Unelte (pătrat verde). **Sursă:** pagina
`/unelte/adeverinta-salariat` („fără CNP în formular”: tot ce se scrie stă în
adresa paginii, iar CNP-ul se completează de mână; art. 34 alin. (5); formularul
propriu al băncii sau al casei de asigurări; cele două rânduri de semnătură),
`reges.ts` (legătura „Adeverință de salariat (art. 34 alin. (5))”).

### Textul postării

> Am făcut un model de adeverință de salariat care nu vă cere CNP-ul.
> Intenționat.
>
> Tot ce completați în formularul de pe site stă în adresa paginii, iar adresa
> rămâne în istoricul browserului. Un CNP n-are ce căuta acolo. Așa că rândul
> lui rămâne liber pe adeverință: îl scrieți de mână pe foaia tipărită sau în
> Word, după descărcare.
>
> Restul îl completează formularul: firma, salariatul, funcția, data angajării,
> tipul contractului și norma. Opțional, salariul brut, numărul de înregistrare
> și destinația: „pentru medicul de familie”, „pentru bancă”.
>
> Obligația vine din art. 34 alin. (5) din Codul muncii: la cererea salariatului
> sau a unui fost salariat, angajatorul e obligat să elibereze un document care
> atestă activitatea, durata ei, salariul și vechimea în muncă, în meserie și în
> specialitate.
>
> Două lucruri de știut:
>
> → dacă banca sau casa de asigurări au formularul lor, se completează acela
> → modelul are două rânduri de semnătură: pentru reprezentantul legal și
> pentru cine a întocmit adeverința
>
> Word sau PDF, fără cont.
>
> Pentru ce vi se cer cel mai des adeverințe de salariat?

**Primul comentariu:**
`Adeverința de salariat, fără CNP în formular: https://administrativo.ro/unelte/adeverinta-salariat?utm_source=linkedin&utm_medium=social&utm_campaign=t4-26-adeverinta-salariat`

**Hashtag-uri:** #resurseumane #contabilitate #IMM

### Imaginea

Șablonul 6, „Captură”: **Fără CNP** · „în formular. Rândul lui rămâne liber,
pentru scris de mână.” · rama foii în jurul capturii
`adeverinta-salariat-exemplu-1200.webp`, decupată pe antet și pe primul
paragraf, cu rândul liber de după „CNP” · temei art. 34 alin. (5) Codul muncii
· administrativo.ro/unelte/adeverinta-salariat.

**Text alternativ:** Textul „Fără CNP în formular. Rândul lui rămâne liber,
pentru scris de mână”. Dedesubt, modelul completat al adeverinței de salariat
pentru Popescu Ana, contabil la Administrativo Demo SRL, cu rândul de după
„CNP” lăsat liber. Temeiul: articolul 34 alineatul 5 din Codul muncii.

---

## #27 · vineri 6 nov · imagine

**Pilon:** Unelte (pătrat verde). **Sursă:** pagina
`/unelte/cerere-concediu-de-odihna` (art. 145 alin. (3); zilele scoase,
enumerate cu motivul; până la trei fracțiuni și avertismentul de 10 zile, art.
148 alin. (5); data cultului, art. 139 alin. (2¹); zilele libere din contractul
colectiv, de scăzut de firmă), `concediu-odihna.ts` (art. 145 alin. (3)).
Intervalul, din unealta live (`?de_la=2026-12-21&pana_la=2026-12-31`): 11 zile
pe calendar, 2 de weekend, Crăciunul, 8 zile lucrătoare.

### Textul postării

> 21–31 decembrie: 11 zile pe calendar. Pe cererea de concediu, 8.
> Crăciunul și weekendul nu vă consumă zile de concediu.
>
> Art. 145 alin. (3) din Codul muncii scoate din durata concediului de odihnă
> sărbătorile legale în care nu se lucrează. Pe intervalul ăsta:
>
> → 21–24 decembrie: 4 zile de concediu
> → 25 decembrie, Crăciunul, cade vineri și nu se numără
> → 26–27 decembrie: weekend
> → 28–31 decembrie: încă 4 zile
>
> Cererea de concediu de pe site face socoteala singură și o scrie în cerere:
> perioada, numărul de zile lucrătoare și, separat, zilele scoase, cu motivul
> lângă fiecare. Mai are:
>
> → până la trei fracțiuni în aceeași cerere, cu un avertisment când niciuna nu
> are 10 zile lucrătoare neîntrerupte (art. 148 alin. 5)
> → Paștele și Rusaliile la data cultului, pentru salariații altui cult creștin
> (art. 139 alin. 2¹)
> → rubricile angajatorului: zile cuvenite, rămase din anul anterior, efectuate
> și rămase după cerere
>
> Zilele libere plătite din contractul colectiv nu le putem ști, fiindcă sunt
> ale fiecărei firme. Pe ele le scădeți voi.
>
> La voi, firma închide între Crăciun și Anul Nou sau fiecare își cere concediu?

**Primul comentariu:**
`Cererea de concediu, cu zilele lucrătoare calculate: https://administrativo.ro/unelte/cerere-concediu-de-odihna?utm_source=linkedin&utm_medium=social&utm_campaign=t4-27-cerere-concediu-de-odihna`

**Hashtag-uri:** #concediu #resurseumane #zilelibere

### Imaginea

Fără captură: cererea de concediu nu are un model completat în
`public/capturi/unelte/`. Șablonul „Interval”: **8 zile** · „de concediu pentru
21–31 decembrie 2026, din 11 pe calendar.” · calendarul celor două săptămâni,
21 decembrie – 3 ianuarie: 21–24 și 28–31 decembrie concediu, 25 decembrie și
1 ianuarie sărbători în timpul săptămânii, weekendurile hașurate · temei
art. 145 alin. (3) Codul muncii ·
administrativo.ro/unelte/cerere-concediu-de-odihna.

**Text alternativ:** Textul „8 zile de concediu pentru 21–31 decembrie 2026, din
11 pe calendar”, deasupra unui calendar pe două săptămâni: concediu de luni
până joi, Crăciunul vineri, weekendul, apoi concediu de luni până joi și Anul
Nou vineri. Temeiul: articolul 145 alineatul 3 din Codul muncii.
