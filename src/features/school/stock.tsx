"use client";

import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { downloadCsv } from "../shared/csv";
import { fmtDateTime } from "../shared/format";
import { sampleId, useData } from "../shared/use-data";

interface StockRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  qty: number;
  minQty: number;
  low: boolean;
}
interface Stock {
  items: StockRow[];
  moves: { id: string; item: string; change: number; note: string; by: string; at: string }[];
}

const SAMPLE: Stock = {
  items: [
    {
      id: "i1",
      name: "Chalk box",
      category: "Stationery",
      unit: "box",
      qty: 4,
      minQty: 10,
      low: true,
    },
    {
      id: "i2",
      name: "A4 paper",
      category: "Stationery",
      unit: "ream",
      qty: 26,
      minQty: 8,
      low: false,
    },
  ],
  moves: [
    {
      id: "m1",
      item: "Chalk box",
      change: -6,
      note: "Class 6 to 8",
      by: "School office",
      at: "2026-10-24T09:00:00.000Z",
    },
  ],
};

function StockLine({
  item,
  busy,
  onMove,
}: {
  item: StockRow;
  busy: boolean;
  onMove: (change: number, note: string) => Promise<boolean>;
}) {
  const [count, setCount] = useState("");
  const [note, setNote] = useState("");
  const n = Math.trunc(Number(count));
  const move = async (sign: 1 | -1) => {
    if (await onMove(sign * n, note)) {
      setCount("");
      setNote("");
    }
  };
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-ink font-semibold">{item.name}</p>
          <p className="text-muted text-sm">
            {item.category} · {item.qty} {item.unit} (reorder at {item.minQty})
          </p>
        </div>
        {item.low ? <StatusBadge status="low" /> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input
          type="number"
          min={1}
          aria-label={`Quantity of ${item.name}`}
          placeholder="Qty"
          className="w-24"
          value={count}
          onChange={(e) => setCount(e.target.value)}
        />
        <Input
          aria-label={`Note for ${item.name}`}
          placeholder="Note"
          className="min-w-40 flex-1"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button size="sm" disabled={busy || !(n > 0)} onClick={() => void move(1)}>
          Stock in
        </Button>
        <Button variant="ghost" size="sm" disabled={busy || !(n > 0)} onClick={() => void move(-1)}>
          Issue
        </Button>
      </div>
    </Card>
  );
}

export function StockPage() {
  const d = useData<Stock>("/stock", SAMPLE);
  const [f, setF] = useState({ name: "", category: "", unit: "pcs", qty: "0", minQty: "0" });
  const add = async (e: FormEvent) => {
    e.preventDefault();
    const body = { ...f, qty: Number(f.qty) || 0, minQty: Number(f.minQty) || 0 };
    const ok = await d.send(
      "POST",
      "/stock",
      body,
      (s) => ({
        ...s,
        items: [...s.items, { id: sampleId(), ...body, low: body.qty <= body.minQty }],
      }),
      "Item added",
    );
    if (ok) setF({ name: "", category: "", unit: "pcs", qty: "0", minQty: "0" });
  };
  const text = (key: keyof typeof f, label: string, type = "text") => (
    <Field id={`stock-${key}`} label={label}>
      {(a) => (
        <Input
          {...a}
          type={type}
          value={f[key]}
          onChange={(e) => setF({ ...f, [key]: e.target.value })}
        />
      )}
    </Field>
  );
  return (
    <>
      <PageHeader
        title="Stock"
        description="What the school holds, what came in and what was given out."
        actions={
          d.data ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                downloadCsv("stock.csv", [
                  ["Item", "Category", "Quantity", "Unit", "Reorder at"],
                  ...d.data!.items.map((i) => [i.name, i.category, i.qty, i.unit, i.minQty]),
                ])
              }
            >
              Download CSV
            </Button>
          ) : null
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[340px_1fr]">
        <div className="grid gap-5">
          <Card>
            <CardHeader title="New item" />
            <form onSubmit={add} className="grid gap-3">
              {text("name", "Item name")}
              {text("category", "Category")}
              {text("unit", "Unit")}
              {text("qty", "In stock now", "number")}
              {text("minQty", "Reorder at", "number")}
              <Button
                type="submit"
                disabled={d.busy || f.name.trim().length < 2 || f.category.trim().length < 2}
              >
                Add item
              </Button>
            </form>
          </Card>
          {d.data?.moves.length ? (
            <Card>
              <CardHeader title="Recent movement" />
              <ul className="grid gap-2 text-sm">
                {d.data.moves.slice(0, 12).map((m) => (
                  <li key={m.id}>
                    <span className="font-semibold">
                      {m.change > 0 ? `+${m.change}` : m.change} {m.item}
                    </span>
                    <span className="text-muted block text-xs">
                      {m.by} · {fmtDateTime(m.at)}
                      {m.note ? ` · ${m.note}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
        {d.error ? (
          <ErrorState message={d.error.message} onRetry={d.reload} />
        ) : !d.data ? (
          <LoadingBlock rows={3} />
        ) : !d.data.items.length ? (
          <EmptyState title="No items yet" />
        ) : (
          <ul className="grid gap-3">
            {d.data.items.map((i) => (
              <li key={i.id}>
                <StockLine
                  item={i}
                  busy={d.busy}
                  onMove={(change, note) =>
                    d.send(
                      "POST",
                      `/stock/${i.id}`,
                      { change, note },
                      (s) => ({
                        ...s,
                        items: s.items.map((x) =>
                          x.id === i.id
                            ? {
                                ...x,
                                qty: Math.max(0, x.qty + change),
                                low: Math.max(0, x.qty + change) <= x.minQty,
                              }
                            : x,
                        ),
                      }),
                      "Stock updated",
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
