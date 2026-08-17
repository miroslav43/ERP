// src/components/layout/topbar.tsx
import type { AuthUser, OrgSummary, Tenant } from "@/lib/tenant/types";
import { OrgSwitcher } from "./org-switcher";
import { SidebarTrigger } from "./sidebar";
import { UserMenu } from "./user-menu";

export function Topbar({
  user,
  tenant,
  organizations,
}: {
  user: AuthUser;
  tenant: Tenant;
  organizations: readonly OrgSummary[];
}) {
  return (
    <header className="border-border bg-background sticky top-0 z-20 flex h-14 items-center gap-2 border-b px-3 md:px-6">
      <SidebarTrigger />
      <OrgSwitcher
        organizations={organizations}
        activeId={tenant.organizationId}
        activeName={tenant.name}
      />
      <div className="ml-auto">
        <UserMenu user={user} role={tenant.role} />
      </div>
    </header>
  );
}
