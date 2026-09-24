import { MasterPage } from "@/components/master-page";
export const dynamic = "force-dynamic";
export default function Page(props: {
  searchParams: Promise<{ q?: string; offset?: string; active?: string }>;
}) {
  return <MasterPage entity="accounts" {...props} />;
}
