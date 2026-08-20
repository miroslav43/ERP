-- supabase/migrations/0039_feature_evaluari.sql
-- „Evaluări" ca modul opțional, nu sub `nucleu` (documentat explicit ca
-- „mereu activ, fără el nu există aplicație" — nepotrivit pentru un
-- sub-modul HR nou, opțional, exact ca attendance/leave/onboarding).

insert into public.features (feature_key, denumire, descriere, icon, grup, is_core, sort_order)
values (
  'evaluations', 'Evaluări angajați',
  'Evaluări de performanță pe șabloane reutilizabile, create de manageri sau administratori.',
  'clipboard-check', 'hr', false, 130
)
on conflict (feature_key) do nothing;
