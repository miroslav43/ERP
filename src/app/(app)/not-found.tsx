// src/app/(app)/not-found.tsx
import { PaginaNegasita } from "@/components/feedback/pagina-negasita";

/**
 * 404-ul din interiorul aplicației (UX-043).
 *
 * Prinde orice `notFound()` aruncat sub layout-ul `(app)`: modulul dezactivat
 * (`requireFeature`, chemat de aproape toate paginile) și gărzile paginilor
 * `[id]` pe o fișă străină sau inexistentă. Fără el, toate cădeau în 404-ul
 * rădăcină, fără meniu și fără antet — utilizatorul pierdea contextul. Stând sub
 * layout, e randat cu bara laterală și cu antetul aplicației.
 *
 * Adresele fără nicio rută (`/ruta-inexistenta`) NU ajung aici: un grup de
 * rute nu se potrivește cu nimic, deci acelea merg în `src/app/not-found.tsx`.
 */
export default function NegasitApp() {
  return <PaginaNegasita inapoi={{ href: "/panou", eticheta: "Înapoi la panou" }} />;
}
