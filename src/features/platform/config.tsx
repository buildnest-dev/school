"use client";

import { PageHeader } from "@/components/shared/blocks";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ErrorState, LoadingBlock } from "@/components/ui/states";
import { prettyKey } from "../shared/format";
import { useData } from "../shared/use-data";

interface Config {
  baseDomain: string;
  plans: { plan: string; schools: number }[];
  products: { key: string; name: string; status: string }[];
}

/** How the platform is set up. Read only: these values are changed in the hosting settings. */
export function PlatformConfig() {
  const d = useData<Config>("/platform/config", {
    baseDomain: "zaqsa.com",
    plans: [
      { plan: "trial", schools: 3 },
      { plan: "starter", schools: 4 },
      { plan: "growth", schools: 2 },
      { plan: "premium", schools: 1 },
    ],
    products: [{ key: "school", name: "School management", status: "available" }],
  });
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock rows={3} />;
  const c = d.data;
  const addresses = [
    ["Staff", `{school}.school.${c.baseDomain}`],
    ["Parents and students", `{school}.parents.${c.baseDomain}`],
    ["ZAQSA team", `team.schools.${c.baseDomain}`],
  ];
  return (
    <>
      <PageHeader
        title="Platform configuration"
        description="Addresses, plans and products. These are read only here."
      />
      <div className="grid items-start gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Site addresses" />
          <dl className="grid gap-3 text-sm">
            {addresses.map(([who, url]) => (
              <div key={who}>
                <dt className="text-muted">{who}</dt>
                <dd className="text-ink font-semibold break-all">{url}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <CardHeader title="Plans" hint="Schools on each plan" />
          <ul className="grid gap-2 text-sm">
            {c.plans.map((p) => (
              <li key={p.plan} className="flex justify-between">
                <span>{prettyKey(p.plan)}</span>
                <span className="text-ink font-semibold tabular-nums">{p.schools}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Products" />
          <ul className="grid gap-2 text-sm">
            {c.products.map((p) => (
              <li key={p.key} className="flex items-center justify-between gap-2">
                <span>{p.name}</span>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
