import { notFound } from "next/navigation";
import { getInductionByEnrolToken } from "@/lib/queries";
import { InductionWizard } from "@/components/InductionWizard";

export const dynamic = "force-dynamic";

export default async function InductionPage({
  params,
}: {
  params: { token: string };
}) {
  const run = await getInductionByEnrolToken(params.token);
  if (!run) notFound();
  return <InductionWizard token={params.token} run={run} />;
}
