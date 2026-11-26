"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useAsync } from "@/hooks/use-async";
import { apiRequest } from "@/lib/api/client";
import type { Role } from "@/types";
import { ApiAction, QuickAdd, type QuickField } from "../shared/quick-add";

export const TRANSPORT_ROLES: readonly Role[] = ["school_owner", "principal", "transport"];

const VEHICLE_FIELDS: QuickField[] = [
  { key: "regNo", label: "Registration number", placeholder: "WB 12 AB 1234" },
  {
    key: "type",
    label: "Type",
    type: "select",
    options: [
      { value: "bus", label: "Bus" },
      { value: "van", label: "Van" },
    ],
  },
  { key: "capacity", label: "Seats", type: "number" },
  { key: "insuranceExpiry", label: "Insurance valid till", type: "date", required: false },
  { key: "fitnessExpiry", label: "Fitness valid till", type: "date", required: false },
];

export function AddVehicle({ onCreated }: { onCreated: () => void }) {
  return (
    <QuickAdd
      label="Add vehicle"
      title="Add a vehicle"
      endpoint="/transport/vehicles"
      fields={VEHICLE_FIELDS}
      onCreated={onCreated}
    />
  );
}

export function VehicleActions({ row, done }: { row: Record<string, unknown>; done: () => void }) {
  const path = `/transport/vehicles/${String(row.id)}`;
  const active = row.status !== "inactive";
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <QuickAdd
        label="Edit seats and papers"
        title={String(row.regNo)}
        method="PATCH"
        endpoint={path}
        fields={VEHICLE_FIELDS.filter((f) => f.key !== "regNo" && f.key !== "type")}
        values={{ capacity: String(row.capacity) }}
        onCreated={done}
      />
      <ApiAction
        label={active ? "Take out of service" : "Put back in service"}
        method="PATCH"
        endpoint={path}
        body={{ status: active ? "inactive" : "active" }}
        onDone={done}
      />
    </div>
  );
}

interface Option {
  value: string;
  label: string;
}

/** Vehicles and drivers to choose from. A role that cannot read the staff list gets no drivers. */
function useRouteChoices() {
  return useAsync(async () => {
    const [vehicles, drivers] = await Promise.all([
      apiRequest<{ items: { id: string; regNo: string; capacity: number }[] }>(
        "/transport/vehicles",
      ),
      apiRequest<{ items: { id: string; name: string }[] }>("/staff", {
        query: { role: "driver", status: "active" },
      }).catch(() => ({ items: [] })),
    ]);
    const none: Option = { value: "", label: "Not chosen" };
    return {
      vehicles: [
        none,
        ...vehicles.items.map((v) => ({ value: v.id, label: `${v.regNo} · ${v.capacity} seats` })),
      ],
      drivers: [none, ...drivers.items.map((d) => ({ value: d.id, label: d.name }))],
    };
  }, []);
}

const routeInputs = (vehicles: Option[], drivers: Option[]): QuickField[] => [
  { key: "name", label: "Route name" },
  { key: "vehicleId", label: "Vehicle", type: "select", options: vehicles, required: false },
  { key: "driverId", label: "Driver", type: "select", options: drivers, required: false },
  { key: "attendantName", label: "Attendant", required: false },
  { key: "monthlyFee", label: "Monthly fee (Rs)", type: "number" },
];

export function AddRoute({ onCreated }: { onCreated: () => void }) {
  const choices = useRouteChoices();
  if (!choices.data) return null;
  return (
    <QuickAdd
      label="Add route"
      title="Add a bus route"
      description="A vehicle needs valid insurance and fitness dates. After adding, open the route to write its stops."
      endpoint="/transport/routes"
      fields={routeInputs(choices.data.vehicles, choices.data.drivers)}
      onCreated={onCreated}
    />
  );
}

interface Route {
  name: string;
  monthlyFee: number;
  attendant: string | null;
  vehicle: { id: string } | null;
  driver: { id: string } | null;
  stops: { name: string; pickupTime: string; dropTime: string | null }[];
}

function Stops({ id, route, done }: { id: string; route: Route; done: () => void }) {
  const { toast } = useToast();
  const [text, setText] = useState(() =>
    route.stops
      .map((s) => [s.name, s.pickupTime, s.dropTime].filter(Boolean).join(", "))
      .join("\n"),
  );
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const stops = text
      .split("\n")
      .map((line) => line.split(",").map((p) => p.trim()))
      .filter((p) => p[0])
      .map(([name, pickupTime, dropTime]) => ({
        name,
        pickupTime: pickupTime ?? "",
        ...(dropTime ? { dropTime } : {}),
      }));
    setBusy(true);
    try {
      await apiRequest(`/transport/routes/${id}/stops`, { method: "PUT", body: { stops } });
      toast({ title: "Stops saved" });
      done();
    } catch (e) {
      toast({
        title: "Couldn’t save the stops",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-2">
      <label className="grid gap-1.5 text-sm font-semibold">
        Stops, one on each line: name, pick-up time, drop time
        <Textarea
          rows={5}
          value={text}
          placeholder={"Station Road, 07:10, 14:40\nMarket, 07:25, 14:25"}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <div>
        <Button onClick={save} disabled={busy || !text.trim()}>
          {busy ? "Saving…" : "Save stops"}
        </Button>
      </div>
    </div>
  );
}

export function RouteActions({ row, done }: { row: Record<string, unknown>; done: () => void }) {
  const id = String(row.id);
  const route = useAsync(() => apiRequest<Route>(`/transport/routes/${id}`), [id]);
  const choices = useRouteChoices();
  if (route.error) return <ErrorState message={route.error.message} onRetry={route.reload} />;
  if (!route.data || !choices.data) return <LoadingBlock rows={2} />;
  const r = route.data;
  return (
    <div className="mt-4 grid gap-4">
      <Stops key={id} id={id} route={r} done={done} />
      <div>
        <QuickAdd
          label="Change vehicle, driver or fee"
          title={r.name}
          method="PATCH"
          variant="ghost"
          endpoint={`/transport/routes/${id}`}
          fields={routeInputs(choices.data.vehicles, choices.data.drivers)}
          values={{
            name: r.name,
            vehicleId: r.vehicle?.id ?? "",
            driverId: r.driver?.id ?? "",
            attendantName: r.attendant ?? "",
            monthlyFee: String(r.monthlyFee),
          }}
          onCreated={done}
        />
      </div>
    </div>
  );
}
