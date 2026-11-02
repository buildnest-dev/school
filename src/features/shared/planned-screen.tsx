import { Construction } from "lucide-react";
import { PageHeader } from "@/components/shared/blocks";
import { Card } from "@/components/ui/card";
import type { ScreenDef } from "@/config/screens";

/** Honest placeholder for screens in the inventory that are not built yet. */
export function PlannedScreen({ screen }: { screen: ScreenDef }) {
  return (
    <>
      <PageHeader title={screen.title} description={screen.description} />
      <Card className="max-w-xl">
        <div className="flex items-start gap-3">
          <Construction className="text-accent-ink mt-0.5 size-5 flex-none" aria-hidden="true" />
          <div>
            <p className="text-ink font-semibold">Planned, not built yet</p>
            <p className="text-muted mt-1 text-sm">
              This screen is in the screen inventory (docs/SCREEN_INVENTORY.md) and maps to section
              {screen.features.length > 1 ? "s" : ""} {screen.features.join(", ")} of the feature
              catalogue. It does not do anything yet.
            </p>
          </div>
        </div>
      </Card>
    </>
  );
}

export interface ScreenProps {
  screen: ScreenDef;
  params: Record<string, string>;
}
