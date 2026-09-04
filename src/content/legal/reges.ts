import type { PaginaLege } from "./tipuri";

/**
 * Conținutul paginii `/reges-online`.
 *
 * ── DE CE MERITĂ PAGINĂ PROPRIE ───────────────────────────────────────────
 * Termenele din art. 5 al HG 295/2025 sunt împrăștiate pe litere care trimit la
 * art. 4 alin. (2), iar cine citește actul trebuie să sară înainte și înapoi ca
 * să afle un singur termen. Tabela de mai jos e actul citit o dată și pus cap la
 * cap — n-am găsit-o completă nicăieri, iar exact asta caută cineva la ora la
 * care descoperă că trebuia să transmită ceva ieri.
 *
 * ── AMENZILE: TREI FAPTE, NU UNA ──────────────────────────────────────────
 * Presa scrie de obicei o singură cifră, și de aceea circulă în paralel „20.000"
 * și „40.000" ca și cum una ar fi greșită. Sunt trei contravenții diferite:
 * netransmiterea în registru înainte de începerea activității (20.000 lei de
 * persoană, art. 260 alin. 1 lit. e¹, neschimbat), primirea la muncă fără niciun
 * contract (40.000 lei de persoană din decembrie 2025, lit. e), și cazul atenuat
 * din art. 9 alin. (2) lit. a) HG 295/2025 (3.000-5.000 lei). Pagina le desparte,
 * fiindcă alegerea uneia și tăcerea despre celelalte e chiar sursa confuziei.
 *
 * ── DE UNDE VIN TEXTELE ───────────────────────────────────────────────────
 * Forma consolidată a HG 295/2025 de pe Portalul Legislativ, plus actele
 * modificatoare citite direct: OUG 46/2025 (prorogarea la 31.12.2025), Legea
 * 88/2018, Legea 239/2025, OUG 32/2026.
 */

export const REGES: PaginaLege = {
  antet: {
    supratitlu: "Obligație legală",
    titlu: "REGES-ONLINE: termenele de transmitere și amenzile",
    lead: "Din 1 ianuarie 2026 registrul general de evidență a salariaților se ține exclusiv în REGES-ONLINE. Cele mai multe termene nu se măsoară în zile: sunt „cel târziu în ziua anterioară”.",
  },

  raspunsScurt: [
    "Registrul se ține potrivit HG nr. 295/2025, publicată în Monitorul Oficial nr. 279 din 31 martie 2025. Vechea reglementare, HG 905/2017, a fost abrogată la 31 decembrie 2025, după prorogarea adusă de OUG 46/2025 — deci REGES-ONLINE e registrul unic începând cu 1 ianuarie 2026.",
    "Regula pe care se greșește cel mai des: datele unui contract nou se transmit cel târziu în ziua anterioară începerii activității, nu în ziua în care omul vine la lucru. Netransmiterea se sancționează cu 20.000 de lei pentru fiecare persoană, plafonat la 200.000 de lei.",
    "Termenele exprimate în zile sunt întotdeauna zile lucrătoare. Sintagma „zile calendaristice” nu apare nicăieri în hotărâre.",
  ],

  titluReguli: "Termenele de transmitere, complet",

  reguli: [
    {
      situatie: "Contract nou",
      cerinta:
        "Datele angajatorului și ale salariatului, data încheierii și data începerii, funcția potrivit COR, tipul și durata contractului, locul de muncă, durata timpului de muncă, salariul cu sporurile și adaosurile — toate cel târziu în ziua anterioară începerii activității.",
      temei: "art. 5 alin. (1) lit. a) HG 295/2025",
    },
    {
      situatie: "Primul salariat al firmei",
      cerinta:
        "Angajatorul se înregistrează și transmite datele cel târziu în ziua anterioară începerii activității de către primul salariat.",
      temei: "art. 7 HG 295/2025",
    },
    {
      situatie: "Transfer",
      cerinta:
        "5 zile lucrătoare de la data transferului, respectiv de la data preluării prin transfer. E singurul termen de 5 zile din hotărâre.",
      temei: "art. 5 alin. (1) lit. b) HG 295/2025",
    },
    {
      situatie: "Detașare",
      cerinta:
        "Cel târziu în ziua anterioară datei de începere și, separat, datei de încetare a detașării. La fel pentru detașarea transnațională și pentru cea într-un stat din afara UE și SEE.",
      temei: "art. 5 alin. (1) lit. c) și d) HG 295/2025",
    },
    {
      situatie: "Suspendarea contractului",
      cerinta:
        "Cel târziu în ziua anterioară datei suspendării și a datei încetării ei. Trei excepții, cu 3 zile lucrătoare: concediul medical — de la înregistrarea certificatului la angajator; absențele nemotivate; forța majoră — de la data suspendării.",
      temei: "art. 5 alin. (1) lit. e) HG 295/2025",
    },
    {
      situatie: "Încetarea contractului",
      cerinta:
        "Cel târziu la data încetării, sau la data la care angajatorul a luat cunoștință de evenimentul care a determinat încetarea.",
      temei: "art. 5 alin. (1) lit. f) HG 295/2025",
    },
    {
      situatie: "Modificarea datelor salariatului",
      cerinta:
        "3 zile lucrătoare de la înregistrarea la angajator a documentului din care rezultă modificarea. Include gradul și tipul de handicap.",
      temei: "art. 5 alin. (2) HG 295/2025",
    },
    {
      situatie: "Modificarea funcției, a felului sau a duratei muncii",
      cerinta:
        "Cel târziu în ziua anterioară producerii modificării — funcție sau ocupație, tip de contract, durată, loc de muncă, durata timpului de muncă și repartizarea lui. Când modificarea vine dintr-o hotărâre judecătorească: 10 zile lucrătoare de la luarea la cunoștință a conținutului.",
      temei: "art. 5 alin. (3) HG 295/2025",
    },
    {
      situatie: "Modificarea salariului",
      cerinta:
        "20 de zile lucrătoare de la producerea modificării — salariul de bază lunar brut, indemnizațiile, sporurile și celelalte adaosuri. E cel mai lung termen din hotărâre și singurul de 20 de zile. Din hotărâre judecătorească: 10 zile lucrătoare.",
      temei: "art. 5 alin. (4) HG 295/2025",
    },
    {
      situatie: "Modificarea datelor angajatorului",
      cerinta: "3 zile lucrătoare de la producerea modificării.",
      temei: "art. 5 alin. (7) HG 295/2025",
    },
    {
      situatie: "Corectarea erorilor",
      cerinta: "La data la care angajatorul a luat cunoștință de ele.",
      temei: "art. 5 alin. (8) HG 295/2025",
    },
    {
      situatie: "Contract cu un prestator de servicii",
      cerinta:
        "3 zile lucrătoare de la încheierea, respectiv de la încetarea contractului prin care completarea registrului e delegată altcuiva.",
      temei: "art. 3 alin. (10) HG 295/2025",
    },
  ],

  amenzi: [
    {
      fapta:
        "Netransmiterea datelor contractului în registru, cel târziu în ziua anterioară începerii activității",
      suma: "20.000 lei",
      aplicare: "pentru fiecare persoană, plafon 200.000 lei",
      temei:
        "art. 9 alin. (1) HG 295/2025, care trimite la art. 260 alin. (1) lit. e¹) Codul muncii",
      nuConfunda:
        "Aici omul ARE contract; ce lipsește e transmiterea în registru. Cuantumul e cel din 2018 și nu a fost modificat de Legea 239/2025 — care a schimbat altă literă.",
    },
    {
      fapta: "Primirea la muncă fără încheierea unui contract individual de muncă",
      suma: "40.000 lei",
      aplicare: "pentru fiecare persoană, plafon 1.000.000 lei",
      temei: "art. 260 alin. (1) lit. e) Codul muncii, în forma dată de Legea 239/2025",
      nuConfunda:
        "Asta e fapta al cărei cuantum s-a dublat, de la 20.000 la 40.000 de lei, prin Legea 239/2025 (MO nr. 1160 din 15 decembrie 2025). Nu e aceeași cu netransmiterea în registru, deși cifrele circulă amestecat.",
    },
    {
      fapta:
        "Cazul atenuat: munca a fost prestată, salariul plătit și contractul declarat la ANAF în termen, dar transmiterea în registru a întârziat",
      suma: "3.000 – 5.000 lei",
      aplicare: "pentru fiecare persoană neînregistrată",
      temei: "art. 9 alin. (2) lit. a) HG 295/2025",
      nuConfunda:
        "Există și e rar invocată. Cele trei condiții sunt cumulative — lipsa oricăreia readuce fapta la amenda de 20.000 de lei.",
    },
    {
      fapta:
        "Netransmiterea modificărilor — salariu, timp de muncă, funcție, date ale angajatorului, suspendare, încetare, transfer",
      suma: "5.000 – 8.000 lei",
      temei: "art. 9 alin. (2) lit. b) și alin. (3) HG 295/2025",
    },
    {
      fapta: "Netransmiterea unei detașări, interne sau transnaționale",
      suma: "3.000 – 5.000 lei",
      aplicare: "pentru fiecare situație de detașare",
      temei: "art. 9 alin. (2) lit. c) și d) HG 295/2025",
    },
    {
      fapta: "Date eronate sau incomplete în registru",
      suma: "3.000 – 6.000 lei",
      temei: "art. 9 alin. (4) lit. a) HG 295/2025",
    },
    {
      fapta: "Nepăstrarea dosarului personal la sediu sau la sediul secundar",
      suma: "3.000 – 6.000 lei",
      temei: "art. 9 alin. (5) HG 295/2025",
    },
    {
      fapta:
        "Neeliberarea copiilor din dosarul personal, a adeverinței sau a extrasului din registru, în condițiile cerute",
      suma: "3.000 – 5.000 lei",
      temei: "art. 9 alin. (6) HG 295/2025",
    },
  ],

  sectiuni: [
    {
      titlu: "Dosarul personal și ce datorezi salariatului",
      paragrafe: [
        "Pentru fiecare salariat se întocmește un dosar personal, păstrat la sediul angajatorului sau la sediul secundar căruia i s-a delegat competența încadrării, și se prezintă inspectorilor la cerere. Dacă s-a folosit semnătura electronică avansată sau calificată, dosarul poate fi electronic, cu respectarea regulilor de arhivare — art. 8 alin. (1) și (2) HG 295/2025.",
        "Conținutul minim: actele necesare angajării, contractul, actele adiționale și celelalte acte de modificare, suspendare și încetare, actele de studii și certificatele de calificare, plus orice document care certifică legalitatea completărilor din registru.",
        "La cererea scrisă a unui salariat sau a unui fost salariat, copiile documentelor din dosar se eliberează în 15 zile lucrătoare, certificate pentru conformitate cu originalul. Același termen, de cel mult 15 zile lucrătoare, se aplică adeverinței cerute în scris — art. 8 alin. (4), (5) și (7).",
        "La încetarea activității, salariatul primește o adeverință cu activitatea desfășurată, durata, salariul, vechimea în muncă și în specialitate, plus un extras din registru certificat prin semnătură — art. 8 alin. (6).",
      ],
    },
    {
      titlu: "Ce se sancționa deja din 30 aprilie 2025",
      paragrafe: [
        "Hotărârea a intrat în vigoare la publicare, pe 31 martie 2025, dar art. 9 — articolul cu amenzile — și art. 11 alin. (3) și (4) au intrat în vigoare abia la 30 de zile de la publicare, adică pe 30 aprilie 2025. Termenul e scris în art. 14.",
        "Separat, art. 11 impunea două obligații cu termen 31 decembrie 2025, după prorogarea din OUG 46/2025: înregistrarea angajatorului în registru, sancționată cu 15.000-20.000 de lei, și migrarea contractelor active nepreluate din Revisal, sancționată cu 5.000-10.000 de lei.",
      ],
    },
    {
      titlu: "Ce nu ține de noi",
      paragrafe: [
        "Administrativo ține datele din care se completează registrul — contracte, funcții, timp de muncă, salarii, suspendări, încetări — și le arată la termen, cu istoricul modificărilor. Transmiterea propriu-zisă către REGES-ONLINE rămâne în platforma Inspecției Muncii, cu certificatul și cu persoana împuternicită de firmă.",
        "E o distincție pe care preferăm s-o facem noi, înainte s-o descoperi tu: cine îți promite „transmitere automată în REGES” descrie de obicei tot un export care se încarcă manual.",
      ],
    },
  ],

  nesigur: [
    {
      intrebare: "De când se aplică amenda de 40.000 de lei?",
      raspuns:
        "Legea 239/2025 a fost publicată în Monitorul Oficial nr. 1160 din 15 decembrie 2025 și nu conține o prevedere expresă de intrare în vigoare pentru articolul care schimbă cuantumul. După regula generală — a treia zi de la publicare, art. 78 din Constituție — data ar fi 18 decembrie 2025, iar Portalul Legislativ a consolidat Codul muncii chiar la acea dată. O parte din presa de specialitate scrie însă „de la 1 ianuarie 2026”. Nu am găsit un text care s-o spună explicit, așa că pagina asta spune „din decembrie 2025” și îți arată de unde vine incertitudinea.",
    },
    {
      intrebare: "E adevărat că hotărârea a fost anulată în instanță?",
      raspuns:
        "În mai 2026 s-a scris că o curte de apel a anulat integral HG 295/2025, în primă instanță, și că anterior o alta ar fi anulat doar art. 8 — articolul despre dosarul personal. Hotărârea nu e definitivă, cererea de suspendare a fost respinsă, iar actul continuă să producă efecte; Portalul Legislativ nu înregistrează nicio acțiune de anulare asupra lui. N-am putut verifica la sursă nici numărul dosarului, nici motivarea, așa că nu reproducem cifre. Consecința practică, azi: obligațiile și termenele de mai sus rămân în vigoare.",
    },
    {
      intrebare: "Peste cinci oameni fără contract înseamnă închisoare?",
      raspuns:
        "Nu, în dreptul actual. Circulă în presă, dar textul care prevedea infracțiunea — art. 264 alin. (4) din Codul muncii — este abrogat. Rămân penale refuzul de a prezenta documentele și împiedicarea accesului inspectorilor (art. 264 alin. 2 și 3), și reluarea activității după sistare fără achitarea amenzii și remedierea deficienței (art. 260 alin. 6).",
    },
  ],

  legaturaSecundara: { eticheta: "Ce se cere la un control ITM", href: "/ghid/control-itm" },

  actualizat: "septembrie 2026",
  actualizatIso: "2026-09-03",
};
