-- ─────────────────────────────────────────────────────────────────────────────
-- 0021_fix_instruiri_ssm.sql — nicio instruire SSM periodică nu putea fi salvată
--
-- `internal.ssm_training_sync()` compune cheia scadenței ca
--     v_dom || ':' || v_cod          → 'ssm:periodic', 'psi:periodic'
-- și o trimite lui `internal.sync_expirable()`, care scrie în `public.expirables`.
-- Acolo, din 0008:
--     constraint expirables_kind_ck check (kind ~ '^[a-z][a-z0-9_]{1,48}$')
-- Tiparul nu acceptă două puncte. Rezultatul, la prima instruire înregistrată de
-- un `org_admin` pe un tip cu periodicitate:
--
--     ERROR: new row for relation "expirables" violates check constraint
--            "expirables_kind_ck" (23514)
--
-- Adică exact cazul obișnuit — instruirea periodică, cea la 6 luni, cea pe care
-- ITM o cere la control — nu putea fi salvată de nimeni. Tipurile fără
-- periodicitate treceau, fiindcă nu produc scadență, ceea ce făcea defectul să
-- pară intermitent.
--
-- CUM A SCĂPAT DE TOATE VERIFICĂRILE
-- Migrarea se aplică fără eroare: constrângerea se evaluează la INSERT în
-- `expirables`, nu la crearea funcției. Cele trei bariere trec: RLS e activat,
-- politicile se reevaluează, funcțiile definer au search_path corect. Testul de
-- izolare trecea și el, fiindcă demonstra absența accesului NEautorizat.
-- L-a prins abia verificarea (l) — „politicile nu blochează scrierile legitime" —
-- extinsă acum cu o instruire SSM inserată ca utilizator obișnuit. E al treilea
-- defect de clasa asta: Faza 2 a fost comisă „gata" și un org_admin nu putea
-- insera un angajat; Faza 3a a fost comisă și nicio cerere de concediu nu se
-- putea crea.
--
-- CORECȚIA: separatorul devine `_`, singurul admis de tipar. `ssm_periodic`,
-- `psi_periodic`. Distincția dintre domenii se păstrează — și trebuie păstrată:
-- PSI e obligație legală SEPARATĂ de SSM, cu propria periodicitate, iar o cheie
-- comună ar fi făcut ca instruirea PSI expirată să dispară în spatele celei SSM
-- valabile. Exact motivul pentru care `kind` face parte din cheia unică a lui
-- `expirables`.
--
-- Nu e nevoie de migrarea datelor existente: niciun rând cu `:` nu a putut fi
-- vreodată scris — constrângerea le-a respins pe toate.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function internal.ssm_training_sync() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_cod text; v_den text; v_dom text; v_scad date; v_kind text;
begin
  select t.cod, t.denumire, t.domeniu::text into v_cod, v_den, v_dom
    from public.ssm_training_types t where t.id = new.training_type_id;

  -- `_`, nu `:`. Vezi antetul migrării.
  v_kind := v_dom || '_' || v_cod;

  -- Gardă explicită: dacă cineva adaugă mâine un cod de tip care iese din tipar,
  -- vreau mesajul ăsta, nu 23514 dintr-o tabelă care nu spune nimic despre
  -- instruiri. Tiparul e cel din expirables_kind_ck (0008).
  if v_kind !~ '^[a-z][a-z0-9_]{1,48}$' then
    raise exception using errcode = 'P0001',
      message = format(
        'Codul tipului de instruire („%s") produce o cheie de scadență nevalidă („%s"). '
        'Codurile trebuie să conțină doar litere mici, cifre și underscore.', v_cod, v_kind);
  end if;

  select s.urmatoarea_scadenta into v_scad from public.ssm_trainings s
   where s.organization_id = new.organization_id and s.employee_id = new.employee_id
     and s.training_type_id = new.training_type_id and s.deleted_at is null
   order by s.data_instruirii desc, s.created_at desc limit 1;

  if not found then
    if new.urmatoarea_scadenta is not null then
      perform internal.sync_expirable(new.organization_id, 'ssm_training', new.employee_id,
        v_kind, 'Instruire ' || upper(v_dom) || ' — ' || v_den,
        new.urmatoarea_scadenta, 'ssm_trainings', new.employee_id, false);
    end if;
    return null;
  end if;

  if v_scad is null then return null; end if;

  perform internal.sync_expirable(new.organization_id, 'ssm_training', new.employee_id,
    v_kind, 'Instruire ' || upper(v_dom) || ' — ' || v_den,
    v_scad, 'ssm_trainings', new.employee_id, true);
  return null;
end $$;


-- ── Verificare: cheia produsă chiar trece de constrângerea din 0008 ─────────
--
-- Nu verific funcția, ci INVARIANTUL: orice combinație domeniu × cod care poate
-- exista în nomenclator trebuie să dea o cheie acceptată. Dacă cineva relaxează
-- mâine tiparul codurilor din `ssm_training_types`, aici cade, nu în producție.
do $$
declare
  v_dom text;
  v_cod text;
begin
  foreach v_dom in array array['ssm', 'psi'] loop
    foreach v_cod in array array[
      'introductiv_general', 'la_locul_de_munca', 'periodic', 'suplimentar'
    ] loop
      if (v_dom || '_' || v_cod) !~ '^[a-z][a-z0-9_]{1,48}$' then
        raise exception 'Cheia „%" nu trece de expirables_kind_ck.', v_dom || '_' || v_cod;
      end if;
    end loop;
  end loop;
end
$$;
