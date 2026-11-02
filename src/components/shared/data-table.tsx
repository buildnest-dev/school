"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import type { ListParams, Page } from "@/types";

export interface Column<T> {
  key: string;
  header: string;
  /** Enables click-to-sort on this column (server-side sort param `sort`/`order`). */
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  className?: string;
  /** Hide this column in the mobile card layout. */
  hideOnMobile?: boolean;
}

export interface FilterDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * Searchable, sortable, filterable, paginated table. All querying goes through `load(params)`,
 * so the same component works with the mock adapter and a real API (server-side paging).
 * Below `md` it switches to stacked cards instead of squeezing a wide table onto a phone.
 */
export function DataTable<T extends { id: string }>({
  caption,
  columns,
  load,
  filters,
  pageSize = 8,
  searchPlaceholder = "Search",
  onRowClick,
  emptyTitle = "Nothing to show yet",
  emptyHint,
  toolbar,
  reloadKey,
  initialSort,
}: {
  caption: string;
  columns: Column<T>[];
  load: (p: ListParams) => Promise<Page<T>>;
  filters?: FilterDef[];
  pageSize?: number;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyHint?: string;
  toolbar?: ReactNode;
  /** Change to force a reload (e.g. after a mutation). */
  reloadKey?: unknown;
  initialSort?: { key: string; order: "asc" | "desc" };
}) {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(initialSort);
  const [filterVals, setFilterVals] = useState<Record<string, string>>({});
  const [state, setState] = useState<{ data?: Page<T>; error?: Error; loading: boolean }>({
    loading: true,
  });
  const [retry, setRetry] = useState(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let alive = true;
    // Marks the table as loading when a query starts; results are set asynchronously below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, loading: true, error: undefined }));
    loadRef
      .current({
        q: debouncedQ,
        page,
        pageSize,
        sort: sort?.key,
        order: sort?.order,
        filters: filterVals,
      })
      .then((data) => alive && setState({ data, loading: false }))
      .catch(
        (error: unknown) =>
          alive &&
          setState({
            error: error instanceof Error ? error : new Error(String(error)),
            loading: false,
          }),
      );
    return () => {
      alive = false;
    };
  }, [debouncedQ, page, pageSize, sort, filterVals, retry, reloadKey]);

  const data = state.data;
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const toggleSort = (key: string) => {
    setPage(1);
    setSort((s) =>
      s?.key === key
        ? s.order === "asc"
          ? { key, order: "desc" }
          : undefined
        : { key, order: "asc" },
    );
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <label htmlFor={`${caption}-search`} className="sr-only">
            {searchPlaceholder}
          </label>
          <Search
            className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            id={`${caption}-search`}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
        {filters?.map((f) => (
          <div key={f.key}>
            <label htmlFor={`${caption}-${f.key}`} className="sr-only">
              {f.label}
            </label>
            <Select
              id={`${caption}-${f.key}`}
              value={filterVals[f.key] ?? ""}
              onChange={(e) => {
                setPage(1);
                setFilterVals((v) => ({ ...v, [f.key]: e.target.value }));
              }}
              className="w-auto min-w-40"
            >
              <option value="">{f.label}: all</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        ))}
        {toolbar ? <div className="ml-auto flex gap-2">{toolbar}</div> : null}
      </div>

      {state.error ? (
        <ErrorState message={state.error.message} onRetry={() => setRetry((r) => r + 1)} />
      ) : state.loading && !data ? (
        <div role="status" aria-busy="true" className="grid gap-2">
          <span className="sr-only">Loading {caption}</span>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : total === 0 ? (
        <EmptyState
          title={q || Object.values(filterVals).some(Boolean) ? "No matches" : emptyTitle}
          hint={
            q || Object.values(filterVals).some(Boolean)
              ? "Try a different search or clear the filters."
              : emptyHint
          }
        />
      ) : (
        <div
          className={cn(state.loading && "opacity-60 transition-opacity")}
          aria-busy={state.loading}
        >
          <div className="border-line bg-surface hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{caption}</caption>
              <thead>
                <tr className="border-line bg-paper text-muted border-b text-xs tracking-wider uppercase">
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={
                        sort?.key === c.key
                          ? sort.order === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                      className={cn("px-4 py-3 font-semibold", c.className)}
                    >
                      {c.sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          className="hover:text-ink inline-flex items-center gap-1 uppercase"
                        >
                          {c.header}
                          {sort?.key === c.key ? (
                            sort.order === "asc" ? (
                              <ArrowUp className="size-3.5" aria-hidden="true" />
                            ) : (
                              <ArrowDown className="size-3.5" aria-hidden="true" />
                            )
                          ) : null}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.items.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-line border-b last:border-b-0",
                      onRowClick && "hover:bg-paper cursor-pointer",
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((c, i) => (
                      <td key={c.key} className={cn("px-4 py-3 align-middle", c.className)}>
                        {i === 0 && onRowClick ? (
                          <button
                            type="button"
                            className="text-ink text-left font-semibold underline-offset-4 hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRowClick(row);
                            }}
                          >
                            {c.render
                              ? c.render(row)
                              : String((row as Record<string, unknown>)[c.key] ?? "")}
                          </button>
                        ) : c.render ? (
                          c.render(row)
                        ) : (
                          String((row as Record<string, unknown>)[c.key] ?? "")
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="grid gap-3 md:hidden">
            {data?.items.map((row) => (
              <li key={row.id} className="border-line bg-surface rounded-lg border p-4">
                <dl className="grid gap-2 text-sm">
                  {columns
                    .filter((c) => !c.hideOnMobile)
                    .map((c, i) => (
                      <div key={c.key} className={cn(i === 0 ? "" : "flex justify-between gap-4")}>
                        {i === 0 ? null : <dt className="text-muted">{c.header}</dt>}
                        <dd className={cn(i === 0 && "text-ink text-base font-semibold")}>
                          {c.render
                            ? c.render(row)
                            : String((row as Record<string, unknown>)[c.key] ?? "")}
                        </dd>
                      </div>
                    ))}
                </dl>
                {onRowClick ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3"
                    onClick={() => onRowClick(row)}
                  >
                    View details
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted" aria-live="polite">
              Showing {from}–{to} of {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" aria-hidden="true" /> Previous
              </Button>
              <span className="text-muted">
                Page {page} of {pages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next page"
              >
                Next <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
