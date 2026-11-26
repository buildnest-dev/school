"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useAsync } from "@/hooks/use-async";
import { useSession } from "@/hooks/use-session";
import { apiRequest } from "@/lib/api/client";
import { ApiAction } from "../shared/quick-add";
import { SchoolSupport } from "../shared/support";
import { PermissionMatrix } from "./settings";

interface Band {
  name: string;
  from: number;
  to: number;
  remark: string;
}
interface Followed {
  boardId: string;
  name: string;
  isDefault: boolean;
  customScale: boolean;
  scale: Band[];
}

const toText = (scale: Band[]) =>
  scale.map((b) => [b.name, b.from, b.to, b.remark].join(", ")).join("\n");
const fromText = (text: string): Band[] =>
  text
    .split("\n")
    .map((line) => line.split(",").map((p) => p.trim()))
    .filter((p) => p[0])
    .map(([name, from, to, ...remark]) => ({
      name: name!,
      from: Number(from),
      to: Number(to),
      remark: remark.join(", "),
    }));

function Scale({ board, onSaved }: { board: Followed; onSaved: () => void }) {
  const { toast } = useToast();
  const [text, setText] = useState(() => toText(board.scale));
  const [busy, setBusy] = useState(false);
  const save = async (scale: Band[] | null) => {
    setBusy(true);
    try {
      await apiRequest(`/school/boards/${board.boardId}/scale`, {
        method: "PUT",
        body: { scale },
      });
      toast({ title: "Grading scale saved" });
      onSaved();
    } catch (e) {
      toast({
        title: "Couldn’t save",
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
        Grades, one on each line: grade, from, to, remark
        <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save(fromText(text))} disabled={busy}>
          Save scale
        </Button>
        {board.customScale ? (
          <Button variant="ghost" onClick={() => save(null)} disabled={busy}>
            Use the board’s own scale
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Boards() {
  const d = useAsync(async () => {
    const [all, mine] = await Promise.all([
      apiRequest<{ id: string; name: string }[]>("/boards"),
      apiRequest<Followed[]>("/school/boards"),
    ]);
    return { all, mine };
  }, []);
  const [add, setAdd] = useState("");
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock rows={3} />;
  const { all, mine } = d.data;
  const list = mine.map((b) => ({ boardId: b.boardId, isDefault: b.isDefault }));
  const others = all.filter((a) => !mine.some((m) => m.boardId === a.id));
  const put = (boards: typeof list, label: string, key?: string) => (
    <ApiAction
      key={key}
      label={label}
      method="PUT"
      endpoint="/school/boards"
      body={{ boards }}
      onDone={() => {
        setAdd("");
        d.reload();
      }}
    />
  );
  return (
    <div className="grid max-w-2xl gap-4">
      {mine.map((b) => (
        <Card key={b.boardId} className="grid gap-3">
          <CardHeader title={b.name} hint={b.isDefault ? "Main board" : undefined} />
          {b.isDefault ? null : (
            <div className="flex flex-wrap gap-2">
              {put(
                list.map((x) => ({ ...x, isDefault: x.boardId === b.boardId })),
                "Make this the main board",
              )}
              {put(
                list.filter((x) => x.boardId !== b.boardId),
                "Stop following",
              )}
            </div>
          )}
          <Scale key={toText(b.scale)} board={b} onSaved={d.reload} />
        </Card>
      ))}
      {others.length ? (
        <Card className="grid gap-3">
          <CardHeader title="Follow another board" />
          <Select aria-label="Board to add" value={add} onChange={(e) => setAdd(e.target.value)}>
            <option value="">Choose a board</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
          {add ? (
            <div>
              {put([...list, { boardId: add, isDefault: list.length === 0 }], "Add this board")}
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function MyData() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const data = await apiRequest<unknown>("/school/export");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `school-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({
        title: "Couldn’t download",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="grid max-w-xl gap-3 text-sm">
      <CardHeader title="Your school’s data" />
      <p>
        One file with your classes, students, staff, fees, exams and marks. It contains personal
        details, so keep it safe.
      </p>
      <div>
        <Button onClick={download} disabled={busy}>
          {busy ? "Preparing…" : "Download my data"}
        </Button>
      </div>
    </Card>
  );
}

/** The pages a school can share with people who have no sign-in. */
function PublicPages() {
  return (
    <Card className="grid max-w-xl gap-2 text-sm">
      <CardHeader title="Pages to share" hint="Anyone can open these without signing in." />
      <p>Open each one from your school’s own web address, then copy the address to share it.</p>
      <a className="font-semibold underline" href="/apply" target="_blank" rel="noreferrer">
        Admission enquiry form
      </a>
      <a className="font-semibold underline" href="/verify" target="_blank" rel="noreferrer">
        Certificate check
      </a>
    </Card>
  );
}

/** Settings of the live app: boards and grades, who sees what, the data copy and help. */
export function LiveSettings() {
  const role = useSession().user?.role;
  const manages = role === "school_owner" || role === "principal";
  return (
    <>
      <PageHeader
        title="Settings & permissions"
        description="Boards and grades, who can do what, your data and help."
      />
      <Tabs key={String(manages)} defaultValue={manages ? "boards" : "help"}>
        <TabsList aria-label="Settings sections">
          {manages ? <TabsTrigger value="boards">Boards & grades</TabsTrigger> : null}
          <TabsTrigger value="roles">Roles & permissions</TabsTrigger>
          {manages ? <TabsTrigger value="data">My data</TabsTrigger> : null}
          <TabsTrigger value="pages">Public pages</TabsTrigger>
          <TabsTrigger value="help">Help from ZAQSA</TabsTrigger>
        </TabsList>
        {manages ? (
          <>
            <TabsContent value="boards">
              <Boards />
            </TabsContent>
            <TabsContent value="data">
              <MyData />
            </TabsContent>
          </>
        ) : null}
        <TabsContent value="roles">
          <p className="text-muted mb-3 max-w-[70ch] text-sm">
            Which screens each role can open. New staff are invited from the Staff page, parents and
            students from the student’s page.
          </p>
          <PermissionMatrix />
        </TabsContent>
        <TabsContent value="pages">
          <PublicPages />
        </TabsContent>
        <TabsContent value="help">
          <SchoolSupport />
        </TabsContent>
      </Tabs>
    </>
  );
}
