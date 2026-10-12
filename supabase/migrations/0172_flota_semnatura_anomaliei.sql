-- supabase/migrations/0172_flota_semnatura_anomaliei.sql
--
-- SEMNĂTURA UNEI ANOMALII CONFIRMATE NU SE MAI POATE ȘTERGE CU UN UPDATE.
--
-- ── DE UNDE VINE ────────────────────────────────────────────────────────────
-- 0171 a închis rescrierea unei anomalii confirmate. Pentru ca ștergerea unui
-- cont din `auth.users` să nu fie blocată, a lăsat totuși `confirmat_de` să
-- devină NULL: FK-ul `on delete set null` (0012:288) execută un UPDATE care
-- trece prin `internal.anomalii_protejeaza`. Excepția era însă prea largă.
-- Orice rol cu `vehicles:update` pe echipă putea „dezsemna” o anomalie
-- confirmată cu un simplu
--     update odometer_anomalies set confirmat_de = null where id = …
-- iar rândul rămânea confirmat de nimeni. Semnalat de revizuirea de securitate
-- a commitului f8e3647.
--
-- ── CE SE SCHIMBĂ ───────────────────────────────────────────────────────────
-- Golirea semnatarului se acceptă DOAR când contul lui chiar nu mai există în
-- `auth.users`. Acțiunea referențială rulează după ștergerea rândului părinte,
-- deci verificarea îl vede deja dispărut. Un UPDATE obișnuit vede contul încă
-- acolo și e refuzat, ca orice altă rescriere a confirmării.
--
-- Tot aici: `confirmat_la` se pune din ceasul bazei la prima confirmare, nu
-- din payload. Altfel o confirmare se putea antedata.
--
-- Restul funcției e o COPIE a formei din 0171.
--
-- Forward-only: 0171 e deja pe main și aplicată pe staging, deci reparația
-- stă aici, nu în ea.

create or replace function internal.anomalii_protejeaza()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (old.organization_id, old.vehicle_id, old.trip_sheet_id, old.km_asteptat, old.km_declarat, old.tip)
     is distinct from
     (new.organization_id, new.vehicle_id, new.trip_sheet_id, new.km_asteptat, new.km_declarat, new.tip) then
    raise exception using errcode = 'P0001',
      message = 'Datele constatate ale anomaliei nu se pot modifica. Puteţi doar să o confirmaţi şi să adăugaţi o notă.';
  end if;
  -- 0171: confirmarea e o semnătură; după ea, momentul, nota și semnatarul nu
  -- se mai schimbă. Ștergerea logică rămâne posibilă.
  -- 0172: semnatarul poate deveni NULL doar dacă și-a pierdut contul — exact
  -- cazul FK-ului `on delete set null`, și numai el.
  if old.confirmat_la is not null
     and (
       (new.confirmat_la, new.nota) is distinct from (old.confirmat_la, old.nota)
       or (new.confirmat_de is distinct from old.confirmat_de
           and (new.confirmat_de is not null
                or exists (select 1 from auth.users u where u.id = old.confirmat_de)))
     ) then
    raise exception using errcode = 'P0001',
      message = 'Anomalia a fost deja confirmată. Confirmarea și nota ei nu se mai pot modifica.';
  end if;
  if new.confirmat_la is not null and old.confirmat_la is null then
    new.confirmat_de := coalesce((select auth.uid()), new.confirmat_de);
    -- 0172: momentul semnăturii e al bazei, nu al payload-ului. Altfel o
    -- confirmare s-ar putea antedata.
    if not app.is_service_context() then
      new.confirmat_la := now();
    end if;
  end if;
  -- Semnatarul nu vine din payload: fără confirmare, nu există.
  if new.confirmat_la is null then
    new.confirmat_de := null;
  end if;
  return new;
end;
$$;
