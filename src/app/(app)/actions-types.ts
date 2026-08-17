/**
 * Tipurile și constantele acțiunilor din `(app)/actions.ts`.
 *
 * Fișier separat pentru că un modul marcat `'use server'` are voie să exporte
 * EXCLUSIV funcții async: orice altceva oprește build-ul cu
 * „A 'use server' file can only export async functions, found object".
 * Restricția este intenționată — tot ce exportă un astfel de modul devine un
 * punct de intrare apelabil din rețea, iar o constantă exportată acolo nu ar
 * avea ce semnificație să aibă.
 */

export type StareComutare = Readonly<{ eroare: string | null }>;

export const STARE_INITIALA_COMUTARE: StareComutare = { eroare: null };
