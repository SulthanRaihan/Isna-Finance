import { AppShell } from "@/components/app-shell";
import { WorkspaceHome } from "@/components/workspace-home";
import { requireOwner } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export default async function HomePage() {
  const owner = await requireOwner();
  return (
    <AppShell>
      <WorkspaceHome displayName={owner.display_name} />
    </AppShell>
  );
}
