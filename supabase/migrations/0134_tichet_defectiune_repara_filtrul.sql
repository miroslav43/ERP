-- supabase/migrations/0134_tichet_defectiune_repara_filtrul.sql
--
-- Repară tipul de tichet „defecțiune", care nu se putea crea DELOC.
--
-- ── CE ERA STRICAT ─────────────────────────────────────────────────────────
-- `internal.tickets_valideaza_inventarul` filtra obiectul de inventar așa:
--
--     from public.inventory_items i
--     where i.id = new.inventory_item_id and i.deleted_at is null
--
-- `public.inventory_items` NU ARE coloana `deleted_at`. Tabela nu folosește
-- ștergere logică: ciclul ei de viață stă în `status`, care are chiar valoarea
-- `casat` pentru obiectele scoase din uz. Interogarea cădea deci cu 42703
-- (`column i.deleted_at does not exist`) la fiecare execuție.
--
-- ── DE CE ERA MAI GRAV DECÂT PARE ──────────────────────────────────────────
-- Triggerul iese devreme când `inventory_item_id` e NULL, deci părea inofensiv.
-- Dar două constrângeri îl fac imposibil de ocolit tocmai pe tipul care are
-- nevoie de el:
--
--   · `tickets_defectiune_ck` — un tichet de tip `defectiune` TREBUIE să aibă
--     `inventory_item_id not null`;
--   · `tickets_inventar_ck`   — doar tipul `defectiune` POATE avea unul.
--
-- Rezultatul: fiecare tichet de defecțiune trecea obligatoriu prin ramura
-- ruptă. Categoria întreagă era imposibil de creat, pentru toate organizațiile,
-- din interfață ca și din API — nu doar în firma de demonstrație unde a fost
-- găsită.
--
-- ── DE CE N-A PRINS-O NIMENI ───────────────────────────────────────────────
-- O eroare de nume de coloană dintr-un corp `plpgsql` nu se vede la creare:
-- Postgres rezolvă identificatorii la EXECUȚIE, nu la definire. `tsc`, ESLint
-- și `pnpm test` nu ajung până aici, iar `plpgsql_check` — care exact asta
-- prinde — n-a mai rulat pe migrările de după 0006. Singurul martor ar fi fost
-- un tichet de defecțiune creat efectiv, iar tabela `tickets` era goală.
--
-- ── REPARAȚIA ──────────────────────────────────────────────────────────────
-- Se scoate predicatul imposibil. Restul funcției rămâne neatins, inclusiv al
-- doilea filtru pe `a.deleted_at`, care e CORECT: `inventory_allocations` chiar
-- are coloana.
--
-- Deliberat NU se adaugă un filtru pe `status <> 'casat'`. Ar fi o schimbare de
-- comportament, nu o reparație: dacă un obiect casat n-ar trebui să primească
-- sesizări noi, asta se decide separat, cu mesajul ei de eroare. Aici doar
-- restaurăm intenția scrisă — „obiectul trebuie să existe".

create or replace function internal.tickets_valideaza_inventarul()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alocat boolean;
  v_org_obiect uuid;
begin
  if new.inventory_item_id is null then
    return new;
  end if;

  -- Fără `deleted_at`: coloana nu există pe `inventory_items`, iar prezența ei
  -- aici rupea validarea cu 42703. Existența rândului e tot ce se verifică.
  select i.organization_id into v_org_obiect
  from public.inventory_items i
  where i.id = new.inventory_item_id;

  if v_org_obiect is null then
    raise exception using errcode = 'P0001',
      message = 'Obiectul de inventar selectat nu există.';
  end if;
  if v_org_obiect <> new.organization_id then
    raise exception using errcode = 'P0001',
      message = 'Obiectul de inventar aparține altei organizații.';
  end if;

  -- Alocare curentă = predată și nereturnată. Aici `deleted_at` E corect:
  -- `inventory_allocations` are coloana.
  select exists (
    select 1
    from public.inventory_allocations a
    where a.item_id = new.inventory_item_id
      and a.employee_id = new.solicitant_employee_id
      and a.returnat_la is null
      and a.deleted_at is null
  ) into v_alocat;

  if not v_alocat then
    raise exception using errcode = 'P0001',
      message = 'Obiectul de inventar nu este alocat solicitantului. Alegeți unul dintre obiectele primite.';
  end if;

  return new;
end;
$$;

-- Aceeași coadă ca în `0045_ticketing_it.sql:394`, care a creat funcția: e o
-- funcție de trigger `security definer`, deci nu se acordă nimănui — se
-- execută prin trigger, nu prin apel direct.
revoke all on function internal.tickets_valideaza_inventarul() from public, anon, authenticated;
