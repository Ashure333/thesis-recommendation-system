// Placeholder only -- this page's design hasn't been provided yet.
// Once the recommendation pipelines are built, this is where the 6
// configurations get compared against your evaluation metrics.

import { PageHeader, PageShell, EmptyState } from "../../components/ui";

export default function Evaluation() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Evaluation"
        title="Recommendation evaluation"
        description="This route is reserved for the comparison of the study's recommendation configurations and evaluation metrics."
      />
      <EmptyState
        title="Evaluation design is not finalized."
        description="The current frontend keeps this route available without inventing metrics, charts, or results that are not yet implemented."
      />
    </PageShell>
  );
}
