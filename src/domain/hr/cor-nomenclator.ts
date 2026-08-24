// src/domain/hr/cor-nomenclator.ts
// Clasificarea Ocupațiilor din România (COR) — codul pe 6 cifre și denumirea,
// singurul nivel pe care îl cer REVISAL și D112 la declararea unei funcții.
//
// SURSA: portalul oficial de date deschise al Guvernului României,
// `data.gov.ro/dataset/clasificarea-ocupatiilor-din-romania`, resursa „COR -
// Lista ocupațiilor în ordinea crescătoare a codurilor",
// `isco-08-lista-cresc-cod-ocupatii-cor-2024.xml` (ediția 2024, aliniată
// ISCO-08). Documentul e un pachet Word XML; extragerea a citit CELULELE
// tabelului, nu textul aplatizat — codul și denumirea stau în celule diferite,
// iar aplatizarea le-ar fi lipit.
//
// De ce există fișierul: până acum `job_positions.cod_cor` era text liber,
// validat DOAR cu `^[0-9]{6}$`. Șase cifre inventate treceau nedetectate până la
// exportul REVISAL, unde codul e blocant — adică luni mai târziu, la prima
// transmitere către ITM, când funcția e deja pe contractele semnate ale mai
// multor oameni. Contrastul era izbitor: pentru CAEN existau 651 de clase
// verificate, pentru COR nimic.
//
// DE CE UN ȘIR, NU 4422 DE OBIECTE LITERALE.
// Varianta cu `[{ cod: "…", denumire: "…" }, …]` cerea `tsc` să infereze și să
// verifice 4422 de tipuri de obiect: typecheck-ul trecea de la câteva secunde
// la peste două minute. Aici e un singur literal de șir, despicat o dată la
// încărcarea modulului. Separatorul e `\u0001`, un caracter de control care nu
// poate apărea într-o denumire de ocupație.
//
// Nu re-generați fără motiv: nomenclatorul se schimbă doar prin ordin comun
// MMPS/INS.

import { cheieCautare } from "@/lib/text/diacritice";

export type CodCor = Readonly<{
  /** 6 cifre. Prima = grupa majoră, a doua = subgrupa majoră, a treia = grupa minoră. */
  cod: string;
  denumire: string;
}>;

/** `cod` + denumire, despărțite prin `\u0001`; o ocupație per linie. */
const DATE_COR = `\
111101\u0001adjunct al procurorului general
111102\u0001ambasador
111103\u0001chestor Parlament
111104\u0001comandant unic aviație
111105\u0001comisar general
111106\u0001comisar general adjunct
111107\u0001senator
111108\u0001guvernator
111109\u0001președinte Academie
111110\u0001președinte Înalta Curte de Casație și Justiție
111111\u0001președinte curte de apel
111112\u0001președinte Curtea de Conturi a României
111113\u0001președinte de judecătorie
111114\u0001președinte Camera Deputaților
111115\u0001președinte secție (la Înalta Curte de Casație și Justiție, la curtea de apel, tribunale și judecătorii)
111116\u0001președinte tribunal
111117\u0001Președintele României
111118\u0001prim-procuror
111119\u0001prim-procuror adjunct
111120\u0001prim-adjunct al procurorului general
111121\u0001prim-ministru
111122\u0001procuror general
111123\u0001procuror șef de secție
111124\u0001procuror șef de secție adjunct
111125\u0001secretar general al Guvernului
111126\u0001secretar Parlament
111127\u0001secretar de stat
111128\u0001vicepreședinte (la Înalta Curte de Casație și Justiție, Curtea de Apel, tribunale și judecătorii)
111129\u0001inspector-șef al Inspecției Judiciare de pe lângă Plenul Consiliului Superior al Magistraturii
111130\u0001membru al Consiliului Superior al Magistraturii
111131\u0001secretar general adjunct al Consiliului Superior al Magistraturii
111132\u0001inspector în cadrul Inspecției Judiciare pentru judecători/ procurori de pe lângă Plenul Consiliului Superior al Magistraturii
111133\u0001inspector general judecătoresc șef
111134\u0001ministru
111135\u0001ministru consilier
111136\u0001ministru de stat
111137\u0001ministru plenipotențiar
111138\u0001deputat
111139\u0001președinte Senat
111140\u0001subsecretar de stat
111201\u0001consilier diplomatic
111202\u0001consilier guvernamental
111203\u0001consilier și consultant juridic
111204\u0001consilier instituții publice
111205\u0001consilier al ministrului
111206\u0001consul general
111207\u0001director instituție publică
111208\u0001director adjunct instituție publică
111209\u0001director de cabinet
111210\u0001director general instituție publică
111211\u0001consilier economic
111212\u0001inspector de stat șef
111213\u0001inspector-șef în administrația publică
111214\u0001magistrat-asistent-șef
111215\u0001notar-șef
111216\u0001notar-șef adjunct
111217\u0001secretar-șef notariat
111218\u0001prefect
111219\u0001secretar general
111220\u0001șef birou instituție publică
111221\u0001șef cabinet
111222\u0001șef birou senatorial
111223\u0001șef departament
111224\u0001șef protocol de stat
111225\u0001șef serviciu instituție publică
111226\u0001subprefect
111227\u0001viceguvernator
111228\u0001președinte instituție publică
111229\u0001consilier prezidențial
111230\u0001consilier parlamentar
111231\u0001vicepreședinte instituție publică
111232\u0001atașat diplomatic
111233\u0001consul
111234\u0001secretar diplomatic
111235\u0001viceconsul
111236\u0001consultant prezidențial și guvernamental
111237\u0001secretar general Academie
111238\u0001director general adjunct
111239\u0001investigator șef
111240\u0001inspector șef teritorial
111241\u0001consilier de stat
111301\u0001primar
111302\u0001secretar primărie, prefectură
111303\u0001viceprimar
111401\u0001consilier organizație politică
111402\u0001președinte consilier organizație politică
111403\u0001vicepreședinte organizație politică
111404\u0001secretar organizație politică
111405\u0001conducător de asociații, filiale și organizații obștești
111406\u0001locțiitor al conducătorului de asociații, filiale și organizații obștești
111407\u0001secretar și secretar adjunct ai asociațiilor, filialelor și organizațiilor obștești
111408\u0001președinte organizație sindicală
111409\u0001vicepreședinte organizație sindicală
111410\u0001secretar organizație sindicală
111411\u0001delegat sindical
111412\u0001președinte asociație națională cooperatistă
111413\u0001vicepreședinte asociație națională cooperatistă
111414\u0001secretar general asociație națională cooperatistă
111415\u0001președinte asociație teritorială de organizații cooperatiste
111416\u0001vicepreședinte asociație teritorială de organizații cooperatiste
111417\u0001secretar asociație teritorială de organizații cooperatiste
111418\u0001șef departament organizație sindicală
111419\u0001președinte organizație cooperatistă
111420\u0001vicepreședinte organizație cooperatistă
111421\u0001președinte asociație patronală
111422\u0001vicepreședinte asociație patronală
111423\u0001președinte organizație profesională națională
111424\u0001vicepreședinte organizație profesională națională
111425\u0001secretar național organizație profesională națională
111426\u0001președinte organizație profesională, filială județeană/ municipiu
111427\u0001vicepreședinte organizație profesională, filială județeană/ municipiu
111428\u0001secretar organizație profesională, filială județeană/ municipiu
111429\u0001consilier președinte organizație profesională națională
111430\u0001consilier președinte organizație profesională, filială județeană/ municipiu
111431\u0001șef departament/ compartiment/ președinte comisie organizație profesională, filială județeană/ municipiu
111432\u0001delegat sindical local
111433\u0001conducător de organizații umanitare
111434\u0001secretar al organizațiilor umanitare
112001\u0001comandant/ comandant adjunct aviație
112002\u0001comandant port, flotă
112003\u0001decan, rector, prorector, prodecan
112004\u0001director societate comercială
112005\u0001director adjunct societate comercială
112006\u0001inspector general școlar
112007\u0001director științific cercetare-dezvoltare
112008\u0001inspector sanitar șef
112009\u0001medic (farmacist) director
112010\u0001medic (farmacist) director adjunct
112011\u0001director general societate comercială
112012\u0001director general adjunct societate comercială
112013\u0001director de program
112014\u0001director general regie autonomă
112015\u0001director general adjunct regie autonomă
112016\u0001director control risc
112017\u0001director comercial
112018\u0001director vânzări
112019\u0001director/ director adjunct, inspector-șef
112020\u0001director economic
112021\u0001director magazin
112022\u0001șef corp executori bancari
112023\u0001director sucursală
112024\u0001director tehnic
112025\u0001director general institut național de cercetare-dezvoltare
112026\u0001director incubator tehnologic de afaceri
112027\u0001director departament cercetare-dezvoltare
112028\u0001manager general
112029\u0001manager
112030\u0001șef cancelarie
112031\u0001director de societate comercială agricolă
112032\u0001antreprenor în economia socială
112033\u0001director resurse umane
112034\u0001inspector școlar general adjunct
112035\u0001director casa corpului didactic
112036\u0001manager de întreprindere socială
112037\u0001producător general
112038\u0001director dezvoltare afacere în domeniul agroalimentar
112039\u0001manager în servicii sociale
112040\u0001director executiv cooperativă agricolă
121101\u0001președinte bancă/ vicepreședinte/ prim-vicepreședinte
121102\u0001economist-șef
121103\u0001director general/ director general adjunct bancă/ societate de leasing
121104\u0001director executiv bancă/ director/director adjunct
121105\u0001șef departament bancă/ șef-adjunct departament
121106\u0001șef proiect bancă
121107\u0001șef serviciu/ șef birou/ bancă/ societate de leasing
121108\u0001coordonator compartiment/ colectiv bancă
121109\u0001dealer-șef (arbitragist bancă)
121110\u0001director unitate bancară operațională/ director adjunct unitate bancară operațională
121111\u0001șef agenție bancară
121112\u0001contabil-șef/ director financiar/ bancă/ societate de leasing
121113\u0001director de arhivă bancă
121114\u0001director/ director adjunct divizie/ direcție de leasing
121116\u0001director/ director executiv conformitate
121117\u0001coordonator conformitate
121118\u0001manager securitatea informației (Chief Information Security Officer -CISO)
121119\u0001comisar șef divizie Garda Financiară
121120\u0001contabil-șef
121121\u0001controlor financiar
121122\u0001șef agenție CEC
121123\u0001șef birou/ serviciu/ secție circumscripție financiară
121124\u0001șef birou/ serviciu financiar-contabilitate
121125\u0001manager financiar
121126\u0001manager relații financiare externe
121127\u0001controlor revizor financiar
121128\u0001șef birou financiar
121129\u0001șef birou contabilitate
121130\u0001șef birou analize economice
121131\u0001auditor public extern
121201\u0001șef birou calificare și recalificare
121202\u0001șef birou pensii
121203\u0001șef birou șomaj
121204\u0001șef oficiu șomaj
121205\u0001șef serviciu resurse umane
121206\u0001șef serviciu evaluarea resurselor de muncă
121207\u0001manager resurse umane
121208\u0001șef centru perfecționare
121209\u0001șef birou resurse umane
121301\u0001șef birou organizație politică, obștească, umanitară
121302\u0001șef serviciu organizație politică, obștească, umanitară
121303\u0001inspector protecție civilă
121304\u0001șef executiv audit intern
121306\u0001manager de securitate
121307\u0001manager energetic
121308\u0001manager informații pentru afaceri
121309\u0001manager pentru ordine și siguranță publică
121310\u0001șef birou corp control
121311\u0001manager comunicare guvernamentală
121901\u0001șef serviciu
121902\u0001șef atelier
121903\u0001șef secție
121904\u0001șef birou
121905\u0001procuror șef birou/ serviciu
121906\u0001șef birou/ serviciu administrativ
121907\u0001registrator coordonator
121908\u0001registrator-șef
121909\u0001grefier-șef (judecătorie, parchet)
121910\u0001grefier șef de secție (curte de apel, tribunal, parchete)
121911\u0001prim-grefier
121912\u0001șef laborator criminalistică
121913\u0001șef proces fabricație
121914\u0001șef secțiune tehnică
121915\u0001șef linie fabricație
121916\u0001responsabil industrializare produs
121917\u0001șef grup funcțional tehnic
121918\u0001șef sucursală (studii superioare)
121919\u0001șef compartiment (studii superioare)
121920\u0001director pentru relația cu investitorii
122101\u0001șef serviciu marketing
122102\u0001șef birou marketing
122103\u0001șef licitație
122104\u0001director operații tranzacții
122105\u0001șef casă compensație
122106\u0001șef agenție bursieră
122107\u0001manager marketing (tarife, contracte, achiziții)
122108\u0001conducător firmă mică - patron (girant) în afaceri, intermedieri și alte servicii comerciale
122109\u0001responsabil produs
122110\u0001manager clienți strategici
122201\u0001șef agenție reclamă publicitară
122202\u0001șef birou reclamă publicitară
122203\u0001șef serviciu reclamă publicitară
122301\u0001arhitect-șef
122302\u0001geolog-șef
122303\u0001secretar științific
122304\u0001șef formație lucrări geologice
122305\u0001șef formație cercetare-dezvoltare
122306\u0001meteorolog-șef
122307\u0001director filială cercetare-proiectare
122308\u0001șef atelier ediție, multiplicare, expediție
122309\u0001șef proiect cercetare-proiectare
122310\u0001șef secție cercetare-proiectare
122311\u0001șef atelier cercetare-proiectare
122312\u0001responsabil CTE (control tehnic-economic) în cercetare-proiectare
122313\u0001director proiect
122314\u0001șef proiect/ program
122315\u0001inspector-șef inspecția meteorologică națională
131101\u0001hidrometeorolog-șef
131102\u0001inginer-șef agricultură și silvicultură
131103\u0001inspector general vânătoare
131104\u0001medic veterinar șef
131105\u0001șef centru protecția plantelor și mediului
131106\u0001șef centru reproducția și selecția animalelor
131107\u0001șef district, centru, ocol silvic
131108\u0001șef circumscripție sanitar-veterinară și control al alimentelor
131109\u0001șef complex zootehnic
131110\u0001șef fazanerie
131111\u0001șef fermă agricolă (agrozootehnică)
131112\u0001șef laborator analize pedologice
131114\u0001șef parchet
131115\u0001șef pepinieră silvicolă, pomicolă, viticolă
131116\u0001șef stație hidrologică, meteorologică și incubație
131117\u0001șef stație producție, exploatare, întreținere în agricultură
131118\u0001șef stație vinificație
131119\u0001șef stație lucrări de irigație și ameliorare a solului
131120\u0001inspector veterinar șef
131121\u0001șef secție mecanizare
131122\u0001conducător întreprindere mică - patron (girant) în agricultură și silvicultură
131123\u0001președinte cooperativă agricolă
131201\u0001șef păstrăvărie
131202\u0001inginer-șef piscicultură și vânătoare
131203\u0001conducător întreprindere mică - patron (girant) în piscicultură și vânătoare
132101\u0001inginer-șef industria prelucrătoare
132102\u0001șef atelier industria prelucrătoare
132103\u0001șef sector industria prelucrătoare
132104\u0001șef laborator în industria prelucrătoare
132105\u0001șef modul în industria prelucrătoare
132106\u0001șef secție industrie prelucrătoare
132107\u0001șef serviciu industrie prelucrătoare
132108\u0001șef birou industrie prelucrătoare
132109\u0001manager securitate instalații industria prelucrătoare
132110\u0001conducător întreprindere mică - patron (girant) industrie prelucrătoare
132111\u0001șef birou tehnic
132112\u0001șef birou calitate
132113\u0001șef serviciu plan producție
132114\u0001șef structura de securitate
132201\u0001inginer-șef industria extractivă
132202\u0001șef atelier industria extractivă
132203\u0001șef sector industria extractivă
132204\u0001șef modul în industria extractivă
132205\u0001șef secție industrie extractivă
132206\u0001șef serviciu industrie extractivă
132207\u0001șef birou industrie extractivă
132208\u0001manager securitate instalații industria extractivă
132209\u0001conducător întreprindere mică - patron (girant) industrie extractivă
132210\u0001inginer- șef exploatare nucleară
132211\u0001inginer- șef radioprotecție
132212\u0001șef unități miniere
132213\u0001șef brigadă exploatare minieră
132214\u0001inspector- șef conservarea energiei
132215\u0001șef centru prelucrare
132216\u0001șef laborator control tehnic de calitate a combustibilului nuclear
132217\u0001șef serviciu tehnic și componente nucleare
132218\u0001șef serviciu termochimic
132219\u0001șef uzină, centrală electrică, gaze, apă
132220\u0001șef centrală electrică, gaze și apă
132221\u0001șef atelier reparații capitale
132222\u0001inspector general industria petrolieră
132223\u0001șef formație industria petrolieră/ petrochimică
132224\u0001șef instalație petrolieră
132225\u0001șef laborator industria petrolieră
132226\u0001șef stație epurare ape reziduale
132227\u0001supervizor geolog și foraj
132228\u0001șef formație în industria de mașini și echipamente
132229\u0001șef/ șef adjunct stație electrică
132230\u0001șef/ șef adjunct centru exploatare rețele electrice
132231\u0001șef dispecer energetic central (DEC)
132232\u0001șef dispecer energetic teritorial (DET)
132233\u0001șef formație la fabricarea armamentului și muniției
132234\u0001șef schimb
132235\u0001șef formație
132301\u0001ajutor șef brigadă în construcții
132302\u0001inginer- șef în construcții
132303\u0001conducător antrepriză construcții-montaj
132304\u0001șef atelier în construcții
132305\u0001șef brigadă complexă sau specializată
132306\u0001șef laborator în construcții
132307\u0001șef lot
132308\u0001șef șantier
132309\u0001șef sector (secție) drumuri-poduri
132310\u0001șef secție producție, exploatare, întreținere, reparații în construcții și lucrări publice
132311\u0001șef serviciu în construcții
132312\u0001șef birou în construcții
132313\u0001șef sector exploatare îmbunătățiri funciare
132314\u0001șef sistem exploatare îmbunătățiri funciare
132315\u0001conducător întreprindere mică - patron (girant) în construcții
132401\u0001căpitan- șef port
132402\u0001comandant nave maritime
132403\u0001comandant coordonator grup mare pescuit oceanic
132404\u0001conducător (director și director adjunct) Administrația Filială Dunărea de Jos (AFDJ)
132405\u0001director zbor
132406\u0001inginer- șef transporturi
132407\u0001picher șef district
132408\u0001revizor general siguranța circulației
132409\u0001șef agenție navală
132410\u0001șef atelier aeroport
132411\u0001șef atelier transporturi
132412\u0001șef autobază
132413\u0001șef birou aeroport
132414\u0001șef birou/ serviciu relații internaționale
132415\u0001șef birou/ serviciu transport maritim și fluvial
132416\u0001șef coloană auto
132417\u0001șef depou/ adjunct
132418\u0001șef district căi ferate, poduri, drumuri
132419\u0001șef divizie căi ferate
132420\u0001șef laborator aeroport
132421\u0001șef port
132422\u0001șef regulator circulație căi ferate
132423\u0001șef revizie locomotive, automotoare
132424\u0001șef revizie vagoane
132425\u0001șef secție/ adjunct (sector) transporturi
132426\u0001șef serviciu, centru, stație, aeroport
132427\u0001șef serviciu filială Administrația Filială Dunărea de Jos
132428\u0001șef stație căi ferate
132429\u0001șef stație teleferic
132430\u0001șef agenție pilotaj
132431\u0001șef cart
132432\u0001diriginte oficiu transporturi
132433\u0001șef garaj
132434\u0001comandant instructor
132435\u0001șef mecanic instructor
132436\u0001șef mecanic maritim/ fluvial
132437\u0001șef electrician maritim
132438\u0001șef atelier reparații
132439\u0001conducător activitate de transport rutier
132440\u0001șef trafic auto intern
132441\u0001șef trafic curierat intern
132442\u0001șef departament logistică
132443\u0001șef birou aprovizionare-desfacere
132444\u0001șef depozit
132445\u0001șef serviciu aprovizionare-desfacere
132446\u0001șef siloz
132447\u0001șef stație uscare-condiționare cereale
132448\u0001manager achiziții
132449\u0001manager farmacii
132450\u0001manager aprovizionare
132451\u0001manager relația cu furnizorii
132452\u0001conducător întreprindere mică - patron (girant) în transporturi
132453\u0001șef birou import-export
132454\u0001manager sisteme de transport
132455\u0001șef stație OTF (operator transport feroviar)
132456\u0001director import export cafea, ceai, cacao și mirodenii
132457\u0001manager logistică și distribuție
133001\u0001director centru de calcul
133002\u0001șef oficiu de calcul
133003\u0001șef atelier informatică
133004\u0001șef laborator informatică
133005\u0001director divizie informatică
133006\u0001director departament informatică
133007\u0001manager tehnologia informațiilor și comunicații
133009\u0001conducător de întreprindere mică - patron (girant) în informatică
133010\u0001șef atelier telecomunicații
133011\u0001șef birou exploatare poștală
133012\u0001șef birou radiotelecomunicații
133013\u0001șef centrală telefonică
133014\u0001șef centru control calitate emisie radiofonică
133015\u0001șef centru control calitate emisie televiziune
133016\u0001șef centru control local comunicații
133017\u0001șef centru dirijare zbor
133018\u0001șef centru poștal
133019\u0001șef centru (secție, sector) radiodifuziune
133020\u0001șef centru (secție, sector) telecomunicații
133021\u0001șef centru zonal intervenții radiorelee
133022\u0001șef centru zonal de intervenții translatare TV
133023\u0001șef formație comunicații
133024\u0001șef formație operațională telecomunicații
133025\u0001șef laborator măsurători telecomunicații
133026\u0001șef laborator radioteleviziune
133027\u0001șef laborator telecomunicații
133028\u0001șef lot telecomunicații
133029\u0001șef rețea telecomunicații
133030\u0001șef serviciu control zonal comunicații
133031\u0001șef serviciu exploatare poștală
133032\u0001șef serviciu informare zbor
133033\u0001șef serviciu navigație
133034\u0001șef serviciu radiotelecomunicații
133035\u0001șef stație comunicații prin satelit
133036\u0001șef stație radiorelee
133037\u0001șef stație televiziune
133038\u0001șef studio
133039\u0001telefonist- șef
133040\u0001telegrafist- șef
133041\u0001șef oficiu zonal poștă
133042\u0001șef oficiu special poștă
133043\u0001diriginte oficiu telecomunicații
133044\u0001șef turn telecomunicații
133045\u0001șef stație radiotelegrafie (RTG)
133046\u0001șef Centru Național de Telecomunicații Aeronautice Aviație Civilă
133047\u0001conducător întreprindere mică - patron (girant) în comunicații
134201\u0001asistent medical șef
134202\u0001biochimist șef secție, laborator
134203\u0001biolog șef secție, laborator
134204\u0001chimist șef secție, laborator
134205\u0001farmacist șef secție, laborator
134206\u0001farmacist diriginte
134207\u0001laborant medical șef
134208\u0001medic- șef (policlinică, stație de salvare, centru de recoltare sânge)
134209\u0001medic șef secție, laborator
134210\u0001moașă-șefă
134211\u0001oficiant medical șef
134212\u0001psiholog șef secție, laborator
134213\u0001soră medicală șefă
134214\u0001tehnician sanitar șef
134401\u0001șef serviciu de reintegrare socială și supraveghere
134402\u0001conducător de întreprindere mică - patron (girant) în sănătate
134501\u0001conducător tabără școlară
134502\u0001director unitate de învățământ
134503\u0001secretar științific învățământ, cercetare
134504\u0001șef lectorat
134505\u0001șef catedră
134506\u0001conducător de întreprindere mică - patron (girant) în învățământ
134507\u0001director palate și cluburi ale elevilor
134508\u0001director club sportiv școlar
134601\u0001șef serviciu/ șef birou asigurări
134602\u0001șef serviciu/ șef birou daune
134901\u0001șef expoziții și târguri
134902\u0001șef vamă
134903\u0001inginer- șef întreprinderi de reparații obiecte de uz casnic, curățătorii și alte servicii pentru populație
134904\u0001șef atelier reparații obiecte de uz casnic, curățătorii și alte servicii pentru populație
134905\u0001șef centru reparații
134906\u0001șef centru dezinfecție, deratizare și dezinsecție
134907\u0001coordonator presă
134908\u0001librar – șef
134909\u0001conducător întreprindere mică - patron (girant) în prestări servicii
134910\u0001redactor- șef presă, editură
134911\u0001secretar general agenție presă, editură
134912\u0001secretar general redacție
134913\u0001șef birou exploatare, coordonare presă
134914\u0001șef birou redacție
134915\u0001șef birou relații unități presă
134916\u0001șef oficiu juridic
134917\u0001șef oficiu, serviciu, secție, redacție
134918\u0001producător executiv TV
134919\u0001manager servicii private de securitate
134920\u0001director departament securitate
134921\u0001manager cultural
141101\u0001conducător întreprindere mică - patron (girant) în activitatea hotelieră și restaurante
141102\u0001șef complex hotelier
141103\u0001șef unitate balneoclimaterică
141104\u0001administrator hotel
141105\u0001director de hotel
141106\u0001director de motel
141107\u0001director de hotel pentru tineret
141108\u0001director de camping
141109\u0001director de sat de vacanță
141110\u0001director de popas turistic
141111\u0001director restaurant
141112\u0001director rotiserie
141113\u0001director cramă
141114\u0001director braserie
141115\u0001director berărie
141116\u0001director grădină de vară
141117\u0001director bar
141118\u0001director cafenea
141119\u0001director disco-bar
141120\u0001director unități tip fast-food
141121\u0001director cofetărie, patiserie
141122\u0001director de club (hotelier)
141123\u0001director de cazare
141201\u0001șef restaurant
141202\u0001director de departament alimentație
141203\u0001director de departament catering
142001\u0001președinte cooperativă de consum
142002\u0001șef bază recepție
142003\u0001șef serviciu comerț cu ridicata și cu amănuntul
142004\u0001șef birou comerț cu ridicata și cu amănuntul
142005\u0001vicepreședinte cooperativă de consum
142006\u0001șef stație PECO
142007\u0001șef departament mărfuri alimentare/ nealimentare
142008\u0001manager de zonă
142009\u0001inginer șef firme de afaceri și alte servicii comerciale
142010\u0001șef agenție comercială
142011\u0001conducător întreprindere mică - patron (girant) în comerț
143101\u0001antrenor federație sportivă
143102\u0001comandant aeroclub
143103\u0001consilier teritorial șef inspectoratul pentru cultură
143104\u0001director așezământ cultural
143105\u0001manager al organizației culturale
143106\u0001președinte federație sportivă
143107\u0001președinte complex, club sportiv
143108\u0001secretar general federație sport
143109\u0001șef agenție concursuri hipice
143110\u0001șef producție film
143111\u0001șef secție producție film
143112\u0001șef atelier producție film
143113\u0001șef oficiu interjudețean difuzare film
143114\u0001conducător de întreprindere mică - patron (girant) în sport
143115\u0001administrator structuri sportive
143901\u0001șef atelier decorator
143902\u0001șef agenție/ oficiu turism
143903\u0001șef unitate elementară de lucru
143904\u0001șef atelier presă
143905\u0001șef laborator conservare-restaurare opere de artă
143906\u0001șef serviciu control tehnic presă
143907\u0001conducător de întreprindere mică - patron (girant) în turism
143908\u0001manager în activitatea de turism
143909\u0001director de agenție de turism tour-operatoare/ detailistă/ filială/ sucursală
143910\u0001director centru informare turistică
143911\u0001director de departament organizare evenimente
143912\u0001conducător de pensiune turistică (rurală, agroturistică, montană)
143913\u0001șef serviciu stație, tură meteo
143914\u0001șef centru meteo aeronautic
143915\u0001șef birou/ stație/ tură meteo aeronautic/ de aerodrom
143916\u0001șef Centru Național pentru Protecția Meteorologică a Navigației Aeriene
143917\u0001șef echipă intervenții și supraveghere echipamente în serviciile de trafic aerian
143918\u0001director de departament ticketing
143919\u0001manager destinație turistică
211101\u0001fizician
211102\u0001cercetător în fizică
211103\u0001asistent de cercetare în fizică
211104\u0001cercetător în fizică-chimie
211105\u0001asistent de cercetare în fizică-chimie
211106\u0001cercetător în fizică tehnologică
211107\u0001asistent de cercetare în fizică tehnologică
211108\u0001cercetător în astronomie
211109\u0001asistent de cercetare în astronomie
211110\u0001cercetător de aeronave
211111\u0001inginer de cercetare de aeronave
211112\u0001asistent de cercetare de aeronave
211113\u0001cercetător în construcții aerospațiale
211114\u0001inginer de cercetare în construcții aerospațiale
211115\u0001asistent de cercetare în construcții aerospațiale
211201\u0001meteorolog (studii superioare)
211202\u0001meteorolog previzionist
211203\u0001climatolog
211204\u0001meteorolog aeronautic
211205\u0001consilier/ expert în meteorologie și domenii conexe
211206\u0001asistent meteorolog
211207\u0001meteorolog aeronautic prognozist
211208\u0001coordonator intervenții active în atmosferă
211209\u0001cercetător în meteorologie
211210\u0001asistent de cercetare în meteorologie
211301\u0001chimist
211302\u0001consilier chimist
211303\u0001expert chimist
211304\u0001inspector de specialitate chimist
211305\u0001referent de specialitate chimist
211306\u0001cercetător în chimie
211307\u0001asistent de cercetare în chimie
211308\u0001cercetător în biochimie tehnologică
211309\u0001asistent de cercetare în biochimie tehnologică
211310\u0001cercetător în chimie fizică
211311\u0001asistent de cercetare în chimie fizică
211312\u0001chimist analist
211401\u0001consilier geolog
211402\u0001expert geolog
211403\u0001inspector de specialitate geolog
211404\u0001referent de specialitate geolog
211405\u0001consilier geofizician
211406\u0001expert geofizician
211407\u0001inspector de specialitate geofizician
211408\u0001referent de specialitate geofizician
211409\u0001consilier hidrogeolog
211410\u0001expert hidrogeolog
211411\u0001inspector de specialitate hidrogeolog
211412\u0001referent de specialitate hidrogeolog
211413\u0001consilier hidrolog
211414\u0001expert hidrolog
211415\u0001inspector de specialitate hidrolog
211416\u0001referent de specialitate hidrolog
211417\u0001consilier pedolog
211418\u0001expert pedolog
211419\u0001inspector de specialitate pedolog
211420\u0001referent de specialitate pedolog
211421\u0001inginer geolog
211422\u0001geolog
211423\u0001geofizician
211424\u0001hidrolog
211425\u0001pedolog
211426\u0001cercetător în geologie
211427\u0001asistent de cercetare în geologie
211428\u0001cercetător în geologie tehnică
211429\u0001asistent de cercetare în geologie tehnică
211430\u0001cercetător în geofizică
211431\u0001asistent de cercetare în geofizică
211432\u0001cercetător în mineralogia tehnică și experimentală
211433\u0001asistent de cercetare în mineralogia tehnică și experimentală
211434\u0001cercetător în geochimie
211435\u0001asistent de cercetare în geochimie
211436\u0001cercetător în geologie petrolieră
211437\u0001asistent de cercetare în geologie petrolieră
211438\u0001cercetător în geodezie
211439\u0001inginer de cercetare în geodezie
211440\u0001asistent de cercetare în geodezie
211441\u0001geomorfolog
211444\u0001cercetător științific în domeniul hidrologiei, hidrogeologiei și gospodăririi apelor
211445\u0001asistent de cercetare științifică în domeniul hidrologiei, hidrogeologiei și gospodăririi apelor
211446\u0001hidrogeolog
212001\u0001consilier matematician
212002\u0001expert matematician
212003\u0001inspector de specialitate matematician
212004\u0001referent de specialitate matematician
212005\u0001consilier actuar
212006\u0001expert actuar
212007\u0001inspector de specialitate actuar
212008\u0001referent de specialitate actuar
212009\u0001matematician
212010\u0001actuar (studii superioare)
212011\u0001consilier statistician
212012\u0001expert statistician
212013\u0001inspector de specialitate statistician
212014\u0001referent de specialitate statistician
212015\u0001cercetător în matematică
212016\u0001asistent de cercetare în matematică
212017\u0001cercetător în matematică mecanică
212018\u0001asistent de cercetare în matematică-mecanică
212019\u0001cercetător în matematică aplicată
212020\u0001asistent de cercetare în matematică aplicată
212021\u0001cercetător în matematică-fizică
212022\u0001asistent de cercetare în matematică-fizică
212023\u0001cercetător în matematică informatică
212024\u0001asistent de cercetare în matematică-informatică
212025\u0001cercetător în statistică
212026\u0001asistent de cercetare în statistică
212027\u0001cercetător în demografie
212028\u0001asistent de cercetare în demografie
213101\u0001consilier biolog
213102\u0001expert biolog
213103\u0001inspector de specialitate biolog
213104\u0001referent de specialitate biolog
213105\u0001consilier botanist
213106\u0001expert botanist
213107\u0001inspector de specialitate botanist
213108\u0001referent de specialitate botanist
213109\u0001consilier zoolog
213110\u0001expert zoolog
213111\u0001inspector de specialitate zoolog
213112\u0001referent de specialitate zoolog
213114\u0001biolog
213115\u0001zoolog
213116\u0001botanist
213117\u0001consilier bacteriolog
213118\u0001expert bacteriolog
213119\u0001inspector de specialitate bacteriolog
213120\u0001referent de specialitate bacteriolog
213121\u0001consilier biochimist
213122\u0001expert biochimist
213123\u0001inspector de specialitate biochimist
213124\u0001referent de specialitate biochimist
213125\u0001consilier farmacolog
213126\u0001expert farmacolog
213127\u0001inspector de specialitate farmacolog
213128\u0001referent de specialitate farmacolog
213129\u0001consilier microbiolog
213130\u0001expert microbiolog
213131\u0001inspector de specialitate microbiolog
213132\u0001referent de specialitate microbiolog
213133\u0001farmacolog
213134\u0001bacteriolog
213135\u0001microbiolog
213136\u0001cercetător în biologie
213137\u0001asistent de cercetare în biologie
213138\u0001cercetător în microbiologie-bacteriologie
213139\u0001asistent de cercetare în microbiologie-bacteriologie
213140\u0001cercetător în biologie chimie
213141\u0001asistent de cercetare în biologie chimie
213142\u0001cercetător în botanică
213143\u0001asistent de cercetare în botanică
213144\u0001cercetător în domeniul zoologic
213145\u0001asistent de cercetare în domeniul zoologic
213146\u0001cercetător în ecologie și protecția mediului
213147\u0001asistent de cercetare în ecologie și protecția mediului
213148\u0001cercetător în ingineria genetică
213149\u0001asistent de cercetare în ingineria genetică
213150\u0001cercetător în antropologie biologică
213151\u0001asistent de cercetare în antropologie biologică
213152\u0001inginer biotehnolog
213201\u0001consilier inginer agronom
213202\u0001expert inginer agronom
213203\u0001inspector de specialitate inginer agronom
213204\u0001referent de specialitate inginer agronom
213205\u0001consilier inginer horticol
213206\u0001expert inginer horticol
213207\u0001inspector de specialitate inginer horticol
213208\u0001referent de specialitate inginer horticol
213209\u0001consilier inginer zootehnist
213210\u0001expert inginer zootehnist
213211\u0001inspector de specialitate inginer zootehnist
213212\u0001referent de specialitate inginer zootehnist
213213\u0001subinginer agronom
213214\u0001subinginer zootehnist
213215\u0001inginer tehnolog în zootehnie
213216\u0001proiectant inginer în agricultură
213217\u0001proiectant inginer în zootehnie
213218\u0001proiectant inginer în silvicultură
213219\u0001consilier inginer silvic
213220\u0001expert inginer silvic
213221\u0001inspector de specialitate inginer silvic
213222\u0001referent de specialitate inginer silvic
213223\u0001inginer îmbunătățiri funciare
213224\u0001inginer/ subinginer silvic
213225\u0001inginer agronom
213226\u0001inginer zootehnist
213227\u0001consultant tehnic în producția de cereale, plante tehnice și furaje
213228\u0001subinginer îmbunătățiri funciare
213229\u0001agent agricol
213230\u0001inginer horticultor
213232\u0001tehnician agronom - exploatare
213233\u0001tehnician zootehnist - exploatare
213234\u0001tehnician silvic - exploatare
213236\u0001bonitor la animalele de fermă
213237\u0001administrator bunuri agricole
213238\u0001consultant afaceri în agricultură
213239\u0001cercetător în agricultură
213240\u0001inginer de cercetare în agricultură
213241\u0001asistent de cercetare în agricultură
213242\u0001inginer de cercetare în pedologie-agrochimie
213243\u0001asistent de cercetare în pedologie-agrochimie
213244\u0001cercetător în pedologie-agrochimie
213245\u0001cercetător în horticultură
213246\u0001inginer de cercetare în horticultură
213247\u0001asistent de cercetare în horticultură
213248\u0001cercetător în agromontanologie
213249\u0001inginer de cercetare în agromontanologie
213250\u0001asistent de cercetare în agromontanologie
213251\u0001cercetător în silvicultură
213252\u0001inginer de cercetare în silvicultură
213253\u0001asistent de cercetare în silvicultură
213254\u0001cercetător în zootehnie
213255\u0001asistent de cercetare în zootehnie
213256\u0001cercetător în biotehnologie pentru agricultură
213257\u0001asistent de cercetare în biotehnologie pentru agricultură
213301\u0001expert ecolog
213302\u0001inspector de specialitate ecolog
213303\u0001referent de specialitate ecolog
213304\u0001inginer ecolog
213305\u0001ecolog
213306\u0001specialist arii protejate
213307\u0001inspector de specialitate în gospodărirea apelor
213308\u0001consilier ecolog
213309\u0001specialist în management și remediere situri contaminate
213310\u0001specialist în managementul deșeurilor
213311\u0001auditor de mediu
213312\u0001manager al sistemelor de management de mediu
214101\u0001inginer confecții piele și înlocuitori
214102\u0001inginer textile, pielărie
214103\u0001inginer tricotaje, confecții
214104\u0001subinginer textile, pielărie
214105\u0001proiectant inginer textile, pielărie
214106\u0001consilier inginer textile, pielărie
214107\u0001expert inginer textile, pielărie
214108\u0001inspector specialitate inginer textile, pielărie
214109\u0001referent de specialitate inginer textile, pielărie
214110\u0001conceptor/ conceptor CAO
214111\u0001specialist încercări componente vehicule/ grup motopropulsor/ optimizare energetică/ sisteme de măsurare
214112\u0001specialist documentație studii
214113\u0001instructor sistem de producție
214114\u0001metodist
214115\u0001responsabil afacere
214116\u0001manager de clădire
214117\u0001inginer industrializarea lemnului
214118\u0001subinginer industrializarea lemnului
214119\u0001consilier inginer industrializarea lemnului
214120\u0001expert inginer industrializarea lemnului
214121\u0001inspector de specialitate inginer industrializarea lemnului
214122\u0001referent de specialitate inginer industrializarea lemnului
214123\u0001cercetător în tehnologia prelucrării produselor agricole
214124\u0001inginer de cercetare în tehnologia prelucrării produselor agricole
214125\u0001asistent de cercetare în tehnologia prelucrării produselor agricole
214126\u0001cercetător în pescuit și acvacultură
214127\u0001inginer de cercetare în pescuit și acvacultură
214128\u0001asistent de cercetare în pescuit și acvacultură
214129\u0001specialist în domeniul calității
214130\u0001auditor în domeniul calității
214131\u0001analist calitate
214132\u0001analist măsurători metrologice
214133\u0001analist studiul materialelor
214134\u0001consultant sistem de calitate
214135\u0001logistician gestiune flux
214136\u0001programator fabricație/ lansator fabricație
214137\u0001documentarist ordonanțare logistică
214138\u0001auditor energetic pentru clădiri
214139\u0001auditor în managementul riscului
214140\u0001specialist în managementul riscului
214141\u0001auditor / evaluator sisteme de management de securitate
214142\u0001inginer în producția alimentară
214143\u0001inginer mentenanță și reparații
214144\u0001inginer transporturi rutiere de mărfuri
214145\u0001inginer transporturi rutiere de persoane
214201\u0001inginer construcții civile, industriale și agricole
214202\u0001subinginer construcții civile, industriale și agricole
214203\u0001inginer instalații pentru construcții
214204\u0001inginer căi ferate, drumuri și poduri
214205\u0001inginer construcții hidrotehnice
214206\u0001inginer constructor instalații
214207\u0001proiectant inginer instalații
214208\u0001proiectant inginer construcții
214209\u0001consilier inginer construcții
214210\u0001expert inginer construcții
214211\u0001inspector de specialitate inginer construcții
214212\u0001referent de specialitate inginer construcții
214213\u0001conducător de lucrări civile
214214\u0001diriginte șantier (studii superioare)
214215\u0001cercetător în construcții civile, industriale și agricole
214216\u0001inginer de cercetare în construcții civile, industriale și agricole
214217\u0001asistent de cercetare în construcții civile, industriale și agricole
214218\u0001cercetător în construcții de căi ferate, drumuri și poduri
214219\u0001inginer de cercetare în construcții de căi ferate, drumuri și poduri
214220\u0001asistent de cercetare în construcții de căi ferate, drumuri și poduri
214221\u0001cercetător în construcții hidrotehnice
214222\u0001inginer de cercetare în construcții hidrotehnice
214223\u0001asistent de cercetare în construcții hidrotehnice
214224\u0001inginer de cercetare în ingineria sanitară și protecția mediului
214225\u0001cercetător în construcții miniere
214226\u0001inginer de cercetare în construcții miniere
214227\u0001asistent de cercetare în construcții miniere
214228\u0001cercetător în instalații
214229\u0001inginer de cercetare în instalații
214230\u0001asistent de cercetare în instalații
214231\u0001cercetător în știința și ingineria materialelor oxidice
214232\u0001inginer de cercetare în ingineria materialelor oxidice
214233\u0001asistent de cercetare în ingineria materialelor oxidice
214234\u0001responsabil tehnic cu urmărirea curentă a comportării construcțiilor
214235\u0001specialist în urmărirea comportării construcțiilor
214236\u0001expert în monitorizarea comportării construcțiilor
214237\u0001specialist în iluminat
214238\u0001administrator port
214239\u0001responsabil tehnic cu execuția
214301\u0001cercetător în centrale hidroelectrice în ingineria mediului
214302\u0001inginer de cercetare în centrale hidroelectrice în ingineria mediului
214303\u0001asistent de cercetare în centrale hidroelectrice în ingineria mediului
214304\u0001inginer protecția mediului în energetică
214305\u0001inginer tehnolog în protecția mediului
214306\u0001inginer pentru controlul poluării mediului
214307\u0001inginer în gestiunea integrată a deșeurilor municipale
214308\u0001inginer tehnologii informatice în protecția mediului
214309\u0001inginer de cercetare în protecția mediului
214310\u0001inginer sisteme informatice pentru instalații și procese de depoluare
214311\u0001inginer auditor/evaluator sisteme de mediu
214312\u0001specialist în reciclarea deșeurilor
214401\u0001inginer mecanic
214402\u0001subinginer mecanic
214403\u0001inginer electromecanic minier
214404\u0001inginer material rulant cale ferată
214405\u0001inginer mecanică agricolă
214406\u0001inginer aviație
214407\u0001inginer nave
214408\u0001inginer mașini-unelte
214409\u0001inginer mecanică fină
214410\u0001inginer mașini termice
214411\u0001inginer mașini hidraulice și pneumatice
214412\u0001inginer autovehicule rutiere
214413\u0001inginer mecanic utilaj tehnologic chimic
214414\u0001inginer mecanic utilaj tehnologic petrolier
214415\u0001inginer mecanic utilaj tehnologic mașini agricole
214416\u0001inginer mecanic utilaj tehnologic textil
214417\u0001inginer mecanic utilaj tehnologic pentru construcții
214418\u0001inginer mecanic utilaj tehnologic pentru prelucrare la cald
214419\u0001inginer mecanic mașini instalații miniere
214420\u0001subinginer mecanic tehnologia construcțiilor de mașini
214421\u0001subinginer mecanic utilaje și tehnica sudurii
214422\u0001subinginer mecanic, mecanică fină
214423\u0001subinginer mecanic material rulant de cale ferată
214424\u0001subinginer mecanic mecanică agricolă
214425\u0001subinginer mecanic utilaj tehnologic pentru chimie
214426\u0001subinginer mecanic utilaje pentru construcții
214427\u0001subinginer mecanic avioane și motoare de aviație
214428\u0001subinginer mecanic construcții corp de navă
214429\u0001subinginer mecanic instalații navale de bord
214430\u0001subinginer mecanic automobile
214431\u0001subinginer mecanic utilaje pentru industria lemnului
214432\u0001subinginer mecanic utilaje pentru materiale de construcție
214433\u0001consilier inginer mecanic
214434\u0001expert inginer mecanic
214435\u0001inspector de specialitate inginer mecanic
214436\u0001referent de specialitate inginer mecanic
214437\u0001proiectant inginer aeronave
214438\u0001proiectant inginer mecanic
214439\u0001inginer pilot de încercare
214440\u0001subinginer proiectant mecanic
214441\u0001specialist reglementări/ cărți de identitate vehicule/ verificări tehnice înmatriculare/ inspecții tehnice/ omologări oficiale
214442\u0001specialist prestații vehicule
214443\u0001specialist mentenanță mecanică echipamente industriale
214444\u0001inginer/ subinginer tehnolog prelucrări mecanice
214445\u0001inginer tehnolog în fabricarea armamentului și muniției
214446\u0001subinginer tehnolog în fabricarea armamentului și muniției
214447\u0001inginer pentru protecția navigației aeriene (comunicații, navigație, supraveghere)
214448\u0001cercetător în sisteme de propulsie
214449\u0001inginer de cercetare în sisteme de propulsie
214450\u0001asistent de cercetare în sisteme de propulsie
214451\u0001cercetător în echipamente și instalații de bord
214452\u0001inginer de cercetare în echipamente și instalații de bord
214453\u0001asistent de cercetare în echipamente și instalații de bord
214454\u0001cercetător în mașini și echipamente termice
214455\u0001inginer de cercetare în mașini și echipamente termice
214456\u0001asistent de cercetare în mașini și echipamente termice
214457\u0001cercetător în mașini hidraulice și pneumatice
214458\u0001inginer de cercetare în mașini hidraulice și pneumatice
214459\u0001asistent de cercetare în mașini hidraulice și pneumatice
214460\u0001cercetător în echipamente de proces
214461\u0001inginer de cercetare în echipamente de proces
214462\u0001asistent de cercetare în echipamente de proces
214463\u0001cercetător în mecanică fină
214464\u0001inginer de cercetare în mecanică fină
214465\u0001asistent de cercetare în mecanică fină
214466\u0001cercetător în tehnologia construcțiilor de mașini
214467\u0001inginer de cercetare în tehnologia construcțiilor de mașini
214468\u0001asistent de cercetare în tehnologia construcțiilor de mașini
214469\u0001cercetător în construcții de mașini agricole
214470\u0001inginer de cercetare în construcții de mașini agricole
214471\u0001asistent de cercetare în construcții de mașini agricole
214472\u0001cercetător în autovehicule rutiere
214473\u0001inginer de cercetare în autovehicule rutiere
214474\u0001asistent de cercetare în autovehicule rutiere
214475\u0001cercetător în utilaje și instalații portuare
214476\u0001inginer de cercetare în utilaje și instalații portuare
214477\u0001asistent de cercetare în utilaje și instalații portuare
214478\u0001cercetător în utilaje și tehnologia ambalării
214479\u0001inginer de cercetare în utilaje și tehnologia ambalării
214480\u0001asistent de cercetare în utilaje și tehnologia ambalării
214481\u0001cercetător în creația tehnică în construcția de mașini
214482\u0001inginer de cercetare în creația tehnică în construcția de mașini
214483\u0001asistent de cercetare în creația tehnică în construcția de mașini
214484\u0001cercetător în mașini și instalații mecanice
214485\u0001inginer de cercetare în mașini și instalații mecanice
214486\u0001asistent de cercetare în mașini și instalații mecanice
214487\u0001cercetător în instalații și utilaje pentru transportul și depozitarea produselor petroliere
214488\u0001inspector suprastructuri mobile mărfuri periculoase
214489\u0001ofițer mecanic
214490\u0001inginer de proces în tratarea/epurarea apei
214491\u0001inginer mecatronist
214492\u0001inginer utilaje gospodărie comunală și ecologizare/salubrizare
214493\u0001inginer sisteme de transport operațional
214494\u0001arhitect naval
214495\u0001cercetător de nave
214496\u0001inginer sudor
214501\u0001inginer petrochimist
214502\u0001subinginer petrochimist
214503\u0001proiectant inginer chimist
214504\u0001consilier inginer chimist
214505\u0001expert inginer chimist
214506\u0001inspector de specialitate inginer chimist
214507\u0001referent de specialitate inginer chimist
214508\u0001consilier inginer petrochimist
214509\u0001expert inginer petrochimist
214510\u0001inspector de specialitate inginer petrochimist
214511\u0001referent de specialitate petrochimist
214512\u0001biochimist
214513\u0001inginer chimist
214514\u0001inginer în industria alimentară
214515\u0001subinginer în industria alimentară
214516\u0001proiectant inginer produse alimentare
214517\u0001consilier inginer industria alimentară
214518\u0001expert inginer industria alimentară
214519\u0001inspector de specialitate inginer industria alimentară
214520\u0001referent de specialitate inginer industria alimentară
214521\u0001cercetător în tehnologia substanțelor anorganice
214522\u0001inginer de cercetare în tehnologia substanțelor anorganice
214523\u0001asistent de cercetare în tehnologia substanțelor anorganice
214524\u0001cercetător în tehnologia substanțelor organice
214525\u0001inginer de cercetare în tehnologia substanțelor organice
214526\u0001asistent de cercetare în tehnologia substanțelor organice
214527\u0001cercetător în petrochimie și carbochimie
214528\u0001inginer de cercetare în petrochimie și carbochimie
214529\u0001asistent de cercetare în petrochimie și carbochimie
214530\u0001cercetător în tehnologia compușilor macromoleculari
214531\u0001inginer de cercetare în tehnologia compușilor macromoleculari
214532\u0001asistent de cercetare în tehnologia compușilor macromoleculari
214533\u0001cercetător în controlul calității produselor alimentare
214534\u0001inginer de cercetare în controlul calității produselor alimentare
214535\u0001asistent de cercetare în controlul calității produselor alimentare
214536\u0001subinginer chimist
214537\u0001expert în prăjirea cafelei
214538\u0001specialist tehnologia alimentelor
214601\u0001inginer metalurgie extractivă
214602\u0001inginer minier
214603\u0001subinginer metalurgist
214604\u0001subinginer minier
214605\u0001inginer preparator minier
214606\u0001consilier inginer metalurg
214607\u0001expert inginer metalurg
214608\u0001inspector de specialitate inginer metalurg
214609\u0001referent de specialitate inginer metalurg
214610\u0001consilier inginer minier
214611\u0001expert inginer minier
214612\u0001inspector de specialitate inginer minier
214613\u0001referent de specialitate inginer minier
214614\u0001inginer prelucrări metalurgice
214615\u0001inginer metalurgie neferoasă
214616\u0001inginer petrolist
214617\u0001subinginer petrolist
214618\u0001consilier inginer petrolist
214619\u0001expert inginer petrolist
214620\u0001referent inginer petrolist
214621\u0001proiectant inginer petrolist
214622\u0001inginer tehnolog metalurg
214623\u0001proiectant inginer metalurg
214624\u0001proiectant inginer în minerit
214625\u0001inginer mineralurg
214626\u0001cercetător în exploatări miniere
214627\u0001inginer de cercetare în exploatări miniere
214628\u0001asistent de cercetare în exploatări miniere
214629\u0001cercetător în prepararea substanțelor minerale utile
214630\u0001inginer de cercetare în prepararea substanțelor minerale utile
214631\u0001asistent de cercetare în prepararea substanțelor minerale utile
214632\u0001cercetător în petrol (extracție-prospecțiune)
214633\u0001inginer de cercetare în petrol (extracție-prospecțiune)
214634\u0001asistent de cercetare în petrol (extracție-prospecțiune)
214635\u0001cercetător în topografie minieră
214636\u0001inginer de cercetare în topografie minieră
214637\u0001asistent de cercetare în topografie minieră
214638\u0001cercetător în ingineria proceselor siderurgice
214639\u0001inginer de cercetare în ingineria proceselor siderurgice
214640\u0001asistent de cercetare în ingineria proceselor siderurgice
214641\u0001cercetător în metalurgia neferoasă
214642\u0001inginer de cercetare în metalurgia neferoasă
214643\u0001asistent de cercetare în metalurgia neferoasă
214644\u0001cercetător în turnarea metalelor
214645\u0001inginer de cercetare în turnarea metalelor
214646\u0001asistent de cercetare în turnarea metalelor
214647\u0001cercetător în prelucrări plastice și tratamente termice
214648\u0001inginer de cercetare în prelucrări plastice și tratamente termice
214649\u0001asistent de cercetare în prelucrări plastice și tratamente termice
214650\u0001cercetător în știința materialelor
214651\u0001inginer de cercetare în știința materialelor
214652\u0001asistent de cercetare în știința materialelor
214653\u0001cercetător în tehnologii carbochimice
214654\u0001inginer de cercetare în tehnologii carbochimice
214655\u0001asistent de cercetare în tehnologii carbochimice
214656\u0001inginer de cercetare în instalații și utilaje pentru transportul și depozitarea produselor petroliere
214657\u0001asistent de cercetare în instalații și utilaje pentru transportul și depozitarea produselor petroliere
214658\u0001inginer foraj
214901\u0001inginer prelucrarea sticlei și ceramicii
214902\u0001subinginer prelucrarea sticlei și ceramicii
214903\u0001inginer materiale de construcții
214904\u0001subinginer materiale de construcții
214905\u0001consilier inginer prelucrarea sticlei și ceramicii
214906\u0001expert inginer prelucrarea sticlei și ceramicii
214907\u0001inspector de specialitate inginer prelucrarea sticlei și ceramicii
214908\u0001referent de specialitate inginer prelucrarea sticlei și ceramicii
214909\u0001proiectant inginer ceramică, sticlă
214910\u0001chimist în materiale oxidice (sticlă, ceramică)
214911\u0001subinginer tehnologia celulozei și hârtiei
214912\u0001proiectant inginer celuloză și hârtie
214913\u0001consilier inginer tehnologia celulozei și hârtiei
214914\u0001expert inginer tehnologia celulozei și hârtiei
214915\u0001inspector de specialitate inginer tehnologia celulozei și hârtiei
214916\u0001referent de specialitate inginer tehnologia celulozei și hârtiei
214917\u0001cercetător în informatică
214918\u0001asistent de cercetare în informatică
214919\u0001cercetător în filatură-țesătorie
214920\u0001inginer de cercetare în filatură-țesătorie
214921\u0001asistent de cercetare în filatură-țesătorie
214922\u0001cercetător în tricotaje-confecții textile
214923\u0001inginer de cercetare în tricotaje-confecții textile
214924\u0001asistent de cercetare în tricotaje-confecții textile
214925\u0001cercetător în tehnologia chimică a produselor textile, pieii, blănurilor și înlocuitorilor
214926\u0001inginer de cercetare în tehnologia chimică a produselor textile, pieii, blănurilor și înlocuitorilor
214927\u0001asistent de cercetare în tehnologia chimică a produselor textile, pieii, blănurilor și înlocuitorilor
214928\u0001cercetător în confecții din piele și înlocuitori
214929\u0001inginer de cercetare în confecții din piele și înlocuitori
214930\u0001asistent de cercetare în confecții din piele și înlocuitori
214931\u0001cercetător în exploatări forestiere
214932\u0001inginer de cercetare în exploatări forestiere
214933\u0001asistent de cercetare în exploatări forestiere
214934\u0001inginer de cercetare în proiectarea mobilei și produselor finite din lemn
214935\u0001cercetător în prelucrarea lemnului
214936\u0001inginer de cercetare în prelucrarea lemnului
214937\u0001asistent de cercetare în prelucrarea lemnului
214938\u0001cercetător în tehnologie și echipamente neconvenționale
214939\u0001inginer de cercetare în tehnologie și echipamente neconvenționale
214940\u0001asistent de cercetare în tehnologie și echipamente neconvenționale
214941\u0001cercetător în tehnologia celulozei, hârtiei, poligrafiei și fibrelor
214942\u0001inginer de cercetare în tehnologia celulozei, hârtiei, poligrafiei și fibrelor
214943\u0001asistent de cercetare în tehnologia celulozei, hârtiei, poligrafiei și fibrelor
214944\u0001corespondent securitate - confidențialitate produs
214945\u0001specialist operare sisteme de poziționare dinamică
214947\u0001expert elaborare documentații tehnice de montaj
214948\u0001expert monitorizare și control lucrări de montaj
214949\u0001expert prevenire - reducere riscuri tehnologice
214950\u0001expert urmărire comportare în exploatare lucrări montaj
214951\u0001expert tehnic extrajudiciar
214952\u0001auditor de siguranță rutieră
214953\u0001inspector/referent în gestiunea materialelor și mijloacelor fixe
214954\u0001inginer exploatare echipamente și instalații nucleare
214955\u0001logistician în transporturi
214956\u0001inginer în sisteme optice
214957\u0001inginer biomedical
214958\u0001inginer punere în funcțiune
214959\u0001inginer specialist în robotică
214960\u0001inginer pentru inspecția și verificarea tehnică a cazanelor, instalațiilor de ridicat și recipientelor sub presiune
215101\u0001dispecer energetic feroviar
215102\u0001dispecer centrală, hidrocentru, cascadă, dispecerate teritoriale
215103\u0001dispecer rețea distribuție
215104\u0001dispecer rețele de înaltă tensiune
215105\u0001inginer sisteme electroenergetice
215106\u0001radiochimist
215107\u0001subinginer electroenergetică
215108\u0001inginer energetică industrială
215109\u0001inginer sisteme termoenergetice
215110\u0001proiectant inginer electrotehnic
215111\u0001inginer proiectant energetician
215112\u0001inginer rețele electroenergetice
215113\u0001subinginer rețele electrice
215114\u0001inginer hidroenergetică
215115\u0001inginer exploatare centrale nuclearoelectrice
215116\u0001subinginer centrale termoelectrice
215117\u0001inginer exploatare instalații nucleare
215118\u0001proiectant subinginer electrotehnic
215119\u0001proiectant sisteme de securitate
215120\u0001șef tură dispecer energetic
215121\u0001cercetător în electrotehnică
215122\u0001inginer de cercetare în electrotehnică
215123\u0001asistent de cercetare în electrotehnică
215124\u0001cercetător în electrofizică
215125\u0001inginer de cercetare în electrofizică
215126\u0001asistent de cercetare în electrofizică
215127\u0001cercetător în metrologie
215128\u0001inginer de cercetare în metrologie
215129\u0001asistent de cercetare în metrologie
215130\u0001cercetător în electromecanică
215131\u0001inginer de cercetare în electromecanică
215132\u0001asistent de cercetare în electromecanică
215133\u0001cercetător roboți industriali
215134\u0001inginer de cercetare roboți industriali
215135\u0001asistent de cercetare roboți industriali
215136\u0001cercetător în centrale termoelectrice
215137\u0001inginer de cercetare în centrale termoelectrice
215138\u0001asistent de cercetare în centrale termoelectrice
215139\u0001cercetător în centrale nuclearoelectrice
215140\u0001inginer de cercetare în centrale nuclearoelectrice
215141\u0001asistent de cercetare în centrale nuclearoelectrice
215142\u0001cercetător în electroenergetică
215143\u0001inginer de cercetare în electroenergetică
215144\u0001asistent de cercetare în electroenergetică
215145\u0001cercetător în energetică industrială
215146\u0001inginer de cercetare în energetică industrială
215147\u0001asistent de cercetare în energetică industrială
215148\u0001ofițer electrician
215149\u0001inginer electrician
215150\u0001auditor electroenergetic
215151\u0001inginer centrale fotovoltaice
215152\u0001inginer centrale eoliene
215153\u0001inginer exploatare centrale termoelectrice
215154\u0001auditor termoenergetic
215155\u0001inginer securitate obiective nucleare
215156\u0001inginer exploatare centrale hidroelectrice
215157\u0001inginer echipamente și sisteme hidroenergetice
215158\u0001inginer management resurse de apă
215159\u0001inginer energetica clădirilor
215160\u0001inginer programare și optimizare a instalațiilor și proceselor energetice
215161\u0001inginer tehnologii informatice în energetică
215162\u0001inginer conducere și control sisteme de utilități energetice
215163\u0001inginer rețele și sisteme hidraulice
215201\u0001inginer electromecanic SCB
215202\u0001inginer automatist
215203\u0001inginer navigație
215204\u0001inginer electronist transporturi, telecomunicații
215205\u0001inginer producție
215206\u0001instructor instalații
215207\u0001instructor linii
215208\u0001revizor siguranța circulației feroviare
215209\u0001subinginer automatist
215210\u0001subinginer electronist, transporturi, telecomunicații
215211\u0001subinginer reglaje subansamble
215212\u0001inginer de recepție și control aeronave
215213\u0001proiectant inginer electronist
215214\u0001proiectant inginer de sisteme și calculatoare
215215\u0001proiectant inginer electromecanic
215216\u0001inginer electromecanic
215217\u0001subinginer electromecanic
215218\u0001căpitan secund
215219\u0001căpitan port (studii superioare)
215220\u0001specialist mentenanță electromecanică-automatică echipamente industriale
215222\u0001inginer sisteme de securitate
215223\u0001cercetător în electronică aplicată
215224\u0001inginer de cercetare în electronică aplicată
215225\u0001asistent de cercetare în electronică aplicată
215226\u0001cercetător în comunicații
215227\u0001inginer de cercetare în comunicații
215228\u0001asistent de cercetare în comunicații
215229\u0001cercetător în microelectronică
215230\u0001inginer de cercetare în microelectronică
215231\u0001asistent de cercetare în microelectronică
215232\u0001cercetător în telecomenzi și electronică în transporturi
215233\u0001inginer de cercetare în telecomenzi și electronică în transporturi
215234\u0001asistent de cercetare în telecomenzi și electronică în transporturi
215235\u0001cercetător în calculatoare
215236\u0001inginer de cercetare în calculatoare
215237\u0001asistent de cercetare în calculatoare
215238\u0001cercetător în automatică
215239\u0001inginer de cercetare în automatică
215240\u0001asistent de cercetare în automatică
215241\u0001ofițer punte
215242\u0001inginer în instrumentație de măsură
215301\u0001inginer emisie
215302\u0001inginer montaj
215303\u0001inginer electrotehnist
215304\u0001inginer imagine
215305\u0001inginer sunet
215306\u0001inginer- șef car reportaj
215307\u0001subinginer- șef car reportaj
215308\u0001inginer-șef schimb emisie
215309\u0001subinginer iluminat tehnologic
215310\u0001inginer proiectant comunicații
215311\u0001subinginer proiectant comunicații
215312\u0001inginer/ inspector de specialitate/ referent de specialitate/ expert în serviciile de trafic aerian
215313\u0001consilier tehnic
215314\u0001inginer iluminare
215315\u0001șef studio RTV
215316\u0001coordonator producție RTV
216101\u0001arhitect clădiri
216102\u0001conductor arhitect
216103\u0001arhitect restaurări
216104\u0001consilier arhitect
216105\u0001expert arhitect
216106\u0001inspector de specialitate arhitect
216107\u0001referent de specialitate arhitect
216108\u0001proiectant arhitect
216109\u0001cercetător în arhitectură
216110\u0001asistent de cercetare în arhitectură
216111\u0001arhitect de interior
216201\u0001arhitect peisagistică și amenajarea teritoriului
216202\u0001peisagist
216301\u0001designer industrial
216302\u0001grafician industrial
216303\u0001lucrător în ateliere de modele
216304\u0001costumier
216305\u0001pictor creator costume
216306\u0001modelier confecții
216307\u0001designer vestimentar
216308\u0001cercetător în arte plastice - design industrial
216309\u0001asistent de cercetare în arte plastice - design industrial
216310\u0001cercetător în arte plastice - textile (tapiserie, contexturi, modă, imprimeuri)
216311\u0001asistent de cercetare în arte plastice - textile (tapiserie, contexturi, modă, imprimeuri)
216312\u0001cercetător în arte plastice-sticlă, ceramică, metal
216313\u0001asistent de cercetare în arte plastice - sticlă, ceramică, metal
216401\u0001urbanist
216402\u0001arhitect urbanism
216501\u0001cartograf
216502\u0001inginer geodez
216503\u0001subinginer geodez
216504\u0001inginer topograf
216505\u0001inginer topograf minier
216506\u0001proiectant inginer geodez
216507\u0001consilier cadastru
216508\u0001subinginer cadastru
216509\u0001geomatician
216601\u0001designer grafică (studii medii)
216602\u0001animator film de animație (studii medii)
216603\u0001intermediarist film desene animate (studii medii)
216604\u0001stilizator film desene animate (studii medii)
216605\u0001asistent regizor studio
216606\u0001asistent regizor emisie
216607\u0001designer florist
216609\u0001art director
216610\u0001designer pagini web (studii superioare)
216611\u0001designer grafică (studii superioare)
216612\u0001grafician calculator (studii medii)
216613\u0001designer pagini web (studii medii)
216614\u0001designer jocuri digitale
221101\u0001medic medicină generală
221102\u0001medic rezident
221103\u0001consilier medic
221104\u0001expert medic
221105\u0001inspector de specialitate medic
221106\u0001referent de specialitate medic
221107\u0001medic primar
221108\u0001medic medicină de familie
221109\u0001cercetător în medicina generală
221110\u0001asistent de cercetare în medicina generală
221201\u0001medic specialist
222101\u0001asistent medical generalist
222102\u0001asistent medical specializat
222201\u0001moașă
223001\u0001cercetător în medicina tradițională
223002\u0001asistent de cercetare în medicina tradițională
223003\u0001instructor ergoterapie
223004\u0001tehnician homeopat
223005\u0001instructor de educație sanitară
223006\u0001bioenergetician
223007\u0001inforenergetician radiestezist
223008\u0001terapeut în terapii complementare
225001\u0001epizotolog
225002\u0001medic veterinar
225003\u0001medic veterinar - oncologie comparată
225004\u0001cercetător în medicina veterinară
225005\u0001asistent de cercetare în medicina veterinară
226101\u0001medic stomatolog
226102\u0001medic stomatolog rezident
226103\u0001medic stomatolog de specialitate
226104\u0001cercetător în medicina stomatologică
226105\u0001asistent de cercetare în medicina stomatologică
226201\u0001farmacist
226202\u0001farmacist rezident
226203\u0001farmacist de specialitate
226204\u0001asistent de farmacie licențiat
226205\u0001farmacist primar
226301\u0001inginer clinic
226302\u0001specialist în domeniul securității și sănătății în muncă
226303\u0001coordonator în materie de securitate și sănătate în muncă (studii superioare)
226304\u0001cercetător științific în bacteriologie, microbiochimie, farmacologie
226305\u0001asistent de cercetare în bacteriologie, microbiologie, biochimie, farmacologie
226306\u0001igienist
226307\u0001evaluator de risc și auditor în domeniul securității și sănătății în muncă
226308\u0001coordonator în materie de securitate și sănătate în muncă pentru logistică (studii superioare)
226309\u0001ergonomist
226310\u0001auditor de sistem de management al sănătății și securității în muncă
226311\u0001auditor în domeniul siguranței alimentare
226312\u0001manager în domeniul siguranței alimentare
226401\u0001fiziokinetoterapeut
226402\u0001fizioterapeut
226403\u0001cercetător în fiziokinetoterapie
226404\u0001asistent de cercetare în fiziokinetoterapie
226405\u0001kinetoterapeut
226406\u0001profesor de cultură fizică medicală
226501\u0001asistent de nutriție
226502\u0001dietetician
226503\u0001nutriționist și dietetician
226504\u0001consultant nutriționist
226601\u0001instructor logoped
226603\u0001logoped
226604\u0001audiolog
226701\u0001optometrist (studii superioare)
226901\u0001medic igienist
226902\u0001medic expertiză a capacității de muncă
226903\u0001medic legist
226904\u0001bioinginer medical
226905\u0001asistent medical (studii superioare)
226906\u0001fizician medical
226907\u0001medic specialist psihiatru
226908\u0001medic de familie cu competențe în sănătatea mintală
226909\u0001cercetător în educație fizică și sport
226910\u0001asistent de cercetare în educație fizică și sport
226911\u0001consilier sportiv
226912\u0001biochimist medical specialist
226913\u0001biolog medical specialist
226914\u0001chimist medical specialist
226915\u0001biochimist medical principal
226916\u0001biolog medical principal
226917\u0001chimist medical principal
226918\u0001asistent medical nutriție dietetică
226919\u0001asistent medical radiologie
226920\u0001asistent medical laborator
226921\u0001asistent medical igienă și sănătate publică
226922\u0001navigator de pacienți
226923\u0001asistent medico-social
226924\u0001asistent medical balneofizioterapie, balneofiziokinetoterapie și recuperare
226925\u0001tehnician perfuzionist
226926\u0001podiatru
226927\u0001analist comportamental
226928\u0001tehnician de radiologie și imagistică licențiat
226929\u0001terapeut în terapie asistată de animale
231001\u0001asistent universitar
231002\u0001conferențiar universitar
231003\u0001lector universitar
231004\u0001preparator învățământul universitar
231005\u0001profesor universitar
231006\u0001expert centre de perfecționare
232001\u0001profesor în învățământul profesional și de maiștri
233001\u0001profesor în învățământul liceal, postliceal
233002\u0001profesor în învățământul gimnazial
234101\u0001profesor în învățământul primar
234102\u0001învățător
234103\u0001institutor
234201\u0001profesor în învățământul preșcolar
234202\u0001educatoare
234203\u0001educator puericultor
235101\u0001cercetător în pedagogie
235102\u0001asistent de cercetare în pedagogie
235103\u0001consilier învățământ
235104\u0001expert învățământ
235105\u0001inspector școlar
235106\u0001referent de specialitate învățământ
235201\u0001defectolog
235203\u0001educator în unități de handicapați
235204\u0001instructor-educator în unități de handicapați
235205\u0001pedagog de recuperare
235301\u0001profesor de limbi străine
235901\u0001secretar institut, facultate
235902\u0001mentor
235903\u0001consilier școlar
235904\u0001designer instrucțional
235905\u0001dezvoltator de e-learning
235906\u0001laborant în învățământ
235907\u0001maistru instructor
235908\u0001pedagog școlar
235909\u0001secretar școală
235910\u0001șef atelier școală
235911\u0001mediator școlar
235912\u0001inspector școlar pentru implementarea descentralizării instituționale
235913\u0001inspector școlar pentru managementul resurselor umane
235914\u0001inspector școlar pentru mentorat
235915\u0001inspector școlar pentru dezvoltarea resursei umane
235916\u0001inspector școlar pentru educație permanentă
235917\u0001inspector școlar pentru învățământ particular și alternative educaționale
235918\u0001inspector școlar pentru învățământul special
235919\u0001director Centrul Județean de Resurse și Asistență Educațională (CJRAE)
235920\u0001consilier pentru tineret
235921\u0001inspector școlar pentru proiecte educaționale
235922\u0001consilier mediator
235923\u0001profesor-antrenor
235924\u0001specialist în pregătire fizică
235925\u0001specialist sisteme de calificare
241101\u0001controlor tezaur
241102\u0001expert contabil-verificator
241103\u0001revizor contabil
241104\u0001referent de specialitate financiar-contabilitate
241105\u0001auditor intern
241106\u0001controlor de gestiune
241107\u0001auditor financiar
241201\u0001cenzor
241202\u0001comisar Garda Financiară
241203\u0001consilier financiar-bancar
241204\u0001expert financiar-bancar
241205\u0001inspector financiar-bancar
241206\u0001inspector asigurări
241207\u0001comisar principal
241208\u0001consultant bugetar
241209\u0001dealer
241210\u0001evaluator
241211\u0001analist investiții
241212\u0001manager de fond acțiuni/ obligațiuni
241213\u0001consultant plasamente valori mobiliare
241214\u0001agent capital de risc
241215\u0001administrator credite
241216\u0001specialist control risc
241217\u0001specialist evaluare daune
241218\u0001lichidator
241219\u0001administrator judiciar
241220\u0001analist preț de revenire/ costuri
241221\u0001expert fiscal
241222\u0001consultant fiscal
241223\u0001inspector general de bancă
241224\u0001economist bancă
241225\u0001manager bancă
241226\u0001manager de operațiuni/ produs
241227\u0001manager relații cu clienții băncii/ societate de leasing
241228\u0001trezorier (studii superioare)
241229\u0001analist bancar/ societate de leasing
241230\u0001ofițer bancar (credite, marketing, produse și servicii bancare)
241231\u0001administrator bancar/ produs leasing
241232\u0001operator cifru (mesaje cifrate)
241233\u0001proiectant produse bancare
241234\u0001consultant bancar
241235\u0001agent compensare (interbancară)
241236\u0001referent bancar/ societate de leasing
241237\u0001ofițer conformitate
241238\u0001expert conformitate
241239\u0001ofițer securitatea informației (Security Officer – SO)
241240\u0001administrator de risc
241241\u0001analist credite
241242\u0001inspector de specialitate asigurări
241243\u0001inspector de specialitate subscriere
241244\u0001referent de specialitate asigurări
241245\u0001consilier vânzări asigurări
241246\u0001inspector coordonator asigurări
241247\u0001inspector de risc
241248\u0001inspector de specialitate daune
241249\u0001inspector coordonator daune
241250\u0001specialist sistem asigurări
241251\u0001evaluator autorizat
241255\u0001planificator/ specialist plan sinteze
241256\u0001expert în ingineria costurilor investiționale
241257\u0001expert contractare activități investiționale
241258\u0001expert recepție investiții industriale
241259\u0001expert eficientizare investiții
241260\u0001expert evaluare-actualizare devize generale investiții
241261\u0001expert elaborare-evaluare documentații achiziții investiționale
241262\u0001expert în management activități investiționale
241263\u0001evaluator proiecte
241264\u0001inspector casier
241265\u0001broker de tehnologii
241266\u0001gemolog
241267\u0001evaluator bunuri culturale
241268\u0001specialist piețe reglementate
241269\u0001consultant de investiții
241270\u0001specialist control intern în domeniul pieței de capital
241271\u0001specialist pentru piața de capital
241272\u0001specialist pentru relația cu investitorii
241301\u0001cercetător în finanțe-bănci
241302\u0001asistent de cercetare în finanțe-bănci
241303\u0001cercetător în gestiune, contabilitate, control financiar
241304\u0001asistent de cercetare în gestiune, contabilitate, control financiar
241305\u0001analist financiar
241306\u0001auditor intern în sectorul public
241307\u0001asistent analist
241308\u0001specialist bancar
241309\u0001analist financiar bancar
241310\u0001asistent bancar
241311\u0001specialist/ analist organizare
241312\u0001analist tehnic piețe financiare
242101\u0001manager proiect
242102\u0001specialist îmbunătățire procese
242103\u0001specialist strategie industrială
242104\u0001responsabil proces
242105\u0001coordonator secretariat studiouri teritoriale
242106\u0001manager de inovare
242107\u0001expert în conducerea și organizarea activităților de mentenanță
242108\u0001manager îmbunătățire procese
242109\u0001specialist plan progres
242110\u0001specialist în planificarea, controlul și raportarea performanței economice
242111\u0001administrator societate comercială
242112\u0001manager de proiect în parteneriat public privat
242113\u0001consultant de securitate
242114\u0001manager al sistemelor de management al calității
242115\u0001evaluator de risc la securitatea fizică
242116\u0001expert achiziții publice
242117\u0001manager de facilități
242118\u0001specialist digitalizare
242119\u0001manager transformare digitală
242120\u0001analist de afaceri
242121\u0001evaluator accesibilitate
242122\u0001manager de cost pentru dezvoltarea proiectului
242201\u0001consilier administrația publică
242202\u0001expert administrația publică
242203\u0001inspector de specialitate în administrația publică
242204\u0001referent de specialitate în administrația publică
242205\u0001consultant în administrația publică
242206\u0001reglementator
242207\u0001agent de dezvoltare
242208\u0001administrator public
242209\u0001inspector de integritate
242210\u0001examinator de stat de specialitate
242211\u0001administrator publicații
242212\u0001agent consular
242213\u0001expert accesare fonduri structurale și de coeziune europene
242214\u0001consilier afaceri europene
242215\u0001referent relații externe
242216\u0001inspector de trafic rutier (studii superioare)
242217\u0001expert informații pentru afaceri
242218\u0001administrator editură
242219\u0001expert aplicare legislație armonizată în domeniul industriei și comerțului
242220\u0001expert legislația muncii
242221\u0001expert/specialist în parteneriat public-privat
242222\u0001analist informații de firmă
242223\u0001investigator
242224\u0001analist de informații
242225\u0001consilier de stare civilă
242226\u0001inspector de stare civilă
242227\u0001ofițer de legătură pentru infrastructurii critice naționale/europene
242228\u0001auditor de securitate a aviației civile
242229\u0001consilier dezvoltare locală și regională
242230\u0001expert în egalitate de șanse
242231\u0001responsabil cu protecția datelor cu caracter personal
242232\u0001expert dezvoltare durabilă
242233\u0001analist în servicii și politici de sănătate
242234\u0001expert e-guvernare
242235\u0001coordonator programe de sport
242236\u0001ofițer de politici recreaționale
242237\u0001inspector aeronautic
242238\u0001investigator pentru siguranța aviației civile
242239\u0001atașat pentru muncă și afaceri sociale
242301\u0001consilier forță de muncă și șomaj
242302\u0001expert forță de muncă și șomaj
242303\u0001inspector de specialitate forță de muncă și șomaj
242304\u0001expert în securitate și sănătate în muncă
242305\u0001referent de specialitate forță de muncă și șomaj
242306\u0001consilier orientare privind cariera
242307\u0001consultant în domeniul forței de muncă
242308\u0001analist piața muncii
242309\u0001analist recrutare/ integrare salariați
242310\u0001analist sisteme salarizare
242311\u0001consultant reconversie-mobilitate personal
242312\u0001consultant condiții de muncă
242313\u0001analist ocupațional
242314\u0001specialist resurse umane
242315\u0001consilier vocațional
242316\u0001consultant în standardizare
242317\u0001consultant în resurse umane
242318\u0001consultant intern în resurse umane
242319\u0001specialist în formare
242320\u0001specialist în recrutare
242321\u0001specialist în compensații și beneficii
242322\u0001specialist în dezvoltare organizațională
242323\u0001specialist în relații de muncă
242324\u0001consilier pentru dezvoltare personală
242325\u0001analist resurse umane
242401\u0001formator
242402\u0001formator de formatori
242403\u0001organizator/ conceptor/ consultant formare
242404\u0001inspector de specialitate formare, evaluare și selecție profesională
242405\u0001evaluator de competențe profesionale
242406\u0001manager de formare
242407\u0001administrator de formare
242408\u0001evaluator de furnizori și programe de formare
242409\u0001evaluator de evaluatori
242410\u0001evaluator extern
242411\u0001evaluator în sistemul formării profesionale continue
242412\u0001specialist în activitatea de coaching
242901\u0001auditor responsabilitate socială
242902\u0001responsabil al managementului responsabilității sociale
242903\u0001manager de responsabilitate socială
242904\u0001specialist educator în penitenciare
242905\u0001ofițer de poliție penitenciară
243101\u0001art director publicitate (studii medii)
243102\u0001organizator activitate turism (studii superioare)
243103\u0001specialist marketing
243104\u0001manager de produs
243105\u0001specialist marketing online
243106\u0001manager comerț electronic
243201\u0001specialist în relații publice
243202\u0001mediator
243203\u0001referent de specialitate marketing
243204\u0001specialist protocol și ceremonial
243205\u0001consultant cameral
243206\u0001purtător de cuvânt
243207\u0001brand manager
243208\u0001organizator protocol
243209\u0001organizator relații
243210\u0001organizator târguri și expoziții
243211\u0001prezentator expoziții
243212\u0001specialist relații sociale
243213\u0001expert relații externe
243214\u0001curier diplomatic
243215\u0001specialist garanții auto
243216\u0001analist servicii client
243217\u0001asistent director/ responsabil de funcțiune (studii superioare)
243218\u0001corespondent comercial
243219\u0001asistent comercial
243220\u0001specialist în activitatea de lobby
243221\u0001arbitru
243222\u0001manager atragere fonduri
243223\u0001ombudsman
243224\u0001expert comunicare guvernamentală
243301\u0001analist cumpărări/ consultant furnizori
243302\u0001reprezentant medical
251101\u0001proiectant sisteme informatice
251102\u0001analist de afaceri în domeniul TIC
251103\u0001manager analiză de business în domeniul TIC
251104\u0001arhitect de sistem în domeniul TIC
251105\u0001dezvoltator de sisteme în domeniul TIC
251106\u0001inginer de integrare
251107\u0001proiectant de sisteme informatice inteligente pentru TIC
251108\u0001inginer viziune computerizată
251109\u0001arhitect în domeniul tehnologiei blockchain
251201\u0001analist
251202\u0001programator
251203\u0001inginer de sistem în informatică
251204\u0001programator de sistem informatic
251205\u0001inginer de sistem software
251206\u0001manager proiect informatic
251207\u0001inginer de dezvoltare a produselor software
251208\u0001inginer în realizarea, întreținerea și dezvoltarea aplicațiilor web
251209\u0001inginer în domeniul tehnologiei cloud
251210\u0001dezvoltator în domeniul tehnologiei blockchain
251211\u0001dezvoltator interfața cu utilizatorul
251212\u0001inginer de date complexe (big data)
251301\u0001specialist e-Afaceri
251302\u0001specialist în e-Guvernare
251303\u0001specialist în e-Media
251304\u0001specialist în e-Sănătate
251305\u0001manager de conținut web
251306\u0001expert în optimizarea motoarelor de căutare
251307\u0001dezvoltator jocuri digitale
251401\u0001specialist în domeniul proiectării asistate pe calculator
251402\u0001specialist în proceduri și instrumente de securitate a sistemelor informatice
251901\u0001consultant în informatică
252101\u0001administrator baze de date
252201\u0001administrator sistem de securitate bancară
252301\u0001administrator de rețea de calculatoare
252302\u0001administrator de rețea de telefonie VOIP
252901\u0001specialist SIG/IT
252902\u0001expert surse deschise
252903\u0001specialist în securitate cibernetică pentru sisteme automatizate de comandă-control
252904\u0001expert în securitate cibernetică
252905\u0001expert în investigații digitale
252906\u0001auditor de securitate cibernetică
252907\u0001consultant de securitate cibernetică
252908\u0001administrator de securitate în domeniul TIC
252909\u0001expert în criminalistică informatică
252910\u0001manager de securitate sisteme informatice
252911\u0001inginer în domeniul securității TIC
252912\u0001inginer de securitate sisteme înglobate
261101\u0001avocat
261103\u0001consilier juridic
261201\u0001procuror
261202\u0001judecător
261203\u0001magistrat - asistent
261204\u0001inspector judiciar
261205\u0001asistent judiciar
261206\u0001personal de specialitate juridică asimilat judecătorilor și procurorilor
261901\u0001executor judecătoresc
261902\u0001expert criminalist
261903\u0001expert jurist
261906\u0001notar
261910\u0001consilier armonizare legislativă
261911\u0001expert armonizare legislativă
261912\u0001analist armonizare legislativă
261913\u0001registrator carte funciară
261914\u0001revizor jurist
261915\u0001cercetător în domeniul științelor juridice
261916\u0001asistent de cercetare în domeniul științelor juridice
261917\u0001executor bancar
261918\u0001consilier proprietate industrială autorizat
261919\u0001specialist proprietate intelectuală
261920\u0001expert prevenire și combatere a corupției
261921\u0001consilier de probațiune
261922\u0001inspector de probațiune
261923\u0001asistent registrator principal
261924\u0001inspector de urmărire și administrare bunuri
261925\u0001registrator de registrul comerțului
262101\u0001arhivist
262102\u0001conservator opere de artă și monumente istorice (studii superioare)
262103\u0001muzeograf
262104\u0001restaurator opere de artă și monumente istorice (studii superioare)
262105\u0001conservator arhivă (studii superioare)
262106\u0001restaurator arhivă (studii superioare)
262107\u0001restaurator bunuri culturale (studii superioare)
262108\u0001conservator/restaurator pictură murală
262109\u0001conservator/restaurator pictură pe lemn
262110\u0001conservator/restaurator componente artistice din lemn la monumente istorice
262111\u0001conservator/restaurator componente artistice din metal la monumente istorice
262112\u0001conservator/restaurator componente artistice din piatră, ceramică sau stucatură la monumente istorice
262113\u0001conservator/restaurator vitralii și componente artistice din sticlă la monumente istorice
262114\u0001curator
262115\u0001specialist educație muzeală
262201\u0001bibliograf
262202\u0001bibliotecar (studii superioare)
262203\u0001documentarist (studii superioare)
262204\u0001referent difuzare carte
262205\u0001lector carte
262206\u0001bibliotecar arhivist
262207\u0001referent de specialitate așezământ cultural
263101\u0001consilier/ expert/ inspector/ referent/ economist în management
263102\u0001consilier/ expert/ inspector/ referent/ economist în economie generală
263103\u0001consilier/ expert/ inspector/ referent/ economist în economia mediului
263104\u0001consilier/ expert/ inspector/ referent/ economist în comerț și marketing
263105\u0001consilier/ expert/ inspector/ referent/ economist în relații economice internaționale
263106\u0001consilier/ expert/ inspector/ referent/ economist în gestiunea economică
263107\u0001consultant în management
263108\u0001tehnician economist
263109\u0001inginer economist
263110\u0001inspector de concurență
263111\u0001administrator financiar (patrimoniu) (studii superioare)
263112\u0001cercetător economist în management
263113\u0001asistent de cercetare economist în management
263114\u0001cercetător economist în economia mediului
263115\u0001asistent de cercetare economist în economia mediului
263116\u0001cercetător economist în economia generală
263117\u0001asistent de cercetare economist în economia generală
263118\u0001cercetător economist în economie agroalimentară
263119\u0001asistent de cercetare economist în economie agroalimentară
263120\u0001cercetător economist în marketing
263121\u0001asistent de cercetare economist în marketing
263122\u0001cercetător economist în relații economice internaționale
263123\u0001asistent de cercetare economist în relații economice internaționale
263124\u0001cercetător economist în gestiunea economică
263125\u0001asistent de cercetare economist în gestiunea economică
263126\u0001secretar economic (studii superioare)
263201\u0001sociolog
263202\u0001geograf
263203\u0001analist de mediu
263204\u0001analist în turism
263205\u0001analist teritorial
263206\u0001arheolog
263207\u0001cercetător de dezvoltare comunitară
263208\u0001cercetător în sociologie
263209\u0001asistent de cercetare în sociologie
263210\u0001cercetător în antropologie
263211\u0001asistent de cercetare în antropologie
263212\u0001cercetător în geografie
263213\u0001asistent de cercetare în geografie
263214\u0001cercetător în arheologie
263215\u0001asistent de cercetare în arheologie
263216\u0001cercetător în etnologie
263217\u0001asistent de cercetare în etnologie
263218\u0001manager consorțiu turistic
263219\u0001expert localizare
263220\u0001promotor local
263221\u0001specialist planificare teritorială
263301\u0001filozof
263302\u0001istoric
263303\u0001istoriograf
263304\u0001politolog
263305\u0001cercetător în filozofie
263306\u0001asistent de cercetare în filozofie
263307\u0001cercetător în istorie
263308\u0001asistent de cercetare în istorie
263309\u0001cercetător în științele politice
263310\u0001asistent de cercetare în științele politice
263311\u0001consilier filosofic
263401\u0001psiholog în specialitatea psihologie clinică
263402\u0001psiholog în specialitatea consiliere psihologică
263403\u0001psiholog în specialitatea psihoterapie
263404\u0001psiholog în specialitatea psihologia muncii și organizațională
263405\u0001psiholog în specialitatea psihologia transporturilor
263406\u0001psiholog în specialitatea psihologia aplicată în servicii
263407\u0001psiholog în specialitatea psihologie educațională, consiliere școlară și vocațională
263408\u0001psiholog în specialitatea psihopedagogie specială
263409\u0001psiholog în specialitatea psihologie aplicată în domeniul securității naționale
263410\u0001psiholog în specialitatea psihologie judiciară - evaluarea comportamentului simulat prin tehnica poligrafului
263411\u0001psiholog
263412\u0001psihopedagog
263413\u0001expert poligraf
263414\u0001psiholog școlar
263415\u0001cercetător în psihologie
263416\u0001asistent de cercetare în psihologie
263417\u0001cercetător în psihopedagogie specială
263418\u0001asistent de cercetare în psihopedagogie specială
263419\u0001terapeut ocupațional
263501\u0001asistent social
263502\u0001consilier în domeniul adicțiilor
263503\u0001ofițer control doping
263504\u0001art-terapeut
263505\u0001asistent social cu competență în sănătatea mintală
263506\u0001specialist în evaluarea vocațională a persoanelor cu dizabilități
263507\u0001specialist în angajare asistată
263508\u0001instructor - educator pentru activități de resocializare
263509\u0001asistent pentru îngrijirea persoanelor vârstnice
263510\u0001cercetător în asistența socială
263511\u0001asistent de cercetare în asistența socială
263512\u0001inspector social
263513\u0001supervizor în servicii sociale
263514\u0001consilier de cuplu
263515\u0001specialist în lucrul cu părinții (parenting)
263601\u0001arhiepiscop
263602\u0001arhiereu-vicar
263603\u0001arhondar
263604\u0001cantor
263605\u0001capelan
263606\u0001cardinal
263607\u0001chevrasameș
263609\u0001consilier culte
263610\u0001conducător arhiepiscopal
263611\u0001diacon
263612\u0001episcop
263613\u0001exarh
263614\u0001haham
263615\u0001harmonist
263616\u0001hatip
263617\u0001imam
263618\u0001inspector culte
263619\u0001majghian
263620\u0001melamed
263621\u0001mitropolit
263622\u0001muezin
263623\u0001muftiu
263624\u0001organist
263625\u0001pastor
263626\u0001patriarh
263627\u0001preot
263628\u0001președinte culte
263629\u0001protopop
263630\u0001provicar
263631\u0001rabin
263632\u0001secretar culte
263633\u0001stareț - stareță
263634\u0001treibar
263635\u0001vestitor
263636\u0001vicar
263637\u0001episcop-vicar patriarhal
263638\u0001episcop-vicar
263639\u0001vicar-administrativ patriarhal
263640\u0001vicar-administrativ eparhial
263641\u0001consilier patriarhal
263642\u0001inspector general bisericesc
263643\u0001consilier eparhial
263644\u0001inspector patriarhal
263645\u0001inspector eparhial
263646\u0001secretar Cancelaria Patriarhală
263647\u0001secretar eparhial
263648\u0001eclesiarh
264101\u0001poet
264102\u0001scriitor
264201\u0001comentator publicist
264202\u0001corector (studii superioare)
264203\u0001corespondent special (țară și străinătate)
264204\u0001corespondent radio
264205\u0001corespondent presă
264206\u0001critic de artă
264207\u0001editorialist
264208\u0001fotoreporter
264209\u0001lector presă/ editură
264210\u0001publicist comentator
264211\u0001redactor
264212\u0001reporter (studii superioare)
264213\u0001reporter operator
264214\u0001secretar de emisie (studii superioare)
264215\u0001secretar de redacție (studii superioare)
264216\u0001secretar responsabil de agenție
264217\u0001șef agenție publicitate
264218\u0001tehnoredactor
264219\u0001ziarist
264220\u0001critic literar
264222\u0001comentator radio TV
264223\u0001redactor rubrică
264224\u0001jurnalist TV (studii medii)
264225\u0001jurnalist TV (studii superioare)
264226\u0001jurnalist TV senior
264301\u0001filolog
264302\u0001interpret
264303\u0001interpret relații diplomatice
264304\u0001referent literar
264305\u0001secretar literar
264306\u0001traducător (studii superioare)
264307\u0001translator
264308\u0001grafolog
264309\u0001revizor lingvist
264310\u0001terminolog
264311\u0001translator emisie
264312\u0001cercetător în lingvistică
264313\u0001asistent de cercetare în lingvistică
264314\u0001cercetător în filologie
264315\u0001asistent de cercetare în filologie
264316\u0001interpret al limbajului mimico-gestual
265101\u0001caricaturist (studii superioare)
265102\u0001artist plastic
265103\u0001desenator film animație
265104\u0001grafician
265105\u0001machetist
265106\u0001pictor
265107\u0001pictor scenograf
265108\u0001sculptor
265109\u0001sculptor păpuși
265110\u0001restaurator tablouri
265111\u0001artist multimedia
265201\u0001acompaniator
265202\u0001artist liric
265203\u0001concert maestru
265204\u0001corepetitor
265205\u0001corist
265206\u0001dirijor
265207\u0001ilustrator muzical
265208\u0001maestru studii canto
265209\u0001instrumentist
265210\u0001maestru cor
265211\u0001referent muzical
265212\u0001secretar muzical
265213\u0001șef orchestră
265214\u0001solist instrumentist
265215\u0001solist vocal
265216\u0001sufleur operă
265217\u0001tehnoredactor partituri
265218\u0001specialist instrumente de suflat
265219\u0001artist instrumentist
265220\u0001solist concertist
265221\u0001dirijor cor
265222\u0001maestru corepetitor
265223\u0001artist liric operă
265224\u0001corist operă
265225\u0001maestru acordor pian clavecin
265226\u0001maestru lutier
265227\u0001specialist orgă
265228\u0001regizor muzical
265229\u0001cântăreț
265230\u0001instrumentist muzicant
265231\u0001critic muzical
265232\u0001video-jockey
265233\u0001maestru de ceremonii
265234\u0001instrumentist (studii medii)
265235\u0001compozitor
265236\u0001muzicolog
265237\u0001cercetător științific în muzică
265238\u0001asistent de cercetare științifică în muzică
265239\u0001compozitor muzică ușoară/pop
265240\u0001compozitor muzică de film/teatru
265241\u0001compozitor muzică electronică
265242\u0001compozitor muzică sacră
265243\u0001compozitor muzică publicitară
265244\u0001orchestrator
265245\u0001aranjor muzică
265246\u0001muzician jazz
265247\u0001psalt
265248\u0001conducător formație muzicală
265249\u0001dirijor ansamblu vocal bisericesc
265250\u0001producător muzical
265251\u0001mediator muzical
265252\u0001redactor muzical
265253\u0001reporter muzical
265254\u0001realizator muzical
265255\u0001documentarist muzică
265256\u0001consultant muzical
265257\u0001specialist muzicologie bizantină/gregoriană
265258\u0001etnomuzicolog
265259\u0001animator emisiuni cultural-muzicale de radio și televiziune
265260\u0001responsabil producție artistică teatru muzical
265301\u0001balerin
265302\u0001coregraf
265303\u0001maestru studii de balet
265304\u0001maestru de balet
265305\u0001solist balet
265306\u0001maestru dans
265307\u0001dansator
265401\u0001consultant artistic
265402\u0001corector transmisie
265403\u0001instructor film
265404\u0001instructor rețea cinematografică
265405\u0001lector scenarii
265406\u0001intermediarist film de desene animate (studii superioare)
265407\u0001stilizator film de desene animate (studii superioare)
265408\u0001producător delegat film
265409\u0001realizator emisiuni RTV
265410\u0001regizor artistic
265411\u0001regizor emisie
265412\u0001regizor studio
265413\u0001regizor sunet
265414\u0001regizor tehnic
265415\u0001secretar șef producție film
265416\u0001sufleur teatru
265417\u0001maestru artist circ
265418\u0001producător RTV (știri)
265419\u0001editor RTV (știri)
265420\u0001director imagine
265421\u0001referent de specialitate selecție programe TV
265422\u0001copywriter publicitate (studii superioare)
265423\u0001mediaplanner
265424\u0001producător delegat evenimente de marketing
265425\u0001redactor prezentator de televiziune
265426\u0001animator film de animație (studii superioare)
265427\u0001director producție film
265428\u0001coordonator producție film
265429\u0001asistent producție film
265430\u0001producător audiovideo
265431\u0001editor coordonator programe TV
265432\u0001director de creație
265433\u0001organizator producție (studii superioare)
265434\u0001scenograf
265435\u0001asistent scenograf
265436\u0001videojurnalist (studii superioare)
265437\u0001producător delegat pentru teatru
265438\u0001regizor culise
265439\u0001regizor scenă
265440\u0001secretar platou
265441\u0001producător delegat TV
265442\u0001producător TV
265443\u0001producător teren (studii superioare)
265444\u0001producător teren (studii medii)
265445\u0001maestru magician
265501\u0001actor
265502\u0001actor mânuitor de păpuși
265503\u0001artist circ
265601\u0001prezentator (crainic) radio
265602\u0001prezentator (crainic) televiziune
265901\u0001acrobat
265902\u0001clovn
265903\u0001magician
265904\u0001hipnotizator
265905\u0001trapezist
265906\u0001cascador
265907\u0001figurant
265908\u0001dresor
311101\u0001laborant chimist
311102\u0001tehnician chimist
311103\u0001laborant determinări fizico-mecanice
311104\u0001tehnician determinări fizico-mecanice
311105\u0001laborant determinări geologice și geotehnice
311106\u0001laborant tehnică nucleară
311107\u0001tehnician meteorolog
311108\u0001tehnician geolog
311109\u0001tehnician hidrometru
311110\u0001prospector - prospecții geologice, geofizice
311111\u0001tehnician hidrolog
311112\u0001tehnician hidrogeolog
311113\u0001laborant operator centrale termice
311114\u0001metrolog
311115\u0001tehnician metrolog
311116\u0001asistent fizică și chimie
311117\u0001operator meteorolog
311118\u0001meteorolog aeronautic tehnician
311119\u0001operator specialist curățare chimică la schimbătoarele de căldură cu plăci
311120\u0001tehnician în fizică
311201\u0001maistru construcții civile, industriale și agricole
311202\u0001maistru normator
311203\u0001tehnician constructor
311204\u0001tehnician hidroameliorații
311205\u0001tehnician hidrotehnic
311206\u0001tehnician topometrist
311207\u0001tehnician proiectant în construcții
311208\u0001maistru instalator în construcții
311209\u0001tehnician instalații în construcții
311210\u0001diriginte șantier
311211\u0001tehnician laborant pentru lucrări de drumuri și poduri
311212\u0001tehnician în industria materialelor de construcții
311213\u0001maistru în industria materialelor de construcții
311214\u0001tehnician proiectant în industria materialelor de construcții
311215\u0001tehnician devize și măsurători în construcții
311216\u0001tehnician devizier
311217\u0001tehnician atașamentist
311301\u0001dispecer gestiune uraniu
311302\u0001maistru electromecanic
311303\u0001maistru energetician/ electrician
311304\u0001tehnician electroenergetician, termoenergetician
311305\u0001tehnician electromecanic
311306\u0001tehnician energetician/ electrician
311307\u0001tehnician proiectant energetician/ electrician
311308\u0001maistru electrician în construcții
311309\u0001tehnician mentenanță electromecanică - automatică echipamente industriale
311310\u0001șef/ șef adjunct tură stație electrică (studii medii)
311311\u0001tehnician mentenanță turbine eoliene
311312\u0001tehnician inspecții și reparații pale de turbine eoliene
311313\u0001tehnician instalare turbine eoliene
311401\u0001maistru electronică
311402\u0001tehnician electronică
311403\u0001tehnician proiectant electronică
311501\u0001maistru cazangerie
311502\u0001maistru instalații navale
311503\u0001maistru întreținere și reparații mașini - unelte, utilități, service, prototipuri
311504\u0001maistru lăcătuș, construcții metalice
311505\u0001maistru lăcătuș mecanic
311506\u0001tehnician proiectant mecanic
311507\u0001mecanic pentru întreținerea aparatelor de lansare la zbor
311508\u0001maistru mecanic
311509\u0001maistru mecanic auto
311510\u0001maistru mecanică agricolă
311511\u0001maistru mecanică fină
311512\u0001maistru montaj
311513\u0001maistru prelucrări mecanice
311514\u0001maistru sculer – matrițer
311515\u0001maistru sudură
311516\u0001tehnician construcții navale
311517\u0001tehnician instalații de bord (avion)
311518\u0001tehnician mașini și utilaje
311519\u0001tehnician mecanic
311520\u0001tehnician prelucrări mecanice
311521\u0001tehnician sudură
311522\u0001tehnician tehnolog mecanic
311523\u0001maistru mecanic mașini și utilaje pentru construcții
311524\u0001tehnician mentenanță mecanică echipamente industriale
311525\u0001tehnician încercări componente vehicule/ grup motopropulsor/ optimizare energetică/ sisteme de măsurare
311526\u0001tehnician documentație studii
311527\u0001tehnician prestații vehicule
311528\u0001tehnician reglementări/ omologări oficiale
311529\u0001tehnician/ tehnician responsabil afacere, metode implantare
311530\u0001tehnician/ tehnician responsabil afacere, metode gestiune mijloace și utilaje
311531\u0001tehnician/ tehnician responsabil afacere, metode pregătire de industrializare
311532\u0001tehnician/ tehnician responsabil afacere, metode logistică
311533\u0001tehnician/ tehnician responsabil afacere, metode organizarea și măsurarea muncii
311534\u0001maistru fabricarea armamentului
311535\u0001inspector cu supravegherea și verificarea tehnică a instalațiilor
311536\u0001inspector ISCIR
311537\u0001tehnician mentenanță a sistemelor de poziționare dinamică
311538\u0001surveyor maritim
311539\u0001surveyor fluvial
311540\u0001tehnician mecatronist
311601\u0001decontaminator
311602\u0001laborant apă și apă grea
311603\u0001laborant control dozimetrie
311604\u0001laborant petrolist/ industria chimică
311605\u0001maistru petrolist/ industria chimică
311606\u0001laborant apă potabilă
311607\u0001tehnician petrolist chimie industrială
311608\u0001laborant petrochimist
311609\u0001maistru la fabricarea muniției
311701\u0001laborant structură macroscopică și microscopică
311702\u0001maistru metalurgie
311703\u0001maistru minier
311704\u0001maistru presator metale
311705\u0001maistru termotehnist
311706\u0001tehnician metalurgie
311707\u0001tehnician minier
311708\u0001tehnician proiectant minier
311709\u0001tehnician proiectant metalurg
311710\u0001tehnician mineralurg
311711\u0001maistru mineralurg
311712\u0001maistru termist - tratamentist
311713\u0001probator hidraulic piese turnate
311801\u0001desenator tehnic
311802\u0001trasator
311803\u0001desenator
311804\u0001topograf
311805\u0001trasator naval - desenator
311806\u0001trasator optic
311807\u0001tehnician proiectant
311808\u0001tehnician cadastru
311809\u0001tehnician imprimare 3D
311901\u0001maistru în industria celulozei și hârtiei
311902\u0001maistru tipograf
311903\u0001paginator tipograf
311904\u0001tehnician normare, salarizare, organizare
311905\u0001tehnician preț de cost
311906\u0001tehnician programare, lansare, urmărirea producției
311907\u0001tehnician preț de revenire/ costuri
311908\u0001tehnician gestiune salarială
311909\u0001tehnician gestiunea producției
311910\u0001tehnician gestiune stoc
311911\u0001maistru în industriile textilă, pielărie
311912\u0001tehnician în industria confecțiilor din piele și înlocuitori
311913\u0001tehnician în industria confecțiilor și tricotajelor
311914\u0001tehnician în industria încălțămintei
311915\u0001tehnician în industria pielăriei
311916\u0001tehnician în industria textilă
311917\u0001tehnician proiectant textile, pielărie
311918\u0001laborant în industriile textilă, pielărie
311919\u0001șef formație industria confecțiilor îmbrăcăminte
311920\u0001tehnician platou
311921\u0001tehnician în industria sticlei și ceramicii
311922\u0001maistru în industria sticlei și ceramicii
311923\u0001maistru frigotehnist
311924\u0001tehnician frigotehnist
311925\u0001tehnician în industria alimentară
311926\u0001tehnician laborant analize produse alimentare
311927\u0001tehnician în industria alimentară extractivă
311928\u0001tehnician în industria alimentară fermentativă
311929\u0001tehnician în industria cărnii, laptelui și conservelor
311930\u0001tehnician în morărit și panificație
311931\u0001tehnician proiectant în industria alimentară
311932\u0001maistru în industria alimentară
311933\u0001tehnolog alimentație publică
311934\u0001operator control nedistructiv
311935\u0001operator control nedistructiv cu radiații penetrante
311936\u0001operator control nedistructiv cu ultrasunete
311937\u0001operator control nedistructiv cu lichide penetrante
311938\u0001operator control nedistructiv cu particule magnetice
311939\u0001operator control nedistructiv cu curenți turbionari
311940\u0001operator control nedistructiv pentru verificarea etanșeității
311941\u0001operator responsabil cu supravegherea tehnică a instalațiilor
311942\u0001laborant pentru fabrica de ciment
311943\u0001operator control nedistructiv pentru examinare vizuală
311944\u0001creator/conceptor articole vestimentare
312101\u0001măsurător de gaze, temperatură și radiații
312102\u0001controlor de producție la minele de aur nativ
312103\u0001salvator minier
312201\u0001controlor calitate după efectuarea probelor la armament și muniție
312202\u0001controlor calitate pentru execuția elementelor la armament și muniție
312203\u0001controlor de calitate la protejări metalice
313101\u0001operator la instalațiile din centrale electrice
313102\u0001mașinist la instalațiile din centrale electrice
313103\u0001operator la instalațiile de cazane din centrale electrice
313104\u0001operator la instalațiile de turbine cu abur sau gaze
313105\u0001operator la camera de comandă termică
313106\u0001mașinist la instalațiile hidrotehnice din centrale electrice
313107\u0001mașinist la instalațiile de turbine hidraulice
313108\u0001mașinist la centrale diesel
313109\u0001operator punct termic
313110\u0001operator centrală termică
313111\u0001automatist pentru supraveghere și întreținere cazane
313113\u0001operator surse regenerabile de energie
313114\u0001operator în centrale hidroelectrice
313201\u0001operator la instalații de incinerare
313202\u0001operator hidraulic în alimentările cu apă
313203\u0001operator circuite rețea apă
313204\u0001mașinist la condiționarea aerului
313205\u0001operator la tratarea apei tehnologice
313206\u0001operator mașini refrigeratoare (conservare prin frig)
313401\u0001operator chimist la chimizarea metanului
313402\u0001rafinor
313404\u0001operator instalații îmbuteliere gaz petrol lichefiat
313403\u0001distilator la prelucrarea țițeiului
313901\u0001maistru-operator la roboți industriali
313902\u0001tehnician-operator la roboți industriali
313903\u0001tehnician în industria celulozei și hârtiei
313904\u0001controlor de conformitate în industria de mașini
313905\u0001tehnician asigurarea calității
313906\u0001tehnician analist calitate
313907\u0001tehnician cotator calitate
313908\u0001operator echipamente de termografie
314101\u0001tehnician în bacteriologie
314102\u0001tehnician în biochimie
314103\u0001tehnician în hematologie
314104\u0001tehnician în serologie
314105\u0001tehnician în biologie
314106\u0001tehnician în protecția mediului (tehnician ecolog)
314107\u0001evaluator și auditor de mediu
314201\u0001tehnician agronom - cercetare
314202\u0001tehnician zootehnist - cercetare
314203\u0001tehnician pedolog
314204\u0001operator însămânțări artificiale la animale
314205\u0001operator în ferme ecologice mixte
314206\u0001clasificator carcase
314301\u0001tehnician în industrializarea lemnului
314302\u0001tehnician proiectant în industrializarea lemnului
314303\u0001maistru în industrializarea lemnului
314304\u0001tehnician silvic-cercetare
314305\u0001tehnician în reconstrucția ecologică
314306\u0001tehnician cadastru forestier
314307\u0001tehnician amenajist
314308\u0001tehnician proiectant în reconstrucția ecologică
314309\u0001maistru silvic
314310\u0001brigadier silvic
314311\u0001pădurar
315101\u0001ofițer ajutor fluvial/ portuar
315102\u0001ofițer RTG
315103\u0001ofițer electrician fluvial/ portuar
315107\u0001ajutor ofițer mecanic fluvial
315201\u0001căpitan fluvial
315202\u0001căpitan port
315203\u0001ofițer intendent
315204\u0001ofițer port
315205\u0001ofițer de punte fluvial/ portuar
315206\u0001pilot de Dunăre maritimă
315207\u0001șef echipaj maritim/ fluvial
315208\u0001pilot de mare largă, pilot de port maritim
315209\u0001dragor maritim/ fluvial
315210\u0001pilot de port maritim aspirant/ pilot de Dunăre aspirant
315212\u0001ofițer de punte maritim aspirant/ ofițer mecanic maritim aspirant/ ofițer electrician maritim aspirant
315301\u0001comandant detașament zbor
315302\u0001comandant însoțitor de bord
315303\u0001copilot
315304\u0001inspector pilotaj
315305\u0001mecanic navigant aviație
315306\u0001pilot aeronave
315307\u0001pilot comandant avion
315308\u0001pilot încercare
315309\u0001pilot recepție și control aeronave
315310\u0001parașutist recepție și control
315311\u0001parașutist încercător
315312\u0001pilot parașutism încercător
315313\u0001pilot instructor aeronave
315314\u0001instructor parașutism
315315\u0001mecanic navigant instructor
315316\u0001maistru aviație
315317\u0001tehnician aviație
315401\u0001controlor dirijare nonradar
315402\u0001controlor sol
315403\u0001controlor trafic aviația civilă
315404\u0001dispecer sol
315405\u0001navigator dirijare radar
315406\u0001navigator aviația civilă
315407\u0001navigator dirijare nonradar
315408\u0001navigator dirijare zbor
315409\u0001navigator instructor dirijare radar și nonradar
315410\u0001navigator sol
315411\u0001operator radar
315412\u0001operator radiotelecomunicații aeronautice
315413\u0001controlor trafic aerian dirijare nonradar
315414\u0001controlor trafic aerian dirijare radar
315415\u0001controlor trafic aerian informare
315416\u0001navigator informare
315417\u0001operator/ specialist/ instructor telecomunicații aeronautice aviație civilă
315418\u0001șef tură telecomunicații aeronautice aviație civilă
315419\u0001controlor trafic aerian (simulator trafic aerian)
315420\u0001navigator instructor informare
315501\u0001agent salvare aeroportuară și instalații de stins incendii
315502\u0001mașinist agregate aerodrom
315503\u0001operator instalații control antiterorist/ antideturnare
315504\u0001operator radionavigant aviație
315505\u0001operator radionavigant instructor aviație
315506\u0001tehnician securitate aeriană
315507\u0001operator de handling
315508\u0001inspector siguranță operațională
315509\u0001agent de securitate aeroportuară
315510\u0001dispecer operațiuni de zbor
315511\u0001referent/ inspector în serviciile de trafic aerian
315512\u0001operator dispecerat operațional de supraveghere în serviciile de trafic aerian
315513\u0001tehnician protecția navigației aeriene (comunicații, navigație, supraveghere)
315514\u0001maistru protecția navigației aeriene (comunicații, navigație, supraveghere)
315515\u0001șef tură protecția navigației aeriene (comunicații, navigație, supraveghere)
315516\u0001tehnician în serviciile de trafic aerian
315517\u0001operator de handling combustibil
321101\u0001maistru aparate electromedicale
321102\u0001tehnician aparate electromedicale
321201\u0001autopsier
321301\u0001asistent farmacist
321302\u0001laborant farmacie
321303\u0001asistent medical de farmacie
321401\u0001tehnician protezist - ortezist
321402\u0001tehnician acustician - audioprotezist
321403\u0001tehnician evaluare, recomandare, furnizare și adaptare fotolii rulante
322101\u0001laborant în ocrotirea sănătății
322102\u0001soră medicală
322201\u0001asistentă puericultoare
324001\u0001agent veterinar
324002\u0001asistent veterinar
324003\u0001autopsier la ecarisaj
324004\u0001tehnician veterinar
325101\u0001tehnician dentar
325102\u0001asistent de profilaxie stomatologică
325103\u0001asistent de medicină dentară
325201\u0001administrator programe naționale boli transmisibile
325202\u0001agent rețea boli transmisibile
325203\u0001asistent coordonator programe naționale curative și boli netransmisibile
325301\u0001asistent medical comunitar
325401\u0001optician medical
325402\u0001optometrist (studii medii)
325501\u0001maseur
325502\u0001asistent medical fizioterapie
325503\u0001ergoterapeut
325504\u0001reflexoterapeut
325601\u0001oficiant medical
325602\u0001tehnician sanitar
325603\u0001asistent medical consiliere HIV/ SIDA
325704\u0001expert/ specialist standardizare
325705\u0001monitor mediul înconjurător
325706\u0001inspector pentru conformare ecologică
325707\u0001asistent standardizare
325708\u0001manager al sistemului de management al riscului
325709\u0001manager al sistemului de management securitate și sănătate în muncă
325710\u0001responsabil de mediu
325712\u0001inspector protecția mediului
325716\u0001auditor responsabilitate socială
325717\u0001responsabil al managementului responsabilității sociale
325718\u0001manager de responsabilitate socială
325719\u0001inspector sanitar
325720\u0001inspector protecție socială
325721\u0001tehnician în securitate și sănătate în muncă
325722\u0001tehnician condiții de muncă și securitate
325723\u0001inspector în domeniul securității și sănătății în muncă
325724\u0001coordonator în materie de securitate și sănătate în muncă (studii medii)
325726\u0001coordonator în materie de securitate și sănătate în muncă pentru logistică (studii medii)
325727\u0001specialist securitate și sănătate în muncă în domeniul servicii de întreținere și reparații autovehicule (studii medii)
325728\u0001manager dezvoltare durabilă pentru mobilă sau componente
325729\u0001tehnician ergonomist
325801\u0001brancardier
325802\u0001ambulanțier
325901\u0001asistent medical generalist
325902\u0001asistent medical nutriție dietetică
325903\u0001paramedic
325904\u0001asistent medical laborator
325905\u0001asistent medical de pediatrie
325906\u0001asistent medical obstetrică-ginecologie
325907\u0001asistent medical igienă și sănătate publică
325908\u0001asistent medic-social
325909\u0001asistent medical balneofizioterapie, balneofiziokinetoterapie și recuperare
325910\u0001asistent medical radiologie
331101\u0001cambist (broker valori)
331102\u0001agent de schimb
331103\u0001intermediar în activitatea financiară și comercială (broker)
331104\u0001broker bursa de mărfuri
331105\u0001agent de vânzări directe (produse financiar-bancare)
331106\u0001teleoperator financiar-bancar
331107\u0001agent marketing pensii private
331108\u0001agent pentru servicii de investiții financiare
331109\u0001broker de servicii pentru afaceri
331202\u0001ofițer operațiuni financiar-bancare
331301\u0001calculator devize
331302\u0001contabil
331303\u0001tehnician merceolog
331304\u0001planificator
331305\u0001revizor gestiune
331306\u0001contabil bugetar
331307\u0001secretar economic (studii medii)
331308\u0001merceolog
331309\u0001referent
331401\u0001referent statistician
331402\u0001statistician
331403\u0001statistician medical
331404\u0001actuar
331405\u0001tehnician planificare/ urmărire sinteze
331501\u0001estimator licitații
331502\u0001evaluator asigurări
331503\u0001evaluator tehnic daune auto
332101\u0001agent de asigurare
332102\u0001broker în asigurări
332201\u0001reprezentant tehnic
332202\u0001reprezentant comercial
332203\u0001agent de vânzări
332204\u0001consilier vânzări bijuterii și ceasuri
332301\u0001specialist în achiziții
332401\u0001agent comercial
332402\u0001mercantizor
332403\u0001agent vânzări standarde și produse conexe
333101\u0001agent contractări și achiziții (broker mărfuri)
333102\u0001recepționer contractări-achiziții
333103\u0001administrator cumpărări
333104\u0001agent cumpărări
333105\u0001declarant vamal
333106\u0001agent tranzit
333107\u0001agent maritim
333201\u0001organizator evenimente
333301\u0001agent repartizare a forței de muncă
333302\u0001agent orientare profesională a șomerilor/ agent informare privind cariera
333303\u0001agent evidență și plată a ajutorului de șomaj
333304\u0001referent resurse umane
333305\u0001agent ocupare
333307\u0001tehnician mobilitate personal
333308\u0001tehnician reconversie personal
333309\u0001instructor/ preparator formare
333310\u0001tehnician calificare gestiune competențe
333311\u0001tehnician resurse umane
333401\u0001agent imobiliar (broker imobiliar)
333901\u0001agent reclamă publicitară
333902\u0001agent literar
333903\u0001impresar muzical
333904\u0001impresar teatru
333905\u0001manager sportiv
333906\u0001asistent relații publice și comunicare (studii medii)
333907\u0001agent servicii client
333908\u0001impresar artistic
333909\u0001organizator spectacole
333910\u0001operator de interviu
333911\u0001referent comerț exterior
333912\u0001operator vânzări prin telefon
333913\u0001agent de navă
333914\u0001asistent atragere fonduri
334201\u0001secretar procuratură
334301\u0001secretar administrativ
334302\u0001secretar asistent director
334303\u0001asistent manager
334304\u0001asistent de cabinet
334401\u0001registrator medical
334402\u0001registrator medical în anatomie patologică
334403\u0001recepționer medical
334404\u0001transcriptor medical
335101\u0001controlor vamal, controlor pentru datoria vamală (studii medii)
335102\u0001revizor vamal
335103\u0001referent TIR și tranzite (studii medii)
335104\u0001referent vamal (studii medii)
335105\u0001expert/ inspector vamal
335106\u0001controlor vamal, controlor pentru datoria vamală, agent vamal (studii superioare)
335107\u0001inspector de trafic rutier (studii medii)
335201\u0001inspector taxe și impozite
335202\u0001operator rol
335203\u0001perceptor
335401\u0001inspector pensii, asigurări sociale și asistență socială
335402\u0001referent pensii, asigurări sociale și asistență socială
335403\u0001inspector pentru acordarea de permise, licențe sau autorizații
335404\u0001inspector de stat
335405\u0001inspector tehnic
335406\u0001expert
335501\u0001inspector de poliție
335502\u0001detectiv
335503\u0001anchetator poliție
335504\u0001detectiv particular
335901\u0001inspector metrolog
335902\u0001inspector prețuri
335903\u0001inspector salarii
335904\u0001comisar
341101\u0001agent procedural
341103\u0001grefier
341104\u0001secretar notariat
341105\u0001tehnician criminalist
341106\u0001funcționar în activități comerciale, administrative și prețuri
341107\u0001executor judecătoresc (tribunal, judecătorie)
341108\u0001arhivar notariat
341109\u0001expert tehnic judiciar
341110\u0001grefier statistician
341111\u0001grefier documentarist
341112\u0001secretar dactilograf laborator expertize criminalistice
341113\u0001asistent registrator
341114\u0001grefier arhivar
341115\u0001grefier registrator
341116\u0001ofițer antifraudă financiar-bancară (studii medii)
341201\u0001tehnician asistență socială
341202\u0001pedagog social
341203\u0001lucrător social pentru persoane cu probleme de dependență
341204\u0001facilitator de dezvoltare comunitară
341205\u0001lucrător de tineret
341206\u0001specialist în economia socială
341207\u0001tehnician egalitate de șanse
341301\u0001călugăr / călugăriță
341302\u0001paracliser
341303\u0001predicator
341304\u0001egumen / egumenă
341305\u0001preot
341306\u0001diacon
341307\u0001cântăreț bisericesc
341308\u0001dascăl
341309\u0001catehet
341401\u0001învățător
341402\u0001institutor
341501\u0001educatoare
341502\u0001educator puericultor
341601\u0001instructor școlar auto
341901\u0001maistru instructor
341902\u0001pedagog școlar
341903\u0001secretar școală
341904\u0001șef atelier școală
341905\u0001mediator școlar
342101\u0001fotbalist profesionist
342102\u0001sportiv profesionist în alte discipline sportive
342103\u0001jucător de rugbi
342104\u0001sportiv de înaltă performanță
342105\u0001sportiv de performanță
342201\u0001antrenor
342202\u0001instructor sportiv
342203\u0001secretar federație
342204\u0001antrenor de fotbal profesionist
342205\u0001instructor arte marțiale
342206\u0001instructor (monitor) schi/ călărie/ golf/ tenis/ înot/ sporturi extreme
342207\u0001antrenor coordonator
342208\u0001arbitru judecător sportiv
342209\u0001preparator sportiv
342210\u0001impresar sportiv
342211\u0001oficial sportiv acreditat
342212\u0001instructor în poligonul de tir
342213\u0001supraveghetor în poligonul de tir
342214\u0001monitor de schi, snow-board și sporturi de alunecare pe zăpadă
342215\u0001instructor educație acvatică
342216\u0001arbitru de fotbal
342217\u0001organizator evenimente sportive
342218\u0001ofițer de control doping (studii medii)
342219\u0001steward sportiv
342220\u0001antrenor național
342301\u0001animator sportiv
342302\u0001instructor de fitness
342303\u0001antrenor de fitness
342304\u0001instructor de aerobic-fitness
342305\u0001instructor educație fizică
342306\u0001instructor salvaspeo
342307\u0001instructor speologie
342308\u0001instructor canioning
342309\u0001instructor în poligonul de tragere
342310\u0001instructor de dans
343101\u0001fotograf
343102\u0001laborant foto
343103\u0001retușor foto
343104\u0001operator prelucrare peliculă
343201\u0001butafor
343202\u0001decorator interioare
343203\u0001desenator artistic (studii medii)
343204\u0001decorator vitrine
343205\u0001desenator artistic (studii superioare)
343301\u0001restaurator opere de artă și monumente istorice (studii medii)
343302\u0001conservator opere de artă și monumente istorice (studii medii)
343303\u0001restaurator bunuri culturale (studii medii)
343304\u0001conservator bunuri culturale (studii medii)
343305\u0001restaurator arhivă (studii medii)
343306\u0001conservator arhivă (studii medii)
343401\u0001șef de sală restaurant
343402\u0001barman - șef
343403\u0001bucătar - șef
343404\u0001cofetar - șef
343405\u0001inspector calitate producție culinară
343501\u0001mânuitor, montator decor
343502\u0001tehnician machetist
343503\u0001tehnician reclame (decorator)
343504\u0001maestru de lumini
343505\u0001maestru de sunet
343506\u0001caricaturist (studii medii)
343507\u0001tehnoredactor
343508\u0001secretar de redacție (studii medii)
343509\u0001organizator de producție
343510\u0001asistent regizor artistic
343511\u0001reporter (studii medii)
343512\u0001machior spectacole
343513\u0001peruchier
343514\u0001secretar de emisie (studii medii)
343515\u0001ghid de animație
343516\u0001documentarist (studii medii)
343517\u0001traducător (studii medii)
343518\u0001videojurnalist (studii medii)
343519\u0001copywriter publicitate (studii medii)
343520\u0001corector (studii medii)
343521\u0001electrician iluminare scenă
343522\u0001secretar artistic
343523\u0001gestionar custode sală
343524\u0001prezentator TV
343525\u0001disc-jockey
343526\u0001creator de conținut online
351101\u0001operator calculator electronic și rețele
351102\u0001șef tură exploatare în centre sau oficii de calcul
351103\u0001tehnician echipamente de calcul și rețele
351104\u0001operator în domeniul proiectării asistate pe calculator
351105\u0001administrator sistem documentar
351106\u0001operator prompter
351107\u0001operator suport tehnic pentru servicii de comunicații electronice
351108\u0001analist testare software
351201\u0001programator ajutor
351202\u0001analist ajutor
351203\u0001tehnician TIC
352101\u0001acustician cinematografic
352102\u0001controlor și recondiționer filme
352103\u0001electrician iluminare filmare
352104\u0001etaloner
352105\u0001maistru aparate video și sunet
352106\u0001mașinist mecanic traweling
352107\u0001mecanic cameră filmare
352108\u0001montor imagine
352109\u0001montor negative și de pregătire a peliculei
352110\u0001montor pozitive
352111\u0001operator cameră diafilm, diapozitive
352112\u0001operator emisie-recepție
352113\u0001operator producție RTV
352114\u0001preparator filmare
352115\u0001proiecționist
352116\u0001senzitometrist
352119\u0001editor imagine
352120\u0001tehnician iluminat tehnologic
352121\u0001ilustrator muzical
352122\u0001controlor emisii RTV
352123\u0001montor emisie
352124\u0001operator imagine
352125\u0001operator radio-radioficare
352126\u0001operator sunet
352127\u0001tehnician radioelectronist
352128\u0001tehnician CATV
352129\u0001operator dispecer sisteme de monitorizare și aparatură de control
352130\u0001tehnician pentru sisteme de detecție, supraveghere video, control acces
352131\u0001cameraman
352132\u0001tehnician de echipamente TV
352133\u0001radioelectronist stații de emisie radio-TV
352134\u0001tehnician la echipamente de înregistrare imagine și sunet
352135\u0001designer video
352201\u0001șef formație sisteme radiante (antene)
352202\u0001tehnician construcții telefonice
352203\u0001tehnician radiolocații
352204\u0001tehnician turn parașutism
352205\u0001inspector exploatare poștală
352206\u0001tehnician stații de emisie radio-TV
352207\u0001tehnician stații radiorelee și satelit
352208\u0001maistru materiale emisie RTV și telecomunicații
352209\u0001pilonist antenist
352210\u0001tehnician rețele de telecomunicații
352211\u0001operator rețele de telecomunicații
352212\u0001radioelectronist stații radiorelee și satelit
352213\u0001maistru transporturi, poștă și telecomunicații
352214\u0001tehnician transporturi, poștă și telecomunicații
352215\u0001tehnician proiectant transporturi și comunicații
411001\u0001funcționar administrativ
411002\u0001inspector documente secrete
411003\u0001referent de stare civilă
412001\u0001secretară
412002\u0001secretară dactilografă
412003\u0001secretară prelucrare texte
413101\u0001dactilografă
413102\u0001stenodactilografă
413103\u0001referent transmitere
413104\u0001telefaxist
413107\u0001telebanker
413201\u0001operator introducere, validare și prelucrare date
413202\u0001operator tehnică poligraf
413203\u0001operator procesare text și imagine
413204\u0001registrator de arhivă electronică de garanții reale mobiliare
413205\u0001operator mașină contabilizat
413206\u0001operator mașină de calculat
413207\u0001asistent analist de informații
421101\u0001casier tezaur
421102\u0001casier valută
421103\u0001mânuitor valori (presă, poștă)
421104\u0001numărător bani
421105\u0001verificator bani
421106\u0001verificator valori
421107\u0001casier trezorier
421108\u0001șef casierie centrală
421109\u0001șef supraveghere case
421110\u0001operator ghișeu bancă
421111\u0001operator ghișeu birouri de schimb
421112\u0001administrator cont
421113\u0001referent operații între sedii
421114\u0001referent casier
421115\u0001operator gestionar loto
421201\u0001crupier
421202\u0001schimbător fise - changeur (cazino)
421203\u0001supraveghetor jocuri (cazino)
421204\u0001șef de masă (cazino)
421205\u0001cap de masă (cazino)
421301\u0001amanetar
421401\u0001agent fiscal
421402\u0001colector (recuperator) creanțe/debite
422101\u0001agent de voiaj
422102\u0001agent de turism
422103\u0001agent de turism tour-operator
422104\u0001agent de transport turistic intern
422105\u0001agent de transport internațional
422106\u0001agent de asistență turistică
422107\u0001agent turism de afaceri
422108\u0001agent transporturi externe
422109\u0001agent transporturi interne
422110\u0001funcționar agenție voiaj
422111\u0001agent de turism pentru circuite tematice
422301\u0001oficiant telefoane
422302\u0001oficiant telegraf
422303\u0001radiotelegrafist
422304\u0001telefonist
422305\u0001telefonist instructor
422306\u0001telegrafist (teleimprimatorist)
422307\u0001operator registrator de urgență
422401\u0001recepționer de hotel
422402\u0001lucrător concierge
422403\u0001șef de recepție hotel
422404\u0001tehnician compartiment securitate hotel
422405\u0001responsabil cazare
422406\u0001tehnician în hotelărie
422501\u0001impiegat informații
422502\u0001funcționar informații clienți
422601\u0001recepționist
431101\u0001calculator preț cost
431102\u0001funcționar economic
431103\u0001operator devize
431104\u0001șef secție inventar
431201\u0001agent bursă
431202\u0001contabil financiar bancar
431203\u0001administrator financiar (patrimoniu) studii medii
431301\u0001pontator
432101\u0001gestionar depozit
432102\u0001magaziner
432103\u0001operator siloz (silozar)
432104\u0001primitor-distribuitor materiale și scule
432105\u0001recuziter
432106\u0001sortator produse
432107\u0001trezorier (studii medii)
432109\u0001pivnicer
432110\u0001primitor-distribuitor benzină și motorină
432111\u0001lucrător gestionar
432112\u0001șef raion/ adjunct mărfuri alimentare/ nealimentare
432113\u0001recepționer-distribuitor
432114\u0001logistician responsabil comenzi
432201\u0001dispecer
432202\u0001facturist
432203\u0001lansator produse
432204\u0001programator producție
432205\u0001dispecer operațiuni salubrizare
432206\u0001programator grafic de execuție pentru realizarea proiectului
432301\u0001agent transporturi
432302\u0001funcționar informații
432303\u0001controlor trafic
432304\u0001impiegat auto
432305\u0001impiegat informații aviație
432306\u0001impiegat registru mișcare
432307\u0001însoțitor vagoane
432308\u0001inspector RNR (Registrul Naval Român)
432309\u0001inspector exploatare trafic
432310\u0001instructor depou
432311\u0001instructor revizie vagoane
432312\u0001instructor stație
432313\u0001operator circulație mișcare
432314\u0001operator comercial
432315\u0001operator dană
432316\u0001operator programare
432317\u0001picher
432319\u0001revizor tehnic vagoane
432320\u0001scriitor vagoane
432321\u0001șef agenție colectare și expediție mărfuri
432322\u0001șef autogară
432323\u0001avizier căi ferate
432324\u0001șef haltă
432325\u0001șef stație taxare
432326\u0001șef tură la comanda personalului de tren
432327\u0001șef tură pregătirea personalului la vagon-restaurant și de dormit
432328\u0001șef tură revizie vagoane
432329\u0001veghetor încărcare-descărcare
432330\u0001verificator documente expediție
432331\u0001expeditor internațional
432332\u0001operator recepție
432333\u0001agent curier
432334\u0001agent stație metrou
432335\u0001impiegat de mișcare metrou
432336\u0001operator mișcare metrou
432337\u0001operator portuar stivator
432338\u0001operator portuar expeditor
432339\u0001operator portuar dispecer/ planificator
432340\u0001grafician mers de tren
432341\u0001referent de specialitate TIR și tranzite (studii superioare)
432342\u0001agent feroviar marfă
432343\u0001referent protocol aeroportuar
432344\u0001revizor tehnic auto
441101\u0001bibliotecar (studii medii)
441102\u0001discotecar
441103\u0001filmotecar
441104\u0001fonotecar
441105\u0001fototecar
441106\u0001mânuitor carte
441107\u0001videotecar
441201\u0001agent poștal
441202\u0001cartator poștal
441203\u0001cartator presă
441204\u0001cartator telegrame
441205\u0001diriginte poștă
441206\u0001factor poștal
441208\u0001oficiant poștă telegrame
441209\u0001oficiant presă
441210\u0001prelucrător presă scrisă
441211\u0001responsabil tură expediție
441301\u0001codificator
441302\u0001corector editură presă
441303\u0001corector-revizor poligrafie
441501\u0001arhivar
441502\u0001funcționar documentare
441601\u0001referent evidența persoanelor
441901\u0001funcționar ghișeu servicii publice
441902\u0001expert local pe problemele romilor
441903\u0001expert relații sociale
511101\u0001însoțitor de bord
511102\u0001stewardesă
511201\u0001conductor tren
511202\u0001revizor bilete
511203\u0001controlor bilete
511204\u0001conductor vagon de dormit și cușetă
511205\u0001controlor acces metrou
511206\u0001șef tură comandă vagon de dormit – cușetă
511207\u0001însoțitor pasageri în transportul rutier
511301\u0001ghid de turism
511302\u0001ghid de turism intern (local)
511303\u0001ghid național de turism (tour-operator)
511304\u0001ghid de turism montan, drumeție montană
511305\u0001ghid galerii de artă/ interpret
511306\u0001ghid habitat natural floră, faună
511307\u0001ghid turism ornitologic
511308\u0001ghid turism speologic
511309\u0001ghid turism ecvestru
511310\u0001ghid de turism sportiv (alpinism și cățărări pe stânci/ schi/ bob/ înot/ canotaj/ iahting/ zbor cu aparate ultraușoare)
511311\u0001ghid montan
511312\u0001ghid obiectiv cultural
511313\u0001însoțitor grup turistic
511314\u0001organizator activitate turism (studii medii)
511315\u0001ranger
511316\u0001custode pentru arii protejate
511317\u0001animator de hotel
511318\u0001însoțitor speolog
511319\u0001ghid turistic pentru peșteri amenajate
511320\u0001ghid canioning
512001\u0001bucătar
512002\u0001pizzar
512003\u0001bucătar specialist/ vegetarian/ dietetician
512004\u0001maestru în arta culinară
513101\u0001ajutor ospătar
513102\u0001ospătar (chelner)
513103\u0001somelier
513201\u0001barman
513202\u0001barman preparator
513203\u0001barman preparator de cafea (barista)
514101\u0001coafor
514102\u0001frizer
514103\u0001coafor stilist
514104\u0001stilist extensii de păr
514201\u0001cosmetician
514202\u0001manichiurist
514203\u0001pedichiurist
514204\u0001maseur de întreținere și relaxare
514205\u0001machior
514206\u0001tatuator
514207\u0001montator bijuterii pe corp
514208\u0001stilist protezist de unghii
514209\u0001operator întreținere corporală
514210\u0001dermopigmentist
514211\u0001stilist extensii gene
515101\u0001cabanier
515102\u0001guvernantă de hotel/ etaj
515103\u0001lenjereasă de hotel
515104\u0001administrator
515105\u0001administrator piețe și târguri
515106\u0001intendent
515107\u0001șef cantină
515108\u0001dispecer pentru servire în cameră (hotel)
515109\u0001supraveghetor muzeu
515110\u0001lucrător hotelier
515201\u0001gospodar
515202\u0001îngrijitor vilă
515203\u0001administrator pensiune turistică
515204\u0001lucrător în gospodăria agroturistică
515301\u0001îngrijitor clădiri
515302\u0001agent curățenie clădiri și mijloace de transport
515303\u0001administrator de condominii
516101\u0001astrolog
516102\u0001numerolog
516201\u0001cameristă hotel
516202\u0001însoțitor
516203\u0001valet
516301\u0001antreprenor servicii funerare
516302\u0001decorator servicii funerare
516303\u0001îmbălsămător
516304\u0001tanatopractor
516401\u0001îngrijitor farmacii, cabinete veterinare
516402\u0001coafor canin
516403\u0001instructor dresaj câini ghizi
516404\u0001dresor câini
516501\u0001instructor școlar auto
516502\u0001instructor auto
516901\u0001agent dezinfecție, deratizare, dezinsecție
516902\u0001gazdă club
516903\u0001organizator prestări servicii
516904\u0001agent ecolog
516905\u0001raportor ecolog
516906\u0001întreținător textile-piele
516907\u0001animator socioeducativ
516908\u0001animator centre de vacanță
516909\u0001lucrător pensiune turistică
516910\u0001operator pârtie de schi
516911\u0001prestidigitator
516912\u0001iluzionist de circ
516913\u0001lucrător interpret în limbaj mimico-gestual
521201\u0001vânzător ambulant de produse alimentare
522101\u0001vânzător
522102\u0001comerciant vânzător mărfuri nealimentare
522201\u0001anticar
522301\u0001librar
522302\u0001lucrător controlor final
522303\u0001lucrător comercial
522304\u0001lucrător produse naturiste
522305\u0001vânzător de produse naturiste
523001\u0001taxator
523002\u0001vânzător de bilete
523003\u0001casier
523004\u0001casier metrou
524101\u0001manechin
524102\u0001model - atelier artistic și publicitate
524103\u0001prezentator modă
524301\u0001vânzător la domiciliul clientului pe bază de comandă
524601\u0001bufetier
531101\u0001îngrijitor de copii
531102\u0001guvernantă
531103\u0001baby sitter
531104\u0001bonă
531201\u0001asistent maternal
531202\u0001părinte social
531203\u0001educator specializat
531204\u0001îngrijitor grupă învățământ preșcolar
532101\u0001băieș
532102\u0001gipsar
532103\u0001infirmier/infirmieră
532104\u0001îngrijitoare la unități de ocrotire socială și sanitară
532105\u0001lăcar
532106\u0001nămolar
532201\u0001îngrijitor bătrâni la domiciliu
532202\u0001îngrijitor bolnavi la domiciliu
532203\u0001asistent personal al persoanei cu handicap grav
532204\u0001îngrijitor la domiciliu
532901\u0001mediator sanitar
532902\u0001mediator social
532903\u0001lucrător prin arte combinate
532904\u0001asistent personal profesionist
532905\u0001asistent personal de îngrijire
532906\u0001operator prestații sociale
532907\u0001supraveghetor de noapte servicii sociale
532908\u0001lucrător social
541101\u0001șef compartiment pentru prevenire
541102\u0001șef formație intervenție, salvare și prim ajutor
541103\u0001specialiști pentru prevenire
541104\u0001servant pompier
541105\u0001șef grupă intervenție
541106\u0001șef echipă specializată
541201\u0001polițist local
541301\u0001agent de poliție penitenciară
541302\u0001educator în penitenciare
541401\u0001agent de securitate
541402\u0001agent control acces
541403\u0001agent de securitate incintă (magazin, hotel, întreprindere etc.)
541404\u0001agent gardă de corp
541405\u0001șef serviciu pază
541406\u0001agent de securitate intervenție
541407\u0001agent transport valori
541408\u0001dispecer centru de alarmă
541409\u0001șef tură servicii securitate
541410\u0001inspector de securitate
541411\u0001evaluator de risc de efracție
541412\u0001agent de securitate conducător câini de serviciu patrulare
541413\u0001agent de securitate competiții sportive
541414\u0001șef obiectiv servicii de securitate
541901\u0001șef serviciu voluntar/ privat pentru situații de urgență
541902\u0001cadru tehnic cu atribuții în domeniul prevenirii și stingerii incendiilor
541903\u0001salvator la ștrand
541904\u0001salvator montan
541905\u0001salvamar
541906\u0001gardian feroviar
541907\u0001agent conducător câini de serviciu
541908\u0001salvator din mediul subteran speologic
541909\u0001salvator din mediul subacvatic speologic
611101\u0001agricultor
611103\u0001legumicultor
611104\u0001lucrător calificat în culturi de câmp și legumicultură
611105\u0001agricultor pentru culturi de câmp ecologice
611201\u0001arboricultor
611202\u0001ciupercar
611203\u0001florar-decorator
611204\u0001floricultor
611205\u0001peisagist - floricultor
611206\u0001lucrător calificat în floricultură și arboricultură
611207\u0001pomicultor
611208\u0001viticultor
611301\u0001fermier în horticultură
611302\u0001lucrător calificat în irigații
611303\u0001grădinar
612101\u0001cioban (oier)
612102\u0001crescător-îngrijitor de animale domestice pentru producția de lapte și carne
612103\u0001tocător de furaje
612104\u0001lucrător calificat în creșterea animalelor
612105\u0001crescător bovine
612106\u0001crescător porcine
612107\u0001mamoș porcine
612108\u0001baci montan
612109\u0001cioban montan
612110\u0001crescător de oi montan
612111\u0001oier montan
612201\u0001crescător de păsări
612202\u0001fazanier
612203\u0001crescător de păsări pentru reproducție
612204\u0001crescător de păsări pentru ouă de consum
612205\u0001crescător de pui pentru carne
612206\u0001crescător de păsări de rasă și pentru decor
612207\u0001arbitru pentru păsări de rasă
612301\u0001apicultor
612302\u0001sericicultor
612901\u0001crescător de animale mici
612902\u0001crescător-îngrijitor animale sălbatice captive
612903\u0001crescător-îngrijitor de animale de laborator
612904\u0001crescător de melci
612905\u0001antrenor cabaline
612906\u0001crescător-îngrijitor de cabaline
612907\u0001herghelegiu
613001\u0001fermier în producția vegetală
613002\u0001fermier în producția animală
613003\u0001agricultor în culturi vegetale și crescător de animale
621001\u0001cioplitor în lemn
621002\u0001carbonitor
621003\u0001fasonator mecanic (cherestea)
621004\u0001muncitor plantații și amenajare zonă verde
621005\u0001pepinierist
621006\u0001presator stuf
621007\u0001protecționist silvic
621008\u0001recoltator stuf
621009\u0001rezinator
621010\u0001șef coloană exploatare stuf
621011\u0001stivuitor și recepționer silvic
621012\u0001tăietor silvic
621013\u0001preparator mangal
621014\u0001mangalizator
622101\u0001lucrător în culturi acvatice
622102\u0001piscicultor
622201\u0001pescar în ape interioare și de coastă
622301\u0001pescar în mări și oceane
622401\u0001paznic de vânătoare
711101\u0001muncitor constructor bârne, chirpici, piatră
711102\u0001confecționer plăci din diverse materiale
711103\u0001confecționer plase și pânze rabiț din stuf
711104\u0001laborant pentru construcții de drumuri și construcții civile
711201\u0001sobar
711202\u0001zidar coșuri fabrică
711203\u0001zidar pietrar
711204\u0001zidar șamotor
711205\u0001zidar roșar-tencuitor
711206\u0001zidar restaurator
711301\u0001cioplitor în piatră și marmură
711302\u0001cioplitor-montator piatră, marmură
711303\u0001gaterist la tăiat blocuri de piatră, marmură
711304\u0001tăietor, șlefuitor, lustruitor piatră, marmură
711305\u0001restaurator piatră
711401\u0001betonist
711402\u0001fierar betonist
711403\u0001montator elemente prefabricate din beton armat
711404\u0001constructor structuri monolite
711405\u0001operator injectorist
711406\u0001injectorist în construcții
711407\u0001operator elemente din beton precomprimat cu armătura pretensionată
711501\u0001dulgher (exclusiv restaurator)
711502\u0001dulgher restaurator
711901\u0001muncitor hidrometru
711902\u0001pavator
711903\u0001săpător fântâni
711904\u0001asfaltator
711905\u0001cantonier
711906\u0001chesonier
711907\u0001constructor căi ferate
711908\u0001constructor linii tramvai
711909\u0001drenor canalist
711910\u0001fascinar
711911\u0001finisor terasamente
711912\u0001muncitor hidrogeolog
711913\u0001muncitor constructor șenal navigabil, lucrări hidrotehnice și portuare
711914\u0001șef echipă întreținere poduri metalice, viaducte și tuneluri
711915\u0001agent hidrotehnic
711916\u0001revizor cale sau puncte periculoase
711917\u0001meseriaș întreținere cale
711918\u0001șef echipă întreținere cale
711919\u0001meseriaș întreținere poduri metalice, viaducte și tuneluri
711920\u0001alpinist utilitar
711921\u0001laborant determinări fizico-mecanice pentru lucrări de drumuri și poduri
711922\u0001șef echipă întreținere cale metrou
711923\u0001șef echipă lucrări artă metrou
711924\u0001lucrător pentru drumuri și căi ferate
711925\u0001muncitor în tăieri structuri cu scule diamantate
711926\u0001speolog utilitar
712101\u0001acoperitor-învelitor țiglă, azbociment, tablă
712102\u0001constructor de acoperișuri
712201\u0001faianțar
712202\u0001montator placaje interioare și exterioare
712203\u0001mozaicar (exclusiv restaurator)
712204\u0001parchetar
712205\u0001mozaicar restaurator
712206\u0001linolist
712207\u0001montator placaje uscate
712301\u0001ipsosar (exclusiv restaurator)
712302\u0001turnător ornamentalist
712303\u0001ipsosar restaurator ornamente din ipsos
712401\u0001izolator fonic
712402\u0001izolator frigorific
712403\u0001izolator hidrofug
712404\u0001izolator lucrări speciale (antiacide și de protecție)
712405\u0001izolator termic
712406\u0001montator pereți și plafoane din ghips-carton
712407\u0001asamblator-montator profile aluminiu și geam termopan
712408\u0001confecționer vitraje izolante
712409\u0001confecționer tâmplărie din aluminiu și mase plastice
712410\u0001montator sisteme tâmplărie termoizolantă
712411\u0001confecționer-montator tâmplărie cu vitraj izolant
712412\u0001montator materiale geosintetice
712413\u0001sudor geomembrană
712414\u0001montator geogrile
712415\u0001montator materiale geotextile și geocompozite
712416\u0001montator sisteme opace de termoizolare pentru clădiri
712501\u0001geamgiu
712601\u0001detector pierderi apă și gaze
712602\u0001instalator apă, canal
712603\u0001instalator frigotehnist
712604\u0001instalator încălzire centrală și gaze
712605\u0001instalator rețele de distribuție/ transport fluide
712606\u0001instalator ventilare și condiționare aer
712607\u0001verificator canale subterane
712608\u0001instalator centrale termice
712609\u0001instalator instalații tehnico-sanitare și de gaze
712610\u0001instalator autorizat proiectare execuție și/ sau exploatare obiectiv/ sisteme de transport și înmagazinare-stocare
712611\u0001instalator autorizat proiectare execuție și/ sau exploatare obiectiv/ sisteme de distribuție
712612\u0001instalator rețele termice și sanitare
712613\u0001operator instalații apă și canalizare
712614\u0001instalator pentru pompe de căldură
712615\u0001instalator pentru sisteme geotermale
712701\u0001frigoriferist (frigotehnist)
713101\u0001tapetar
713102\u0001zugrav
713103\u0001stucaturist
713104\u0001ignifugator
713105\u0001operator termoprotecție
713201\u0001lăcuitor lemn
713202\u0001vopsitor industrial
713203\u0001finisor-lăcuitor lemn
713204\u0001vopsitor
713205\u0001vopsitor auto
713301\u0001coșar
713302\u0001curățitor de fațade
721101\u0001modelier lemn
721102\u0001modelier metal
721103\u0001modelator-miezuitor
721104\u0001modelier naval
721105\u0001operator la mașini de brichetat șpan
721106\u0001pregătitor metale vechi pentru retopire
721107\u0001recuperator metale vechi
721108\u0001topitor aliaje tipografie
721109\u0001topitor fontă și neferoase
721110\u0001topitor, turnător metale și aliaje neferoase
721111\u0001turnător fontă pe bandă
721112\u0001turnător formator
721114\u0001turnător modelier
721113\u0001turnător pregătitor oțelărie
721115\u0001turnător metale și neferoase
721116\u0001modelor prototipuri auto
721201\u0001brazor
721202\u0001sudor manual cu flacără de gaze
721203\u0001sudor manual cu arc electric
721204\u0001sudor cu arc electric acoperit sub strat de flux
721205\u0001operator tăiere
721206\u0001sudor cu arc electric cu electrod fuzibil în mediu de gaz protector
721207\u0001sudor cu arc electric cu electrod nefuzibil în mediu de gaz protector
721208\u0001sudor
721301\u0001cazangiu recipiente
721302\u0001probator hidraulic cazane, țevi, recipiente
721303\u0001tinichigiu carosier
721304\u0001tinichigiu industrial
721305\u0001tinichigiu de șantier
721306\u0001tinichigiu structurist de aviație
721307\u0001cazangiu țevar
721308\u0001cazangiu formator
721309\u0001tinichigiu restaurator
721310\u0001tinichigiu sisteme de acoperișuri și învelitori
721311\u0001tinichigiu sisteme de ventilație
721312\u0001tinichigiu în construcții
721401\u0001finisor cocleți
721402\u0001finisor ace și accesorii
721403\u0001confecționer capace de carde
721404\u0001confecționer cocleți
721405\u0001confecționer plase din sârmă
721406\u0001formator țevi prin sudare
721407\u0001lăcătuș construcții metalice și navale
721408\u0001lăcătuș de mină
721409\u0001lăcătuș revizie vagoane
721410\u0001lăcătuș mecanic
721411\u0001lăcătuș-montator
721412\u0001presator metale la rece
721413\u0001recondiționer scule și utilaje petroliere
721414\u0001șanfrenator
721415\u0001pregătitor, montator, reparator ițe, cocleți, lamele, spete
721416\u0001repasator garnituri carde
721417\u0001tubulator naval
721418\u0001mașinist la litografiat și vernisat tablă
721419\u0001mașinist la confecționarea ambalajelor metalice
721420\u0001mașinist la confecționarea tuburilor de aluminiu
721421\u0001constructor-montator de structuri metalice
721422\u0001mașinist la fabricarea acelor și accesoriilor
721423\u0001nituitor
721424\u0001lăcătuș mecanic de întreținere și reparații universale
721425\u0001mașinist la confecționarea spetelor și spiralelor
721426\u0001montator-ajustor spete
721427\u0001lipitor și protejator spete
721430\u0001lăcătuș-depanator utilaje calcul
721431\u0001operator la montarea și conservarea produselor după probe
721432\u0001schelar
721433\u0001confecționer-montator structuri metalice pentru construcții
721434\u0001montator fațade și pereți cortină
721435\u0001mecanic operator
721436\u0001lucrător în lăcătușerie mecanică structuri
721501\u0001mecanic-montator instalații cu cablu în silvicultură și exploatări forestiere
722101\u0001forjor-matrițer
722102\u0001prelucrător mecanic metale prețioase
722103\u0001presator piese din pulberi metalice
722104\u0001ștanțator
722105\u0001presator, ambutisor la cald
722106\u0001forjor manual
722107\u0001forjor-arcurar
722108\u0001forjor mecanic
722110\u0001preparator pulberi
722111\u0001cuptorar-termist pentru ferite
722112\u0001fierar/ potcovar
722113\u0001formator-presator ferite
722114\u0001finisor ferite
722115\u0001controlor de calitate la forjare
722116\u0001controlor de calitate la turnare
722117\u0001debitator-eboșator
722118\u0001dusisator-polizator
722201\u0001lăcătuș SDV
722202\u0001sculer-matrițer
722203\u0001lăcătuș AMC
722204\u0001lăcătuș mecanică fină
722205\u0001prelucrător prin electroeroziune
722206\u0001lăcătuș la prelucrarea și îndreptarea țevilor ghintuite
722207\u0001lăcătuș construcții structuri aeronave
722301\u0001reglor la mașini pentru fabricarea cablurilor, conductorilor electrici și materialelor electrice
722302\u0001reglor la mașini pentru confecționarea elementelor galvanice
722303\u0001reglor benzi montaj
722304\u0001mașinist la linii automate așchietoare
722305\u0001reglor mașini de bobinat și platinat
722306\u0001reglor la mașini de prelucrare mase plastice
722307\u0001reglor mașini-unelte
722308\u0001reglor-montator
722309\u0001reglor la mașini pentru fabricarea lămpilor electrice
722310\u0001reglor și reglor-conductor la mașini-unelte
722311\u0001conductor de instalații
722312\u0001operator la mașini-unelte semiautomate și automate
722313\u0001dozator la fabricarea electrozilor de sudură
722314\u0001mașinist la lame de mașini pentru automate așchietoare
722315\u0001degresator-imersioner
722316\u0001uscător electrozi de sudură
722317\u0001mașinist la mașini speciale fără așchiere
722318\u0001preparator amestec de înveliș
722319\u0001pregătitor sârmă
722320\u0001finisator electrozi de sudură
722321\u0001mașinist la mașini speciale de așchiere
722322\u0001mașinist la confecționarea tuburilor de protecție și a dozelor de ramificație
722323\u0001operator la mașini-unelte cu comandă numerică
722324\u0001operator la mașini de electroeroziune automate
722401\u0001ascuțitor laminate la cald
722402\u0001ascuțitor laminate la rece
722403\u0001ascuțitor-călitor garnituri de carde
722404\u0001ascuțitor scule, instrumente medicale și obiecte de uz casnic
722405\u0001debitator-șlefuitor perii de mașini electrice
722406\u0001polizator
722407\u0001șlefuitor metale
722408\u0001frezor universal
722409\u0001găuritor- filetator
722410\u0001honuitor, rodator-lepuitor
722411\u0001rabotor-mortezor universal
722412\u0001rectificator universal
722413\u0001strungar universal
722414\u0001broșator
722415\u0001frezor la mașini roți dințate
722416\u0001gravor mecanic
722417\u0001rabotor-mortezor roți dințate
722418\u0001rectificator dantură caneluri
722419\u0001strungar la strung paralel și de detalonat
722420\u0001strungar la strung revolver
722421\u0001strungar la strung carusel
722422\u0001strungar la mașini orizontale
722423\u0001strungar la mașini de alezat
722424\u0001strungar la mașini de prelucrat în coordonate
722425\u0001strungar la mașini de strunjit roți căi ferate
722426\u0001rectificator piese producătoare de ochiuri
722427\u0001șlefuitor metale cu plumb industria de armament
722428\u0001debitator semifabricate
722429\u0001curățitor-sablator
723101\u0001electrician auto
723102\u0001electromecanic auto
723103\u0001mecanic auto
723104\u0001operator standuri încercări
723105\u0001operator pregătire încercări vehicule
723201\u0001mecanic aviație
723301\u0001lăcătuș-montator agregate energetice și de transport
723302\u0001mecanic utilaj
723303\u0001mecanic agricol
723304\u0001motorist
723305\u0001ungător-gresor
723306\u0001operator în verificarea, reîncărcarea și repararea stingătoarelor de incendiu
723307\u0001mecanic întreținere și reparații mașini de cusut industriale
723308\u0001operator în verificarea, întreținerea și repararea autospecialelor destinate apărării împotriva incendiilor
723309\u0001mecanic mașini agricole
723310\u0001mecanic trolist
723311\u0001mecanic întreținere și reparații utilaje din industria textilă, confecții și încălțăminte
731101\u0001AMC-ist
731102\u0001armurier
731103\u0001blocator, chituitor, deblocator
731104\u0001ceasornicar
731105\u0001centrator, debordator piese optice
731106\u0001centrator, finisor aparate optice
731107\u0001degresator, curățător piese și aparate optice
731108\u0001lipitor lentile și prisme
731109\u0001montator aparatură optică
731110\u0001optician
731111\u0001optician armament
731112\u0001confecționer seringi
731113\u0001presator piese optice
731114\u0001reparator aparate foto
731115\u0001reparator stilouri, brichete
731116\u0001reparator umbrele
731117\u0001gravor piese optice
731118\u0001tratamentist piese optice
731119\u0001metrolog și depanator mecanică fină, tehnică digitală și analogică (MFTDA)
731120\u0001metrolog verificator
731201\u0001acordor acordeoane, armonici
731202\u0001acordor piane, pianine, orgă, țambal
731205\u0001constructor claviatură
731206\u0001constructor-reparator de acordeoane și armonici
731207\u0001constructor-reparator de alte instrumente muzicale (suflat, percuție)
731208\u0001filator corzi pentru piane
731209\u0001montator corp sonor la piane
731210\u0001montator-reglor piane
731211\u0001montator-ajustor de acordeoane
731212\u0001lutier
731213\u0001constructor restaurator de orgi
731301\u0001argintar
731302\u0001bijutier metale prețioase
731303\u0001cizelator
731304\u0001cizelator clișee galvanice
731305\u0001confecționer ștampile de cauciuc, metal, facsimile
731306\u0001gravor manual
731307\u0001țintuitor
731308\u0001bijutier metale comune
731309\u0001giuvaergiu
731310\u0001șlefuitor diamante naturale
731311\u0001maistru bijutier
731401\u0001aplicator de detalii la produse din ceramică
731402\u0001debavurator-retușor la produse din ceramică fină
731403\u0001turnător produse ceramice
731404\u0001fasonator produse ceramice
731405\u0001glazurator produse din ceramică fină
731406\u0001modelator ceramică
731407\u0001olar ceramică (artizanat)
731408\u0001preparator mase ceramice
731409\u0001presator produse ceramice
731411\u0001șlefuitor produse din ceramică fină
731501\u0001brigadier la fabricarea sticlei
731502\u0001modelator tuburi spectrale
731503\u0001trăgător, șlefuitor, gradator nivele
731504\u0001prelucrător topitură sticlă la presă
731505\u0001prelucrător topitură sticlă la țeavă
731601\u0001pictor decor
731602\u0001gradator vase și aparate de laborator
731603\u0001gravor produse de sticlă
731604\u0001inscripționer pe produse de sticlă și ceramică
731605\u0001pictor pe sticlă și ceramică
731606\u0001oglindar
731607\u0001emailator manual/artizan
731701\u0001confecționer piese, linguri, spițe, albii, donițe, cozi de unelte, șindrilă, ciubere
731702\u0001confecționer jucării
731703\u0001confecționer obiecte artizanale din lemn
731704\u0001confecționer plute
731705\u0001confecționer garnituri pentru etanșare
731706\u0001pirogravor
731707\u0001rămar poleitor
731708\u0001sculptor în lemn
731709\u0001confecționer cretă școlară
731710\u0001traforator manual lemn
731711\u0001dogar manual
731712\u0001rotar caretaș
731713\u0001lumânărar
731714\u0001confecționer cuțite, brice, brățări, andrele, agrafe, inele
731715\u0001confecționer nasturi, piepteni
731716\u0001confecționer obiecte casnice din deșeuri de aluminiu și alte metale
731717\u0001confecționer obiecte din ipsos
731718\u0001confecționer obiecte din os, scoică, mică etc.
731719\u0001confecționer corzi din intestine
731720\u0001încadrator tablouri
731721\u0001confecționer materiale didactice pentru științele naturii
731722\u0001confecționer bidinele, pensule, perii
731723\u0001confecționer mături
731724\u0001împletitor de nuiele
731725\u0001împletitor obiecte din foi de porumb
731726\u0001împletitor papură
731727\u0001legător de păr
731728\u0001sortator, spălător păr
731729\u0001prelucrător de păr la mașină
731730\u0001prelucrător manual de păr
731731\u0001împletitor din panglică împletită
731732\u0001pieptănător de păr la mașină
731733\u0001fierbător-uscător de păr
731801\u0001confecționer plase pescărești
731802\u0001confecționer articole hârtie
731803\u0001confecționer bibelouri din Jenille
731804\u0001decorator în piele
731805\u0001velator-matisor
731806\u0001confecționer manual de produse din sfori sau frânghii
731807\u0001ghemuitor
731808\u0001polierator frânghii
731809\u0001cablator frânghii
731810\u0001saluzitor frânghii
731811\u0001confecționer unelte pescuit din plase
731812\u0001confecționer îmbrăcare volane în piele
731813\u0001prelucrător de fulgi și pene
731814\u0001filator
731815\u0001ajutor maistru filator
731816\u0001țesător
731817\u0001tricoter manual
731818\u0001ajutor maistru țesător, tricoter
731819\u0001croșetor
731820\u0001împletitor textile
731821\u0001confecționer prețuri
731822\u0001țesător restaurator manual covoare
731823\u0001pregătitor și confecționer cataloage mostre
731824\u0001confecționer tricotaje după comandă
731825\u0001finisor textile (vopsitor, imprimeur)
731826\u0001repasator
731827\u0001aburitor textile
731828\u0001reparator covoare
731829\u0001țesător manual
731830\u0001cusător mănuși piele
731831\u0001croitor mănuși piele
731832\u0001finisor mănuși piele
731833\u0001croitor-ștanțator articole marochinărie
731834\u0001cusător articole marochinărie
731835\u0001pregătitor articole marochinărie
731836\u0001asamblator-montator articole marochinărie
731901\u0001confecționer manual în metaloplastie
731902\u0001confecționer proteze dentare
731903\u0001confecționer proteze ortopedice
731904\u0001confecționer jaluzele
731905\u0001împletitor fibre plastice
731906\u0001confecționer flori artificiale
732101\u0001culegător la mașina de cules și turnat rânduri (linotipist)
732102\u0001culegător la mașina de perforat programe pentru mașinile de turnat text (monotastor)
732103\u0001culegător la mașina de turnat rânduri pentru titluri (LUDLOV)
732104\u0001culegător manual (zețar)
732105\u0001frezor-montator clișee
732106\u0001stereotipar
732109\u0001zincograf
732110\u0001copist formare tipar plan
732111\u0001desenator cromolitograf
732112\u0001șlefuitor-granulator
732113\u0001gravor plăci metalice
732114\u0001gravor plăci litografice
732115\u0001fotogravor
732117\u0001manipulant cutter-plotter
732201\u0001tipograf turnător la mașinile de turnat text
732202\u0001imprimeur textil
732203\u0001imprimator serigraf
732204\u0001tăietor matrițe serigrafie
732205\u0001serigraf
732206\u0001operator presă de transfer termic
732207\u0001tipograf-tipăritor
732208\u0001dactilo-rotaprint
732209\u0001operator la mașina electronică de gravat
732210\u0001operator la mașinile de fotoculegere (monofoto)
732211\u0001operator tipărituri Braille
732212\u0001heliografist
732213\u0001operator xerox
732214\u0001operator mașini multiplicat
732215\u0001tipograf print digital și offset
732216\u0001operator la mașina de gravat și decupat cu laser
732217\u0001operator la mașina de tampografiat
732218\u0001tipograf flexograf
732301\u0001legător manual (în poligrafie și ateliere speciale)
732302\u0001colator publicitar
732303\u0001mașinist în legătorie mecanică
732304\u0001strungar șlefuitor tipografie
741101\u0001electrician în construcții
741102\u0001electrician de întreținere în construcții
741103\u0001instalator pentru sisteme fotovoltaice solare
741104\u0001instalator pentru sisteme termice solare
741105\u0001montator instalații solare
741106\u0001electrician constructor montator aparataj și cabluri de joasă tensiune
741107\u0001electrician constructor montator aparataj și cabluri de medie și înaltă tensiune
741108\u0001electrician constructor instalator aparatură de măsură și control
741109\u0001electrician constructor pentru probe și încercări funcționale
741110\u0001electrician în construcții civile și industriale
741201\u0001electrician echipamente electrice și energetice
741202\u0001bobinator aparataj electric
741203\u0001electromecanic reparator obiecte de uz casnic
741204\u0001bobinator mașini electrice rotative
741205\u0001electrician aparate măsură-control și automatizare în centrale termoelectrice și nuclearoelectrice
741206\u0001electrician montare și reparații aparataj electric de protecție, relee, automatizare
741207\u0001bobinator condensatori pentru instalații electrice
741208\u0001electrician verificări și măsurători electrice în centrale și rețele electrice
741209\u0001bobinator transformatoare
741210\u0001montator/ reglor/ depanator de aparataj electric
741211\u0001montator, reglor și depanator pentru aparate de măsură electrice și relee
741212\u0001montator, reglor și depanator de ascensoare
741213\u0001electrician nave
741214\u0001confecționer cablaje auto
741215\u0001electromecanic mașini și echipamente electrice
741216\u0001electromecanic stație pompare apă-canal
741301\u0001electrician exploatare centrale și stații electrice
741302\u0001electrician exploatare rețele electrice
741303\u0001electrician montare și reparații cabluri electrice subterane
741304\u0001electrician montare și reparații linii electrice aeriene
741305\u0001electrician montare și reparații echipament electric din centrale, stații și posturi de transformare electrice
741306\u0001electrician protecție relee, automatizări și măsurători electrice
741307\u0001electrician de întreținere și reparații
741308\u0001electrician montator de instalații automatizate
741309\u0001electrician montator de instalații electrice la mijloace de transport
741310\u0001electrician pentru protecția catodică
741311\u0001electrician rural
741312\u0001electrician de mină
741313\u0001electrician pentru utilizarea energiei electrice
741314\u0001electrician operator
742101\u0001electrician depanator utilaje calcul
742102\u0001electronist depanator utilaje calcul
742103\u0001plantator elemente electronice
742104\u0001operator in verificarea, întreținerea și repararea instalațiilor speciale de prevenire și stingere a incendiilor
742105\u0001tehnician pentru sisteme și instalații de semnalizare, alarmare și alertare în caz de incendiu
742106\u0001tehnician pentru sisteme și instalații de limitare și stingere a incendiilor
742201\u0001automatist
742202\u0001electromecanic SCB (semnalizare, centralizare, blocare)
742203\u0001electromecanic radio-radioficare
742204\u0001electromecanic rețele cabluri
742205\u0001electromecanic rețele linii
742206\u0001electromecanic telegrafie, telefonie
742207\u0001electronist telecomunicații
742208\u0001jonctor
742209\u0001linior
742210\u0001montator, reglor, testor aparatură de telecomunicații și instalații de semnalizare, centralizare și blocare
742211\u0001electromecanic electroalimentare
742212\u0001muncitor radioelectronist
742213\u0001electromecanic automatizări și telecomunicații
742214\u0001electromecanic
742215\u0001jonctor fibră optică
742216\u0001depanator telefoane mobile inteligente / tablete
751101\u0001carmangier
751102\u0001ciontolitor tranșator carne
751103\u0001măcelar
751104\u0001sterilizator
751105\u0001operator abatorizare păsări
751106\u0001lucrător la prelucrarea peștelui
751107\u0001afumător carne
751108\u0001operator prelucrare inițială a păsărilor
751109\u0001operator prelucrarea carcaselor de pasăre
751110\u0001operator sortare carcase de pasăre
751111\u0001operator tranșare carcase de pasăre
751201\u0001brutar
751202\u0001cofetar
751203\u0001patiser
751204\u0001preparator de semifabricate și preparate culinare
751205\u0001operator la fabricarea produselor congelate de patiserie și panificație
751206\u0001decorator produse cofetărie
751301\u0001pasteurizator produse lactate
751302\u0001preparator produse lactate
751303\u0001smântânitor
751401\u0001preparator conserve, legume și fructe
751402\u0001uscător-deshidrator legume, fructe
751403\u0001preparator castane, dovleac, porumb
751404\u0001lucrător în procesarea de fructe de pădure și ciuperci de pădure
751501\u0001degustător
751502\u0001degustător de cafea
751601\u0001condiționer tutun pentru fabricarea țigaretelor
752101\u0001vopsitor lemn
752102\u0001pregătitor paste chimice
752103\u0001pregătitor plăci fibrolemnoase și hârtie pentru filme
752104\u0001uscător, aburitor material lemnos
752201\u0001tâmplar universal
752202\u0001tâmplar carosier
752203\u0001tâmplar manual/ artizanal
752204\u0001marangoz-călăfătuitor
752205\u0001asamblator lăzi
752206\u0001confecționer-montator produse din lemn
752207\u0001curbător-montator butoaie din lemn
752208\u0001tâmplar manual la presare și încleiere
752209\u0001corhănitor
752210\u0001tâmplar manual ajustor montator
752211\u0001tâmplar manual la îmbinarea furnirelor
752212\u0001marangoz cală - tachelagiu
752213\u0001șlefuitor, lustruitor
752214\u0001pregătitor suprafețe pentru lăcuit
752215\u0001gardinator
752216\u0001confecționer-montator cercuri la butoaie
752217\u0001decupator lamele din lemn pentru lăzi
752218\u0001preparator-dozator adezive, rășini, lacuri și emailuri în industria lemnului
752219\u0001tâmplar restaurator
752220\u0001restaurator șarpante și structuri din lemn
752221\u0001tâmplar binale
752301\u0001strungar în lemn
752302\u0001reglor mașini de prelucrat lemn
752303\u0001tăietor de precizie în lemn
752304\u0001confecționer articole speciale din lemn
752305\u0001confecționer parchete
752306\u0001confecționer cutii chibrituri din furnir
752307\u0001impregnator-uscător chibrituri
752308\u0001confecționer gămălii chibrituri
752309\u0001mașinist la umplerea și închiderea cutiilor de chibrituri
752310\u0001pastator cutii chibrituri
752311\u0001fasonator calapoade
752312\u0001montator accesorii pentru calapoade
752313\u0001finisor calapoade
752314\u0001circularist la tăiat lemne de foc
752315\u0001curbător lemn
752316\u0001gradator rechizite și articole tehnice din lemn
752317\u0001tâmplar mecanic la croit și dimensionat
752318\u0001tâmplar mecanic la rindeluit
752319\u0001tâmplar mecanic la frezat și găurit
752320\u0001tâmplar mecanic la strunjit
752321\u0001tâmplar mecanic la șlefuit
752322\u0001confecționer mine pentru creioane
752323\u0001înnobilator scândurele pentru creioane
752324\u0001fasonator creioane și tocuri
752325\u0001finisor creioane și tocuri
752326\u0001preparator paste chimice pentru chibrituri
752327\u0001confecționer cutii de chibrituri din carton
752328\u0001operator la mașini unelte cu comandă numerică în prelucrarea lemnului
753101\u0001croitor
753102\u0001lenjer, confecționer lenjerie după comandă
753103\u0001confecționer pălării
753104\u0001ajutor maistru croitor
753105\u0001plior confecții
753106\u0001modistă
753107\u0001ceaprazar - șepcar
753108\u0001curățitor - reparator pălării
753109\u0001retușier confecții
753110\u0001blănar - confecționer îmbrăcăminte din blană, după comandă
753111\u0001confecționer îmbrăcăminte din piele și înlocuitori, după comandă
753112\u0001cojocar
753113\u0001confecționer, prelucrător în industria textilă
753114\u0001confecționer produse textile
753201\u0001croitor - confecționer îmbrăcăminte, după comandă
753202\u0001multiplicator șabloane croitorie
753203\u0001confecționer corsete
753204\u0001confecționer reparator cravate
753205\u0001planimetror șabloane
753206\u0001croitor confecționer costume teatru
753301\u0001broder manual
753302\u0001stopeur
753303\u0001remaieur ciorapi
753304\u0001broder manual - mecanic
753305\u0001broder la gherghef
753401\u0001tapițer
753402\u0001saltelar
753403\u0001plăpumar
753501\u0001meșteșugar argăsitor
753502\u0001meșteșugar cenușeritor
753503\u0001meșteșugar finisor mineral
753504\u0001meșteșugar finisor vegetal
753505\u0001meșteșugar sortator în industria pielăriei
753601\u0001cizmar - confecționer încălțăminte, după comandă
753602\u0001confecționer articole din piele și înlocuitori
753603\u0001confecționer încălțăminte ortopedică
753604\u0001curelar, confecționer harnașamente
753605\u0001marochiner - confecționer marochinărie, după comandă
753606\u0001opincar
753607\u0001tălpuitor (confecționer - reparații încălțăminte)
754101\u0001Scafandru autonom
754102\u0001scafandru cu alimentare de la suprafață până la 50 metri
754103\u0001scafandru șef grup
754104\u0001scafandru șef utilaj
754105\u0001scafandru cu alimentare de la suprafață până la 30 metri
754106\u0001operator barocameră
754107\u0001scafandru salvator
754108\u0001șef de scufundare
754109\u0001tehnician de scufundare
754110\u0001scafandru de mare adâncime
754201\u0001artificier de mină
754202\u0001artificier la lucrări de suprafață
754203\u0001pirotehnician cinematografie și teatru
754204\u0001pirotehnician
754301\u0001controlor calitate
811101\u0001miner în subteran
811102\u0001miner la suprafață
811103\u0001miner în subteran pentru construcții
811104\u0001mașinist pentru utilaje specifice la extracție și execuția tunelurilor
811105\u0001semnalist-cuplător
811106\u0001excavatorist pentru excavatoare cu rotor de mare capacitate
811107\u0001trolist
811201\u0001brichetator cărbune
811202\u0001distilator la prepararea cărbunelui
811203\u0001operator la prepararea minereurilor
811204\u0001operator la sfărâmarea minereurilor
811205\u0001prăjitor minereu
811206\u0001prelucrător mică
811207\u0001spălător la prepararea cărbunilor
811208\u0001flotator la prepararea cărbunilor
811209\u0001separator la prepararea cărbunilor
811210\u0001morar la mașini de mărunțit roci
811211\u0001tocător la mașini de mărunțit roci
811212\u0001concasorist
811213\u0001operator mineralurg
811301\u0001operator extracție țiței
811302\u0001sondor la foraj manual
811303\u0001operator-prospector lucrări geologice și geofizice
811304\u0001operator transport pe conducte singulare gaze
811305\u0001operator extracție gaze
811306\u0001operator extracție țiței în subteran
811307\u0001operator extracție sare în salină
811308\u0001operator măsurători speciale sonde
811309\u0001operator lucrări speciale sonde
811310\u0001sondor la forajul mecanizat și reparații sonde
811311\u0001sondor la intervenții de sonde
811312\u0001sondor la punerea în producție
811313\u0001primitor-preparator produse fluide
811314\u0001operator flotare produse fluide
811401\u0001cuptorar lianți
811403\u0001finisor produse din azbociment
811404\u0001morar lianți
811407\u0001operator la impregnarea produselor hidroizolatoare
811408\u0001mașinist pentru prefabricate din beton și beton armat
811409\u0001operator la fabricarea vatei și produselor din vată minerală
811411\u0001operator cameră comandă pentru fabrica de ciment
811412\u0001operator flux pentru fabrica de ciment
812101\u0001cocsar
812102\u0001furnalist
812103\u0001oțelar
812104\u0001pregătitor materiale de șarje
812105\u0001melanjorist
812106\u0001operator oxizi de plumb
812107\u0001dezbătător lingouri
812108\u0001metalurgist pulberi din oxid de fier
812109\u0001curățitor lingouri
812110\u0001preparator la concentratele miniere
812111\u0001topitor la concentrate miniere
812112\u0001rafinator metale neferoase
812113\u0001electrometalurgist
812114\u0001condiționer-finisor
812115\u0001turnător fontă
812116\u0001granulator zgură
812117\u0001epurator gaze
812118\u0001mașinist suflante
812119\u0001pregătitor de șarje
812120\u0001dozator la producerea aglomeratului
812121\u0001aglomeratorist
812122\u0001mașinist exhaustor
812123\u0001operator separare magnetică
812124\u0001laminator semifabricate, profiluri tablă și platbandă
812125\u0001laminator, presator țevi plumb
812126\u0001topitor, turnător metale prețioase
812127\u0001laminator sârmă
812128\u0001laminator tablă subțire
812129\u0001laminator de bandaje și discuri
812130\u0001laminator de țevi
812131\u0001laminator pe laminoare continue
812132\u0001laminator de benzi la rece
812133\u0001presator de țevi la cald și profiluri prin extruziune
812134\u0001alimentator-încălzitor de materiale
812135\u0001operator la cuptoare și instalații pentru turnarea și laminarea metalelor
812136\u0001laminator
812137\u0001termist-tratamentist de produse brute, forjate, turnate sau laminate
812138\u0001termist-tratamentist de piese semifabricate, finite
812139\u0001călitor prin inducție sau cu flacără
812140\u0001călitor scule
812141\u0001termist-tratamentist
812142\u0001operator la instalații de tratament termic cu procesare
812143\u0001operator la pregătirea șarjelor pentru tratament termic
812144\u0001finisor laminate și trefilate
812145\u0001decapator
812146\u0001regulator țevi
812147\u0001trefilator, trăgător
812201\u0001galvanizator
812202\u0001metalizator prin pulverizare
812203\u0001metalizator prin cufundare în metal topit
812204\u0001confecționer protecții și obiecte anticorozive
812205\u0001emailator
812206\u0001operator la confecționarea materialelor electroizolante
812207\u0001matisor cabluri
812208\u0001metalizator-termist
812209\u0001arzător email
812210\u0001emailator insigne și decorații
812211\u0001emailator firme și decoruri
812212\u0001emailator prin pudrare
812213\u0001emailator prin pulverizare
812214\u0001preparator email
812215\u0001emailator prin imersiune
812216\u0001acoperitor metale
812217\u0001poleitor filiere
812218\u0001protejator conductori cabluri și condensatori statici de forță
812219\u0001confecționer izolații la conductori electrici
812220\u0001confecționer mantale de plumb prin presare la cabluri
812221\u0001confecționer toroane și cablaje la conductori electrici
812222\u0001pregătitor seturi de cabluri electrice pentru autotrac și accesorii
812223\u0001preparator electrolit și amestec depolarizator
812224\u0001confecționer și legător depolarizator
812225\u0001asamblator elemente și baterii galvanice
812226\u0001confecționer de elemente galvanice
812227\u0001confecționer celule de electroliză
813101\u0001operator la mașini de măcinare fină (produse chimice)
813102\u0001operator la mașini de fragmentare (produse chimice)
813103\u0001operator la mașini de amestecare (produse chimice)
813104\u0001operator la instalații de ardere
813105\u0001uscător în industria chimică
813106\u0001preparator în industria chimică
813107\u0001sinterizator
813108\u0001operator la fabricarea sticlei
813109\u0001împâslitor pânză sticlă
813110\u0001filator fibre sticlă
813111\u0001preparator amestec și topitor sticlă
813112\u0001operator poliesteri armați cu fibră de sticlă
813113\u0001extractorist în chimie
813114\u0001fermentator în chimie
813115\u0001concentrator-purificator în chimie
813116\u0001extractorist uleiuri volatile naturale și colesterină
813117\u0001operator chimist la producerea compușilor organici ai sulfului și îngrășămintelor fosfatice
813118\u0001distilator în industria chimică
813119\u0001operator chimist la producerea diverselor produse anorganice
813120\u0001operator chimist la fabricarea lacurilor, vopselelor și uleiurilor
813121\u0001operator chimist la fabricarea coloranților
813122\u0001operator la obținerea produselor din spume poliuretanice și latex
813123\u0001operator chimist la producerea compușilor anorganici ai azotului și îngrășămintelor azotoase
813124\u0001operator lacuri electroizolante
813125\u0001preparator lacuri, vopsele, paste de fludor folosite la aparataj electric
813126\u0001operator chimist la chimizarea gazelor de rafinărie
813127\u0001operator cracare, deformare și fabricare bitum
813128\u0001operator chimist la fabricarea altor produse organice
813129\u0001operator chimist la chimizarea gazului de cocs
813130\u0001producător de fire și fibre sintetice
813131\u0001operator la fabricarea pieii sintetice
813134\u0001operator la fabricarea glicerinei și acizilor grași
813135\u0001operator la fabricarea săpunurilor
813136\u0001operator la produse odorante sintetice
813137\u0001operator la fabricarea detergenților
813138\u0001operator chimist la produsele farmaceutice și chimice pure
813139\u0001preparator benzi cauciucate și compoziții emplastre
813140\u0001preparator prafuri de spălat și curățat
813141\u0001preparator la prepararea produselor cosmetice și de parfumerie
813142\u0001preparator ser vaccin
813143\u0001condiționer finisor produse explozive
813144\u0001confecționer fitile
813145\u0001confecționer produse pirotehnice
813146\u0001nitrator
813147\u0001pregătitor la produse explozive
813148\u0001preparator la produse explozive
813149\u0001confecționer cartușe de vânătoare
813150\u0001operator la tragere și muniție
813151\u0001operator la pregătirea, conservarea și ambalarea armamentului și muniției
813152\u0001pregătitor, completator de echipamente tehnice și SDV-uri
813153\u0001delaborator muniție
813154\u0001operator la producerea sodei și produselor clorosodice
813155\u0001operator la fabricarea altor produse chimice
813201\u0001fotoceramist
813202\u0001fotocopist
813203\u0001fotopoligraf
813204\u0001fotoreproducător
813205\u0001montator filme
813206\u0001retușor clișee
813207\u0001pregătitor hârtie fotosensibilă
813208\u0001operator la fabricarea filmelor fotografice
814101\u0001preparator la confecționarea produselor industriale din cauciuc
814102\u0001pregnator prize tehnice și bandă izolatoare
814103\u0001confecționer de produse industriale din cauciuc
814104\u0001vulcanizator de produse industriale din cauciuc
814105\u0001finisor-reparator de produse industriale din cauciuc
814106\u0001operator la prelucrarea cauciucului
814107\u0001confecționer garnituri de etanșare din cauciuc
814108\u0001finisor încălțăminte și articole tehnice din cauciuc
814109\u0001calandror la finisarea cauciucului
814110\u0001pregătitor regenerare cauciuc
814111\u0001devulcanizator regenerare cauciuc
814112\u0001rafinator regenerare cauciuc
814113\u0001dozator prelucrare cauciuc
814114\u0001impregnator produse din cauciuc
814115\u0001profilator produse din cauciuc
814116\u0001ștanțator piese pentru încălțăminte din piele și cauciuc
814117\u0001cusător piese la încălțăminte din cauciuc
814118\u0001vulcanizator piese din cauciuc la prese
814119\u0001vulcanizator la autoclavă
814120\u0001preparator cauciuc electroizolant
814121\u0001vălțar cauciuc electroizolant
814122\u0001mașinist la confecționarea materialelor electroizolante impregnate
814123\u0001mașinist la confecționarea materialelor electroizolante stratificate (mică)
814124\u0001mașinist la confecționarea foliilor de cauciuc electroizolante
814125\u0001presator-formator materiale stratificate, pregnator prize tehnice și bandă izolatoare
814126\u0001condiționer-finisor produse din cauciuc
814127\u0001croitor pentru încălțăminte și articole tehnice din cauciuc
814128\u0001pregătitor pentru încălțăminte și articole tehnice din cauciuc
814129\u0001preparator plăci de etanșare comprimate
814130\u0001operator fabricarea și prelucrarea polimerilor
814201\u0001preparator mase plastice
814202\u0001vălțar calandru mase plastice
814203\u0001operator la prelucrarea maselor plastice
814204\u0001presator mase plastice
814205\u0001finisor-asamblator obiecte din mase plastice
814206\u0001creator, modelier mase plastice
814207\u0001operator la confecționarea discurilor fonografice
814208\u0001operator sudare țevi și fitinguri din polietilenă de înaltă densitate PEHD
814209\u0001operator mase plastice
814210\u0001operator mașini de termoformatare
814301\u0001cartonagist
814302\u0001operator la mașina de laminat
815111\u0001pregătitor amestecuri în filaturi
815112\u0001cardator
815113\u0001laminator benzi din fibre
815201\u0001operator la mașini de tricotat rectiliniu
815202\u0001operator la deservirea războaielor de țesut
815204\u0001operator la mașini de tricotat circular
815205\u0001operator sculuitor
815207\u0001operator la mașini de urzit
815208\u0001operator încheietor fire
815209\u0001operator năvăditor, lipitor, înnodător fire
815210\u0001operator bobinator-dublator
815211\u0001operator batirator fire
815212\u0001operator răsucitor fire
815301\u0001operator confecționer industrial îmbrăcăminte din țesături, tricotaje, materiale sintetice
815302\u0001operator confecții îmbrăcăminte din piele și înlocuitori
815303\u0001operator la confecționarea industrială a îmbrăcămintei din blană
815304\u0001operator la confecționarea industrială a mănușilor din piele
815305\u0001încadrator confecții
815306\u0001rihtuitor confecții
815307\u0001pregătitor-lansator confecții
815308\u0001șpănuitor confecții
815309\u0001tăietor confecții
815401\u0001operator gazator textile
815402\u0001operator descleietor textile
815403\u0001operator degamator textile
815404\u0001operator spălător textile
815405\u0001operator albitor textile
815406\u0001operator fierbător textile
815407\u0001operator mercerizator textile
815408\u0001operator pregătitor chimicale în industria textilă
815409\u0001operator vopsitor textile
815410\u0001operator imprimeur textile
815411\u0001confecționer șabloane și cilindri de imprimat
815412\u0001operator apretor textile
815413\u0001operator calandor-govrator textile
815414\u0001operator impregnator textile
815415\u0001operator decator
815416\u0001operator presator țesături textile (storcător textile)
815417\u0001operator fixator textile
815420\u0001operator tunsător textile
815421\u0001operator curățitor chimic
815422\u0001operator metrar-volator-dublator textile
815423\u0001operator tăietor textile
815424\u0001operator uscător textile
815425\u0001operator îngreunător mătase naturală
815428\u0001confecționer șabloane la imprimerie
815430\u0001operator universal - spălător textile și curățitor chimic
815501\u0001operator cenușeritor
815502\u0001operator tăbăcitor mineral argăsitor
815503\u0001operator tăbăcitor vegetal
815504\u0001operator finisor mineral
815505\u0001operator finisor vegetal
815506\u0001operator argăsitor
815507\u0001operator sortator în industria pielăriei
815508\u0001vopsitor îmbrăcăminte din blană
815601\u0001operator la prepararea tălpii de încălțăminte din fibre
815602\u0001operator la confecționarea industrială a articolelor din cauciuc și textile cauciucate
815603\u0001croitor-ștanțator piese încălțăminte
815604\u0001pregătitor piese încălțăminte
815605\u0001cusător piese din piele și înlocuitori
815606\u0001trăgător fețe pe calapod
815607\u0001tălpuitor industrial
815608\u0001finisor încălțăminte
815901\u0001operator la confecționarea industrială a pălăriilor
815902\u0001croitor confecții industriale din blană
815903\u0001operator la confecționarea industrială a articolelor de sport și protecție, din piele și înlocuitori
815904\u0001cusător confecții industriale din blană
815905\u0001pregătitor confecții industriale din blană
815906\u0001finisor confecții industriale din blană
815907\u0001operator textile nețesute
816001\u0001operator la prepararea conservelor din carne, pește și în amestec legume și pește
816002\u0001operator la valorificarea subproduselor de abator
816003\u0001tripier
816004\u0001preparator pește, raci, broaște în cherhanale și oficii
816005\u0001preparator făină din pește
816006\u0001topitor grăsimi comestibile și de uz industrial
816007\u0001operator la fabricarea mezelurilor
816010\u0001colector și preparator făină, sânge, carne, oase
816011\u0001curățitor piei
816014\u0001mățar
816015\u0001operator la prepararea brânzeturilor
816016\u0001operator la prepararea produselor lactate
816017\u0001operator centru de răcire lapte
816018\u0001operator la fabricarea untului
816019\u0001preparator conserve lapte și lactoză
816020\u0001morar
816021\u0001operator la fabricarea nutrețurilor combinate
816022\u0001preparator boia de ardei
816023\u0001preparator muștar
816024\u0001preparator extracte, arome și esențe
816025\u0001decorticator crupe
816026\u0001operator la prepararea produselor zaharoase
816027\u0001operator la fabricarea produselor făinoase
816028\u0001preparator înghețată
816029\u0001operator la fabricarea biscuiților
816030\u0001preparator napolitane
816031\u0001operator la fabricarea uleiurilor vegetale
816032\u0001operator la fabricarea conservelor din legume sau fructe
816033\u0001operator la fabricarea zahărului
816034\u0001condiționer miere
816035\u0001preparator de produse apicole
816036\u0001preparator surogate cafea
816037\u0001operator la condiționarea și prelucrarea plantelor medicinale
816038\u0001operator la fermentarea tutunului și fabricarea produselor din tutun
816039\u0001preparator halva
816040\u0001operator la prepararea băuturilor alcoolice și răcoritoare
816041\u0001operator la fabricarea berii
816042\u0001operator la fabricarea malțului
816043\u0001operator la fabricarea spirtului și drojdiei de panificație
816044\u0001vinificator-pivnicer
816045\u0001fermentator oțet
816046\u0001operator la fabricarea glucozei
816047\u0001preparator băuturi răcoritoare
816048\u0001preparator rachiuri industriale și lichioruri
816049\u0001distilator rachiuri naturale
816050\u0001operator la fabricarea amidonului și dextrinei
816051\u0001preparator coniac
816052\u0001preparator vermut
816053\u0001preparator șampanie
816054\u0001operator prelucrare cafea
816055\u0001operator măcinare cafea
817101\u0001pregătitor lemn, stuf, paie
817102\u0001preparator pastă
817103\u0001fierbător-spălător celuloză, hârtie
817104\u0001albitor pastă hârtie
817105\u0001confecționer tambur filigranare
817106\u0001mașinist la deshidratare pastă hârtie
817107\u0001finisor hârtie, carton, mucava
817108\u0001confecționer produse igienico-sanitare
817201\u0001confecționer rondele din plută
817202\u0001confecționer bastoane din plută
817203\u0001confecționer colaci și centuri de salvare
817204\u0001mașinist la mașina de tăiat șraifuri și dopuri din plută
817205\u0001mașinist la mașina de zdrobit și măcinat plută
817206\u0001confecționer plăci izolatoare
817207\u0001aburitor plută
817208\u0001pregătitor lemn așchietor
817209\u0001pregătitor așchii
817210\u0001încleietor plăci aglomerate
817211\u0001formator presator plăci brute
817212\u0001formator finisor plăci
817213\u0001tocatorist-defibratorist
817215\u0001presator PFL
817216\u0001tratamentist PFL
817217\u0001formator PFL
817218\u0001impregnator la înnobilare PFL
817219\u0001fasonator-sortator filme
817220\u0001presator la înnobilare PFL
817221\u0001formator la înnobilare PFL
817222\u0001finisor la înnobilare PFL
817223\u0001pregătitor PFL și hârtie pentru filme
817224\u0001gaterist la tăiat bușteni
817225\u0001tăietor la ferăstrău panglică
817226\u0001fasonator cherestea
817227\u0001desenator-însemnator cherestea
817228\u0001decupator furnire
817229\u0001derulatorist
817230\u0001fasonator-uscător furnire
817231\u0001frezor-îmbinător furnire tehnice
817232\u0001presator produse stratificate
817233\u0001formator șlefuitor produse stratificate
817234\u0001preparator PPF
817235\u0001miezuitor panele și plăci celulare
817236\u0001operator la recoltarea și toaletarea arborilor forestieri
818101\u0001topitor sticlă
818102\u0001prelucrător de topituri la semiautomate
818103\u0001prelucrător de topituri la instalații de tras țevi
818104\u0001prelucrător de tuburi și baghete
818105\u0001cuptorar recoacere sticlă
818106\u0001confecționer termosuri
818107\u0001tăietor produse din sticlă
818108\u0001șlefuitor produse din sticlă
818109\u0001arzător produse din sticlă
818110\u0001sablator produse din sticlă
818111\u0001argintar produse din sticlă
818112\u0001operator la instalații automate pentru prepararea amestecului
818113\u0001operator la instalații automate pentru prelucrarea topiturii de sticlă
818114\u0001operator la prelucrarea tuburilor din sticlă
818115\u0001operator la mașini de inscripționat
818116\u0001prelucrător fire și țesături din fire de sticlă
818117\u0001operator la instalații de tras și laminat geam
818118\u0001turnător geam
818119\u0001preparator vată de sticlă
818120\u0001tăietor geam
818121\u0001șlefuitor/ sablator geam
818122\u0001securizator geam
818123\u0001pregătitor de materii prime pentru producerea sticlei
818124\u0001strungar produse ceramice
818125\u0001cuptorar ceramică fină și decor
818126\u0001arzător produse ceramice
818127\u0001operator la fabricarea produselor refractare
818128\u0001operator la fabricarea produselor abrazive
818129\u0001operator la fabricarea produselor din cărbune
818130\u0001operator abrazive pe suporți
818131\u0001finisor produse abrazive
818132\u0001granulator/ sortator abrazive
818133\u0001cuptorar produse abrazive
818134\u0001preparator-presator abrazive
818135\u0001cuptorar produse refractare
818136\u0001formator produse refractare
818137\u0001preparator-presator produse din cărbune
818138\u0001cuptorar produse din cărbune
818139\u0001finisor produse din cărbune
818140\u0001prelucrător produse ceramice prin extrudare
818141\u0001discuitor de produse ceramice la mașini
818142\u0001prelucrător produse ceramice prin injectare
818143\u0001armator de izolatori electrici (prelucrător produse electrotehnice)
818201\u0001fochist locomotivă cu abur
818202\u0001fochist la mașini cu abur
818203\u0001mașinist la instalații pentru încălzit tren
818204\u0001fochist pentru cazane de abur și de apă fierbinte
818205\u0001ajutor fochist
818206\u0001fochist pentru cazane mici de abur
818207\u0001fochist la cazane de apă caldă și cazane de abur de joasă presiune
818208\u0001fochist pentru cazane conduse de calculator
818301\u0001mașinist la mașini de ambalat
818302\u0001operator la mașina de etichetat
818303\u0001operator mașini însăcuire pentru fabrica de ciment
818304\u0001operator mașini paletizate și înfoliere pentru fabrica de ciment
818305\u0001operator umplere recipiente GPL
818306\u0001îmbuteliator fluide sub presiune
818307\u0001operator platformă logistică
818901\u0001operator la roboți industriali
818902\u0001operator la tratarea și epurarea apelor uzate
818903\u0001operator instalație de sortare și reciclare deșeuri menajere și asimilabile
818904\u0001operator generatoare terestre sonice și cu agent activ de însămânțare
818905\u0001operator punct de lansare
818906\u0001pompagiu
818907\u0001compresorist
818908\u0001operator montaj linii automate
821101\u0001lăcătuș montator pentru utilaje industriale, de construcții și agricole
821102\u0001pregătitor și montator utilaje tehnologice
821103\u0001montator subansamble
821104\u0001montator aparate aer condiționat
821105\u0001operator calitate flux
821106\u0001operator fabricație flux
821201\u0001lăcătuș-montator mașini electrice rotative, transformatoare și aparataj electric
821202\u0001confecționer protecție dielectrică pentru acumulatori
821203\u0001morar la prepararea materialelor pentru acumulatori
821204\u0001confecționer grătare și accesorii pentru acumulatori
821205\u0001confecționer plăci pentru acumulatori
821206\u0001preparator leșie pentru acumulatori
821207\u0001montator acumulatori
821208\u0001confecționer cabluri și arbori de cabluri
821209\u0001montator-reglor, depanator aparate electronice, telecomunicații, radio
821211\u0001montator-reglor, depanator de instalații de electronică și curenți purtători
821212\u0001montator-reglor, depanator de aparate radio și TV, redresoare și amplificatoare
821213\u0001confecționer piese radio și semiconductori
821214\u0001confecționer circuite integrate
821215\u0001confecționer scală radio
821216\u0001confecționer circuite imprimate
821217\u0001montator, reglor, testor tehnică de calcul
821218\u0001confecționer lămpi fluorescente
821219\u0001confecționer lămpi cu vapori de mercur
821220\u0001confecționer lămpi cu vapori de sodiu
821221\u0001confecționer becuri
821222\u0001montator electromecanic
821223\u0001montator, reglor și depanator de aparate și echipamente electronice
821901\u0001asamblor biciclete
821902\u0001asamblor jucării
821903\u0001asamblor articole de sport
821904\u0001operator la fabricarea fermoarelor
821905\u0001confecționer de bețe, lansete, mânere și dopuri pentru unelte de pescuit
821906\u0001confecționer-asamblor articole din lemn
821907\u0001confecționer-asamblor articole din carton
821908\u0001confecționer-asamblor articole din textile
821909\u0001montor articole din piele
831101\u0001mecanic locomotivă și automotor
831102\u0001mecanic ajutor locomotivă și automotor
831103\u0001conducător autodrezină
831104\u0001mecanic conducător vagon motor de rectificare a liniei aeriene
831105\u0001mecanic locomotivă și ramă electrică metrou
831106\u0001mecanic ajutor locomotivă și ramă electrică metrou
831201\u0001frânar
831202\u0001manevrant vagoane
831203\u0001șef manevră
831204\u0001acar
831205\u0001șef tren
831206\u0001paznic barieră
831207\u0001revizor ace
832101\u0001conducător de motocicletă
832102\u0001conducător de motoscuter
832201\u0001șofer de autoturisme și camionete
832202\u0001șofer autosanitară
832203\u0001șofer autoambulanță
832204\u0001pilot încercare auto
833101\u0001conducător auto transport rutier de persoane
833102\u0001conducător troleibuz
833103\u0001conducător tramvai (vatman)
833201\u0001conducător auto transport rutier de mărfuri
833202\u0001șofer transport valori bancare
833203\u0001lucrător operativ pentru autocontainere
833204\u0001conducător autospecială
833205\u0001camionagiu
834101\u0001tractorist
834102\u0001combiner agricol
834103\u0001motorist la motoagregate și mașini în silvicultură
834104\u0001mecanic de exploatare în cultură mare
834105\u0001mecanic de exploatare în zootehnie
834106\u0001operator la colectatul și manipulatul lemnului
834201\u0001mașinist la mașini pentru terasamente (ifronist)
834202\u0001mașinist la instalațiile de preparat și turnat beton și mixturi asfaltice
834203\u0001mașinist la mașini cale mecanizare ușoară și grea
834204\u0001operator la utilaje de foraj dirijat
834205\u0001operator la utilaje de reabilitări conducte subterane
834206\u0001operator la utilaje pentru subtraversări
834301\u0001macaragiu
834302\u0001mașinist pod rulant
834303\u0001funicularist
834304\u0001macaragiu macarale plutitoare
834305\u0001șofer automacaragiu
834306\u0001supraveghetor stație șenal navigabil
834307\u0001funicularist, funiculare pasagere
834308\u0001mecanizator (muncitor portuar)
834309\u0001liftier
834310\u0001docher
834311\u0001șef echipă docheri
834312\u0001docher instalații de încărcare/ descărcare la bordul navei și cheu
834313\u0001docher-amarator
834314\u0001docher-mecanizator
834315\u0001macaragiu portuar
834316\u0001operator la platforme pentru lucru la înălțime
834401\u0001mașinist la mașini mobile pentru transporturi interioare
834402\u0001mașinist la alte mașini fixe de transport pe orizontală și verticală
834403\u0001stivuitorist
834404\u0001tractorist portuar
834405\u0001conducător autotrailer
834406\u0001conducător autoîncărcător portuar
834407\u0001stivuitorist portuar
835001\u0001marinar, pilot naval, barjist
835002\u0001observator far maritim și stație semnal de ceață
835003\u0001marinar legător
835004\u0001conducător ambarcațiuni agrement pe ape interioare
835005\u0001pontonier feribot
835006\u0001servator far maritim și stație semnal de ceață
835007\u0001conducător de șalupă maritimă/ fluvială
835008\u0001timonier maritim/ fluvial
835009\u0001motopompist
911101\u0001menajeră
911201\u0001femeie de serviciu
911202\u0001îngrijitor spații hoteliere
911203\u0001lucrător room-service hotel
912101\u0001călcătoreasă lenjerie
912102\u0001curățătoreasă lenjerie
912103\u0001spălătoreasă lenjerie
912104\u0001spălător covoare înnodate
912201\u0001spălător vehicule
912301\u0001spălător vitrine și geamuri
921201\u0001îngrijitor animale
921301\u0001muncitor manipulare și pregătire furaje
921302\u0001muncitor necalificat în agricultură
921303\u0001văcar
921501\u0001îngrijitor pomi
921502\u0001muncitor necalificat în silvicultură
921503\u0001tăietor manual lemn de foc
921601\u0001muncitor necalificat în pescuit și vânătoare
921602\u0001muncitor piscicol
931101\u0001muncitor necalificat în mine și cariere
931102\u0001împingător vagoneți
931201\u0001lucrător la amenajarea terenurilor sportive (amenajator bază sportivă)
931202\u0001îngrijitor spații verzi
931203\u0001muncitor necalificat la întreținerea de drumuri, șosele, poduri, baraje
931204\u0001săpător manual
931301\u0001muncitor necalificat la demolarea clădirilor, căptușeli zidărie, plăci mozaic, faianță, gresie, parchet
931302\u0001muncitor necalificat la spargerea și tăierea materialelor de construcții
932101\u0001ambalator manual
932902\u0001marcator piese
932903\u0001muncitor necalificat la ambalarea produselor sub formă de praf și granule
932904\u0001muncitor necalificat la ambalarea produselor solide și semisolide
932905\u0001muncitor necalificat în industria confecțiilor
932906\u0001muncitor necalificat la asamblarea, montarea pieselor
932907\u0001lucrător sortator deșeuri reciclabile
932908\u0001îmbuteliator gaz petrol lichefiat
932909\u0001muncitor în activitatea de gospodărire a șpanului
932910\u0001umplutor sifoane
932911\u0001muncitor necalificat în metalurgie
933101\u0001cărăuș
933301\u0001încărcător-descărcător
933302\u0001legător de sarcină
933303\u0001manipulant mărfuri
933304\u0001operator transport și distribuire butelii de GPL
933305\u0001muncitor spălare și curățare cisterne
933306\u0001muncitor în serviciile de trafic aerian
941101\u0001ajutor bucătar
941201\u0001lucrător bucătărie (spălător vase mari)
951001\u0001lustragiu
951002\u0001spălător geamuri și parbrize
952001\u0001vânzător ambulant de produse nealimentare
952002\u0001vânzător de ziare
961101\u0001lucrător operativ pentru autocompactoare
961301\u0001lucrător pentru salubrizare căi publice
961302\u0001lucrător pentru salubrizare spații verzi
961303\u0001lucrător pentru salubrizare
961304\u0001lucrător utilaje specializate pentru salubrizare
962101\u0001curier
962102\u0001hamal
962103\u0001comisioner
962104\u0001distribuitor presă
962201\u0001îngrijitor câini în adăposturi
962202\u0001gropar
962203\u0001incinerator
962204\u0001prinzător câini
962205\u0001operator deratizare, dezinsecție, dezinfecție
962301\u0001cantaragiu
962302\u0001casier încasator
962303\u0001încasator și cititor contoare de energie electrică, gaze, apă
962401\u0001vidanjor-curățitor cana0le
962901\u0001model (învățământ)
962902\u0001gonaci
962903\u0001garderobier
962904\u0001ucenic
962905\u0001aprod
962906\u0001controlor poartă
962907\u0001paznic
962908\u0001plasator
962909\u0001portar
962911\u0001supraveghetor noapte (învățământ)
962912\u0001supraveghetor săli spectacole
962913\u0001supraveghetor hotel`;

export const NOMENCLATOR_COR: readonly CodCor[] = DATE_COR.split("\n")
  .filter((linie) => linie.length > 0)
  .map((linie) => {
    const separator = linie.indexOf("\u0001");
    return { cod: linie.slice(0, separator), denumire: linie.slice(separator + 1) };
  });

/** Indexul pe cod, construit o singură dată — căutarea exactă e O(1). */
const PE_COD: ReadonlyMap<string, CodCor> = new Map(NOMENCLATOR_COR.map((o) => [o.cod, o]));

export function ocupatiaDupaCod(cod: string): CodCor | null {
  return PE_COD.get(cod.trim()) ?? null;
}

export function codCorExista(cod: string): boolean {
  return PE_COD.has(cod.trim());
}

/**
 * Normalizare pentru căutare: fără diacritice, fără majuscule.
 *
 * Se aplică AMBELOR părți. Cine tastează „ingrijitor" trebuie să găsească
 * „îngrijitor clădiri"; fără normalizare, căutarea întoarce zero rezultate și
 * omul crede că ocupația nu există. `ș`/`ț` cu sedilă se tratează la fel ca
 * cele cu virgulă — sursa oficială le amestecă.
 */

/** Indexul de căutare, normalizat o dată — altfel s-ar renormaliza 4422 de denumiri la fiecare tastă. */
const NORMALIZAT: readonly string[] = NOMENCLATOR_COR.map((o) => cheieCautare(o.denumire));

export function cautaOcupatii(interogare: string, limita = 25): readonly CodCor[] {
  const q = cheieCautare(interogare.trim());
  if (q.length < 2) return [];
  const rezultate: CodCor[] = [];

  // Cifrele caută un COD, nu o denumire care le conține întâmplător.
  if (/^\d+$/u.test(q)) {
    for (const ocupatie of NOMENCLATOR_COR) {
      if (ocupatie.cod.startsWith(q)) {
        rezultate.push(ocupatie);
        if (rezultate.length >= limita) return rezultate;
      }
    }
    return rezultate;
  }

  for (let i = 0; i < NOMENCLATOR_COR.length; i += 1) {
    const normalizat = NORMALIZAT[i];
    const ocupatie = NOMENCLATOR_COR[i];
    if (normalizat === undefined || ocupatie === undefined) continue;
    if (normalizat.includes(q)) {
      rezultate.push(ocupatie);
      if (rezultate.length >= limita) return rezultate;
    }
  }
  return rezultate;
}
