// src/app/(portal)/portal/pontajul-meu/zi/[data]/loading.tsx
import { Schelet } from "@/components/ui/schelet";

/** Pagina zilei face trei interogări peste cele șase ale învelișului. */
export default function Incarcare() {
  return <Schelet forma="formular" randuri={3} />;
}
