# Plan de implementare — flota

BAZA VERIFICATĂ: adm_p_oper (24 migrări, 103 tabele). Fiecare coloană de mai jos e citită cu \d, nu din memorie.

0. PRECONDIȚIE DE COMPILARE — src/config/permissions.ts
   Adaugă în PERMISSION_KEYS: "trip_sheets:create", "trip_sheets:update",
   "trip_sheets:approve", "vehicles:create". Există în seed (0002_authz.sql l.1133-1149,
   cross join resurse × ['read','create','update','delete','approve','export']), deci
   permissions.test.ts („cod ⊆ seed”) trece. FĂRĂ ele createAction NU compilează:
   ActionDefinition.permission e tipat cu uniunea închisă PermissionKey.

1. FIȘIERE
   src/schemas/fleet.ts                    — Zod: filtre + intrări de scriere
   src/lib/queries/fleet.ts                — TOATE citirile (interzis createAdminSupabase:
       eslint.config îl permite doar în src/**/actions.ts, src/app/api/**/route.ts, scripts/**)
   src/app/(app)/flota/{page,loading,error}.tsx + {etichete,erori,actions}.ts
                                           + {filtre-vehicule,nav-flota}.tsx
   src/app/(app)/flota/[id]/{page,loading,error}.tsx + {dialog-document-nou,dialog-document}.tsx
   src/app/(app)/flota/foi/{page,loading,error,filtre-foi}.tsx
   src/app/(app)/flota/foi/noua/{page,formular-foaie}.tsx
   src/app/(app)/flota/foi/[id]/{page,loading,error,actiuni-foaie,formular-alimentare}.tsx
   src/app/(app)/flota/aprobari/{page,loading,error,decizie-foaie}.tsx
   src/app/(app)/flota/anomalii/{page,loading,error,confirma-anomalie}.tsx
   REFOLOSEȘTE @/domain/fleet/kilometraj: verificaContinuitate(kmUltim,kmPlecare,kmSosire,pragSalt)
   → 'ok'|'regres'|'salt'; PRAG_SALT_KM_IMPLICIT = 1500 (= internal.flota_prag_salt_km()).

2. ECRANE, RUTE, PORȚI (requireFeature(tenant.organizationId,'fleet') PRIMUL pe fiecare)
   /flota                 lista vehiculelor. Poartă: can(p,'vehicles:read','own').
   /flota/[id]            fișa + documente + semafor. idDinRuta(id). can(p,'vehicles:read','own').
   /flota/[id]/documente/nou  adăugare + REÎNNOIRE. can(p,'vehicles:create','all').
   /flota/foi             foi de parcurs. can(p,'trip_sheets:read','own').
   /flota/foi/noua        can(p,'trip_sheets:create','own').
   /flota/foi/[id]        detaliu + alimentări. idDinRuta(id). can(p,'trip_sheets:read','own').
   /flota/aprobari        can(p,'trip_sheets:approve','team').
   /flota/anomalii        can(p,'vehicles:update','team').
   Fără poartă → <AccesRestrictionat mesaj="..."/>, NU 404 (404 e rezervat modulului inactiv).
   ATENȚIE: seedul dă vehicles:* și trip_sheets:create/update DOAR super_admin/org_admin.
   manager are trip_sheets:read/approve = team, dar NICIUN vehicles:*. employee are ZERO
   permisiuni de flotă. Ramurile 'own' din RLS există dar se activează doar prin
   suprascriere per organizație în role_permissions. Ecranele trebuie să arate corect
   AccesRestrictionat, nu tabel gol.

3. INTEROGĂRI (queries/fleet.ts) — nume reale, fără filtru de scope: RLS filtrează
   listeazaVehicule(orgId, filtre) → from('vehicles')
     .select('id, nr_inmatriculare, marca, model, categorie, tip_combustibil, an_fabricatie,
              km_curent, employee_id, department_id, status, prag_salt_km, data_iesire')
     .eq('organization_id',orgId).is('deleted_at',null)
     .order('nr_inmatriculare').order('id').limit(filtre.limita+1)
     filtre: .eq('status',…) / .eq('employee_id',…) / .eq('categorie',…) / .ilike('nr_inmatriculare',…)
     KEYSET: cursor (nr_inmatriculare,id) ASCENDENT (indexul vehicles_org_nr_uq).
     .or(`nr_inmatriculare.gt.${c.nr},and(nr_inmatriculare.eq.${c.nr},id.gt.${c.id})`)
     Separator cursor: SECVENȚA DE EVADARE \u0000 în sursă (ca în queries/leave.ts l.32/37).
   documenteCeleMaiApropiate(orgId, idVehicule) → from('vehicle_documents')
     .select('vehicle_id, document_type_id, expira_la, este_curent, numar')
     .in('vehicle_id',idVehicule).eq('este_curent',true).is('deleted_at',null)
     NU citi din `expirables` pentru semafor: politica expirabile_select cere ȘI
     app.poate_vedea_expirabil (vehicles:read≥team) ȘI compliance:read — pe care
     manager NU îl are. vehicle_documents e vizibil cu vehicles:read.
   citesteVehicul(orgId,id) → aceleași coloane + vin, culoare, capacitate_cilindrica,
     masa_maxima_kg, numar_locuri, consum_mediu_declarat, valoare_achizitie, data_achizitie,
     motiv_iesire, observatii, created_at. .maybeSingle() → null ⇒ notFound().
   documenteleVehiculului(vehId) → from('vehicle_documents').select('id, document_type_id,
     numar, emitent, valabil_de_la, expira_la, cost, fisier_path, fisier_nume, este_curent,
     observatii').eq('vehicle_id',vehId).is('deleted_at',null).order('expira_la',{ascending:false})
   tipuriDocument() → from('vehicle_document_types').select('id, cod, denumire, descriere,
     cere_expirare, obligatoriu, ordine').eq('activ',true).is('deleted_at',null).order('ordine')
     (rândurile de platformă au organization_id IS NULL și sunt vizibile tuturor;
      NU filtra .eq('organization_id',orgId) — ai pierde cele 11 tipuri implicite:
      itp, rca, casco, rovinieta, revizie, extinctor, trusa_medicala, licenta_transport,
      copie_conforma, tahograf, adr)
   listeazaFoi(orgId, filtre) → from('trip_sheets')
     .select('id, vehicle_id, employee_id, numar, plecare_la, sosire_la, km_plecare,
              km_sosire, km_parcursi, traseu, scop, status, trimis_la, aprobat_la')
     .eq('organization_id',orgId).is('deleted_at',null)
     .order('plecare_la',{ascending:false}).order('id',{ascending:false})
     KEYSET (plecare_la,id) DESC — index ts_status_idx / ts_vehicul_idx / ts_sofer_idx.
   ultimulKmAprobat(vehId) → from('trip_sheets').select('km_sosire')
     .eq('vehicle_id',vehId).eq('status','aprobat').not('km_sosire','is',null)
     .is('deleted_at',null).order('km_sosire',{ascending:false}).limit(1).maybeSingle()
     PREPOPULAREA: max(acest km_sosire, vehicles.km_curent) — exact ce face triggerul.
   alimentarileFoii(foaieId) → from('fuel_entries').select('id, litri, cost, pret_litru,
     statie, numar_bon, alimentat_la, plin, fisier_bon_path, observatii')
     .eq('trip_sheet_id',foaieId).is('deleted_at',null).order('alimentat_la')
   anomalii(orgId) → from('odometer_anomalies').select('id, vehicle_id, trip_sheet_id,
     km_asteptat, km_declarat, diferenta, tip, explicatie, confirmat_la, nota, created_at')
     .eq('organization_id',orgId).is('deleted_at',null).is('confirmat_la',null)
     .order('created_at',{ascending:false})
   deAprobat(orgId) = listeazaFoi cu .eq('status','trimis') (NU approval_tasks: foile de
     parcurs nu generează sarcini; internal.leave_requests_sincronizeaza le creează doar
     pentru entity_type='leave_request').

4. CE TRIMITE CLIENTUL LA SCRIERE ȘI CE NU
   NICIODATĂ: organization_id (ctx.tenant.organizationId, pus în handler), km_parcursi
     (GENERATED ALWAYS), pret_litru (GENERATED ALWAYS), diferenta (GENERATED ALWAYS).
   vehicles INSERT: created_by ȘI updated_by = ctx.user.id (WITH CHECK le cere explicit
     = auth.uid()); status trebuie 'activ', data_iesire/motiv_iesire NULL, deleted_at NULL.
     nr_inmatriculare se normalizează de trigger (upper + scoate non-alfanumerice) — nu
     preformata în client; vin idem. UPDATE: updated_by = ctx.user.id (WITH CHECK).
   vehicle_documents INSERT: NU trimite este_curent — internal.vdoc_inainte îl forțează
     la false, iar vdoc_dupa → flota_sincronizeaza_grup alege curentul = max(expira_la).
     Trimite created_by ȘI updated_by = ctx.user.id. REÎNNOIREA = un INSERT nou cu
     expira_la mai mare; NU face UPDATE pe cel vechi și NU-l șterge întâi (verificat pe
     adm_p_oper: RCA 2026-09-01 rămâne, RCA 2027-09-01 devine este_curent=true, iar
     expirables primește 2027-09-01 — un singur rând, kind='rca').
   trip_sheets INSERT: vehicle_id, employee_id, plecare_la, km_plecare, traseu, scop,
     observatii, created_by, updated_by. NU: status (WITH CHECK cere 'draft'), trimis_la,
     aprobat_de, aprobat_la, numar. km_plecare poate lipsi (NULL) — triggerul îl
     prepopulează din ultimul km cunoscut (verificat: 10000). Trimite-l totuși prepopulat
     din ultimulKmAprobat() ca omul să-l vadă înainte de salvare.
   trip_sheets TRIMITERE: doar {status:'trimis', km_sosire, sosire_la} — triggerul pune
     trimis_la. APROBARE: doar {status:'aprobat'} — triggerul pune aprobat_de = auth.uid()
     și aprobat_la. RESPINGERE: {status:'respins', motiv_respingere} (obligatoriu nevid).
     Tranziții permise: draft→trimis, trimis→{aprobat,respins,draft}, respins→draft.
   fuel_entries INSERT: trip_sheet_id, litri, cost, statie, numar_bon, alimentat_la, plin,
     fisier_bon_path, observatii, created_by, updated_by. Politica cere trip_sheets:update
     ≥ own (NU create). alimentat_la trebuie între plecare_la și sosire_la ale foii.
   odometer_anomalies: NICIODATĂ INSERT din client (politica cere app.is_service_context();
     le scrie triggerul foi_parcurs_dupa). UPDATE doar {confirmat_la: now, nota} — triggerul
     anomalii_protejeaza pune confirmat_de și refuză modificarea cifrelor constatate.

5. SERVER ACTIONS (src/app/(app)/flota/actions.ts, "use server")
   flota.vehicul.create      vehicles:create   all   revalidate ['/flota']
   flota.vehicul.update      vehicles:update   all   revalidate ['/flota','/flota/'+id]
   flota.document.adauga     vehicles:create   all   (ACOPERĂ ȘI REÎNNOIREA — un singur insert)
   flota.foaie.create        trip_sheets:create own  revalidate ['/flota/foi']
   flota.foaie.trimite       trip_sheets:update own
   flota.foaie.approve       trip_sheets:approve team revalidate ['/flota/foi','/flota/aprobari']
   flota.foaie.respinge      trip_sheets:approve team
   flota.alimentare.adauga   trip_sheets:update own
   flota.anomalie.confirma   vehicles:update   team  revalidate ['/flota/anomalii']
   minScope OBLIGATORIU la fiecare. audit.allow: liste explicite, fără fisier_path.

6. P0001 → ECRAN (src/app/(app)/flota/erori.ts, copie fidelă a concedii/erori.ts)
   export function traduEroare(error: PostgrestError): Error {
     switch (error.code) {
       case 'P0001': return businessRule(error.message.slice(0, 300));
       default: return error;
     }
   }
   Fiecare handler înfășoară scrierea: if (error !== null) throw traduEroare(error).
   Fără asta, mapPostgrestError transformă P0001 în „Operațiunea a fost respinsă de o
   regulă a sistemului” și omul nu află CE km trebuie corectat.
   Mesajele care ajung astfel la utilizator (verificate pe bază, textul e deja în română):
     regres: „Kilometrajul de plecare (9000 km) este mai mic decât ultimul kilometraj
       cunoscut al vehiculului (10000 km). Un odometru nu poate da înapoi: …”
     autoaprobare: „Nu vă puteți aproba propria foaie de parcurs. …”
     scope team fără subordonare: „Puteţi aproba doar foile de parcurs ale angajaţilor
       din subordinea dumneavoastră.”
     foaie aprobată atinsă: „Foaia de parcurs este aprobată. Pentru corecţii, stornaţi-o …”
     vehicul ieșit din parc, șofer din altă organizație, tip de document dezactivat,
     sosire ≤ plecare, alimentare în afara intervalului foii.
   NU rescrie aceste texte în sursă: în bază sunt cu SEDILĂ (ş/ţ), iar regula proiectului
   cere virgulă (ș/ț). Le propagi, nu le copiezi.
   SALTUL nu produce eroare: după insert, recitește anomaliile pentru foaia creată și afișează
   un avertisment („Diferență de N km față de ultimul kilometraj cunoscut”), nu o eroare.

7. STĂRI PE FIECARE ECRAN
   loading.tsx: <SkeletonTable rows={8} cols={6}/>. error.tsx: 'use client', buton „Reîncearcă”.
   Gol: <EmptyState icon={Car|ClipboardList|FileWarning} …/> cu acțiune concretă —
   /flota gol: „Niciun vehicul înregistrat” + acțiune „Adaugă vehicul”;
   /flota/foi gol: „Nicio foaie de parcurs” + „Foaie nouă”;
   filtre fără rezultat: mesaj DIFERIT — „Niciun rezultat pentru filtrele alese”, fără
   acțiune de creare;
   /flota/aprobari gol: „Nimic de aprobat” (stare bună, nu lipsă de date).
   Fișa vehiculului fără documente: listează tipurile obligatorii (obligatoriu=true) ca
   „lipsă” în semafor — roșu. Semafor din expira_la al documentului este_curent:
   expirat (<azi) roșu / ≤30 zile portocaliu / altfel verde / fără document gri.
   todayInBucharest() din @/lib/format/date, NU new Date().

8. FILTRE DIN URL — filtreDinUrl(filtreVehiculeSchema, parametri), NICIODATĂ .parse().
   Fiecare câmp opțional are .default(...) (altfel filtreDinUrl aruncă intenționat).
   limita: z.coerce.number().int().min(5).max(100).default(25).

9. CAPCANĂ DE AFIȘARE PE /flota/aprobari ȘI /flota/foi
   Un manager (trip_sheets:read=team) NU are vehicles:read, deci app.poate_vedea_vehicul
   întoarce false și embed-ul `vehicul:vehicles!vehicle_id(nr_inmatriculare)` vine NULL —
   fără eroare, doar gol. Afișează „—” și tipează câmpul `| null`. Nu compensa cu
   createAdminSupabase într-un fișier de queries: ESLint îl interzice acolo.
   Numele șoferului: employees se citește separat (.in('id', idAngajati)), coloana e
   full_name (GENERATED: last_name || ' ' || first_name) + marca — ca în concedii/page.tsx.
