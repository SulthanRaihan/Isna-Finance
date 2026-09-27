import { ReportScreen, type ReportSearch } from "@/components/report-screen";
export const dynamic = "force-dynamic";
export default async function RecapPage({
  searchParams,
}: {
  searchParams: Promise<ReportSearch>;
}) {
  return <ReportScreen recap search={await searchParams} />;
}
