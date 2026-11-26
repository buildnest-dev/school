"use client";

import { Award, FileText } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { env } from "@/config/env";
import { apiRequest } from "@/lib/api/client";
import { Files } from "../shared/files";
import { fmtDate, fmtDateTime, prettyKey } from "../shared/format";
import { useData } from "../shared/use-data";
import { MaterialList, SAMPLE_MATERIALS, type Material } from "../teacher/classwork";
import { ChildPage } from "./child";

/** Loads one child's list and draws it, with the loading, error and empty states. */
function ChildList<T extends { id: string }>({
  childId,
  path,
  sample,
  empty,
  render,
}: {
  childId: string;
  path: string;
  sample: T[];
  empty: string;
  render: (item: T) => React.ReactNode;
}) {
  const d = useData<T[]>(`/me/children/${childId}/${path}`, sample);
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (d.loading || !d.data) return <LoadingBlock rows={3} />;
  if (!d.data.length) return <EmptyState title={empty} />;
  return (
    <ul className="grid max-w-3xl gap-3">
      {d.data.map((x) => (
        <li key={x.id}>{render(x)}</li>
      ))}
    </ul>
  );
}

function FamilyMaterialList({ childId }: { childId: string }) {
  const d = useData<Material[]>(`/me/children/${childId}/materials`, SAMPLE_MATERIALS);
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (d.loading || !d.data) return <LoadingBlock rows={3} />;
  return <MaterialList items={d.data} />;
}

export function FamilyMaterials() {
  return (
    <ChildPage title="Study material" description="Notes and worksheets from teachers.">
      {(id) => <FamilyMaterialList key={id} childId={id} />}
    </ChildPage>
  );
}

interface Message {
  id: string;
  from: string;
  body: string;
  sentAt: string;
  reply?: string;
}

function ReplyBox({ childId, message }: { childId: string; message: Message }) {
  const { toast } = useToast();
  const [text, setText] = useState(message.reply ?? "");
  const [sent, setSent] = useState(message.reply ?? "");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (env.dataSource === "api")
        await apiRequest(`/me/children/${childId}/messages`, {
          method: "PATCH",
          body: { messageId: message.id, reply: text },
        });
      setSent(text);
      toast({ title: "Reply sent" });
    } catch (err) {
      toast({
        title: "Couldn’t send",
        description: err instanceof Error ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2">
      <Input
        aria-label={`Reply to ${message.from}`}
        placeholder="Write a reply"
        maxLength={1000}
        className="min-w-48 flex-1"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button type="submit" size="sm" disabled={busy || text.trim().length < 2 || text === sent}>
        {sent ? "Update reply" : "Reply"}
      </Button>
    </form>
  );
}

export function ParentMessages() {
  return (
    <ChildPage title="Teacher messages" description="Notes from teachers.">
      {(id) => (
        <ChildList<Message>
          key={id}
          childId={id}
          path="messages"
          empty="No messages yet"
          sample={[
            {
              id: "t1",
              from: "Kavita Iyer",
              body: "Very good work in today’s reading. Please keep encouraging the practice at home.",
              sentAt: "2026-10-23T10:15:00.000Z",
            },
          ]}
          render={(m) => (
            <Card>
              <p className="text-ink font-semibold">{m.from}</p>
              <p className="text-muted text-xs">{fmtDateTime(m.sentAt)}</p>
              <p className="mt-2 text-sm whitespace-pre-wrap">{m.body}</p>
              <ReplyBox childId={id} message={m} />
            </Card>
          )}
        />
      )}
    </ChildPage>
  );
}

interface Doc {
  id: string;
  kind: string;
  title: string;
  reference: string;
  date: string;
}

export function ParentDocuments() {
  return (
    <ChildPage title="Documents" description="Certificates and fee payments on record.">
      {(id) => (
        <div key={id} className="grid max-w-3xl gap-5">
          <div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/parent/print/reportcard/${id}`}>Report card</Link>
            </Button>
          </div>
          <ChildList<Doc>
            childId={id}
            path="documents"
            empty="No documents yet"
            sample={[
              {
                id: "d1",
                kind: "Certificate",
                title: "Bonafide certificate",
                reference: "BON/2026/0004",
                date: "2026-10-12",
              },
              {
                id: "d2",
                kind: "Fee payment",
                title: "Term 2 tuition · ₹14,500",
                reference: "RCP-0192",
                date: "2026-10-03",
              },
            ]}
            render={(x) => (
              <Card className="flex items-center gap-4">
                <span
                  aria-hidden="true"
                  className="grid size-11 flex-none place-items-center rounded-xl bg-[#f7dc9c] text-[#8a5a0c]"
                >
                  <FileText className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="text-ink block font-semibold">{x.title}</span>
                  <span className="text-muted text-sm">
                    {x.kind}
                    {x.reference ? ` · ${x.reference}` : ""} · {fmtDate(x.date)}
                  </span>
                </span>
                <Button asChild variant="ghost" size="sm" className="ml-auto">
                  <Link
                    href={`/parent/print/${x.kind === "Certificate" ? "certificate" : "receipt"}/${x.id}`}
                  >
                    View
                  </Link>
                </Button>
              </Card>
            )}
          />
          <Card>
            <CardHeader title="Papers shared with the school" />
            <Files entity="student" entityId={id} canAdd />
          </Card>
        </div>
      )}
    </ChildPage>
  );
}

export interface Achievement {
  id: string;
  title: string;
  category: string;
  awardedOn: string;
  note: string;
}

export function FamilyAchievements() {
  return (
    <ChildPage title="Achievements" description="Prizes and recognition.">
      {(id) => (
        <ChildList<Achievement>
          key={id}
          childId={id}
          path="achievements"
          empty="No achievements recorded yet"
          sample={[
            {
              id: "a1",
              title: "First prize, inter-house debate",
              category: "academic",
              awardedOn: "2026-09-18",
              note: "Spoke for Blue House.",
            },
          ]}
          render={(x) => (
            <Card className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="grid size-11 flex-none place-items-center rounded-xl bg-[#d6efa4] text-[#2f6b12]"
              >
                <Award className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="text-ink block font-semibold">{x.title}</span>
                <span className="text-muted text-sm">
                  {prettyKey(x.category)} · {fmtDate(x.awardedOn)}
                </span>
                {x.note ? <span className="mt-1 block text-sm">{x.note}</span> : null}
              </span>
            </Card>
          )}
        />
      )}
    </ChildPage>
  );
}

interface Profile {
  name: string;
  email: string;
  phone: string;
}

export function ParentProfile() {
  const d = useData<Profile>("/me/profile", {
    name: "Rahul Mehta",
    email: "rahul.mehta@example.com",
    phone: "9876543210",
  });
  const [phone, setPhone] = useState<string | null>(null);
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock rows={3} />;
  const value = phone ?? d.data.phone;
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await d.send("PATCH", "/me/profile", { phone: value }, (p) => ({
      ...p,
      phone: value,
    }));
    if (ok) setPhone(null);
  };
  return (
    <>
      <PageHeader title="Profile & preferences" description="Your contact details and password." />
      <div className="grid max-w-4xl items-start gap-5 md:grid-cols-2">
        <Card>
          <CardHeader
            title="Contact details"
            hint="To change your name or e-mail, ask the school."
          />
          <form onSubmit={save} className="grid gap-3">
            <p className="text-sm">
              <span className="text-ink block font-semibold">{d.data.name}</span>
              <span className="text-muted">{d.data.email}</span>
            </p>
            <Field id="phone" label="Phone (10 digits)" required>
              {(a) => (
                <Input
                  {...a}
                  inputMode="tel"
                  value={value}
                  onChange={(e) => setPhone(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" disabled={d.busy || phone === null || phone === d.data.phone}>
              Save number
            </Button>
          </form>
        </Card>
        <ChangePassword />
      </div>
    </>
  );
}

function ChangePassword() {
  const { toast } = useToast();
  const [f, setF] = useState({ currentPassword: "", newPassword: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (env.dataSource === "api")
        await apiRequest("/auth/change-password", { method: "POST", body: f });
      toast({ title: "Password changed" });
      setF({ currentPassword: "", newPassword: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the password.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader title="Change password" hint="Your other devices are signed out." />
      <form onSubmit={submit} className="grid gap-3">
        <Field id="currentPassword" label="Current password" required>
          {(a) => (
            <PasswordInput
              {...a}
              autoComplete="current-password"
              value={f.currentPassword}
              onChange={(e) => setF({ ...f, currentPassword: e.target.value })}
            />
          )}
        </Field>
        <Field id="newPassword" label="New password" required error={error || undefined}>
          {(a) => (
            <PasswordInput
              {...a}
              autoComplete="new-password"
              value={f.newPassword}
              onChange={(e) => setF({ ...f, newPassword: e.target.value })}
            />
          )}
        </Field>
        <Button type="submit" disabled={busy || !f.currentPassword || !f.newPassword}>
          Change password
        </Button>
      </form>
    </Card>
  );
}
