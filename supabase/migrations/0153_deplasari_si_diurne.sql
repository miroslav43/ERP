-- supabase/migrations/0153_deplasari_si_diurne.sql
--
-- Modulul `per_diem` se numește „Deplasări și diurne", nu „Diurne și deplasări".
-- Deplasarea e documentul de pornire; diurna e o sumă calculată din ea. Numele
-- din `src/config/features.ts` și din navigație s-a schimbat în același commit;
-- aici se aliniază catalogul din bază, citit de paginile super-admin.

update public.features
set denumire = 'Deplasări și diurne'
where feature_key = 'per_diem';
