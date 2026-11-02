"use client";

import { Check, Minus } from "lucide-react";
import { useState } from "react";
import { DevNote, FileUpload, PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { ROLE_LABEL, SCREENS } from "@/config/screens";
import { SCHOOL_NAME } from "@/mocks/data";
import type { Role } from "@/types";

const SCHOOL_ROLES: Role[] = [
  "school_owner",
  "principal",
  "accountant",
  "librarian",
  "transport",
  "teacher",
  "parent",
  "student",
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Derived from config/screens.ts, so the matrix always matches what the menus show. The backend must enforce the same rules. */
function PermissionMatrix() {
  const rows = SCREENS.filter(
    (s) => (s.area === "school" || s.nav) && s.area !== "platform" && !s.path.includes(":"),
  );
  return (
    <div className="border-line bg-surface overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Which role can open which screen</caption>
        <thead>
          <tr className="bg-paper text-muted border-line border-b text-xs tracking-wider uppercase">
            <th scope="col" className="px-3 py-3">
              Screen
            </th>
            {SCHOOL_ROLES.map((r) => (
              <th key={r} scope="col" className="px-2 py-3 text-center">
                {ROLE_LABEL[r].replace("Transport coordinator", "Transport")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-line border-b last:border-b-0">
              <th scope="row" className="px-3 py-2 font-medium">
                {s.title} <span className="text-muted text-xs font-normal">({s.area})</span>
              </th>
              {SCHOOL_ROLES.map((r) => (
                <td key={r} className="px-2 py-2 text-center">
                  {s.roles.includes(r) ? (
                    <>
                      <Check className="text-ok mx-auto size-4" aria-hidden="true" />
                      <span className="sr-only">Allowed</span>
                    </>
                  ) : (
                    <>
                      <Minus className="text-muted mx-auto size-4" aria-hidden="true" />
                      <span className="sr-only">Not allowed</span>
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Settings() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("teacher");
  const [err, setErr] = useState("");
  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setErr("Enter a valid email address.");
      return;
    }
    setErr("");
    toast({
      title: `Invitation prepared for ${email.trim()}`,
      description: "Development mock: no email was sent and no account was created.",
    });
    setEmail("");
  };
  return (
    <>
      <PageHeader
        title="Settings & permissions"
        description="School profile, who can do what, and invitations."
      />
      <Tabs defaultValue="profile">
        <TabsList aria-label="Settings sections">
          <TabsTrigger value="profile">School profile</TabsTrigger>
          <TabsTrigger value="roles">Roles & permissions</TabsTrigger>
          <TabsTrigger value="invite">Invite someone</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <Card className="max-w-xl">
            <CardHeader title="Profile and branding" />
            <form
              noValidate
              className="grid gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                toast({
                  title: "Profile kept in the development mock",
                  description: "Nothing was saved to a server.",
                });
              }}
            >
              <Field id="sp-name" label="School name">
                {(a) => <Input defaultValue={SCHOOL_NAME} {...a} />}
              </Field>
              <FileUpload label="Logo" hint="Development preview only: the file is not uploaded." />
              <Field
                id="sp-color"
                label="Accent colour"
                hint="Used on certificates and the parent portal"
              >
                {(a) => (
                  <Input type="color" defaultValue="#b8501e" className="h-12 w-24 p-1" {...a} />
                )}
              </Field>
              <div>
                <Button type="submit">Save</Button>
              </div>
              <DevNote>
                Branding, custom domains and templates are stored by the backend per school.
              </DevNote>
            </form>
          </Card>
        </TabsContent>
        <TabsContent value="roles">
          <p className="text-muted mb-3 max-w-[70ch] text-sm">
            This shows which screens each role can open. Hiding a screen is a convenience: the
            server must check permissions on every request.
          </p>
          <PermissionMatrix />
        </TabsContent>
        <TabsContent value="invite">
          <Card className="max-w-xl">
            <CardHeader
              title="Invite a user"
              hint="They get access only to what their role allows."
            />
            <form noValidate onSubmit={invite} className="grid gap-5">
              <Field id="inv-email" label="Email address" error={err}>
                {(a) => (
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    {...a}
                  />
                )}
              </Field>
              <Field id="inv-role" label="Role">
                {(a) => (
                  <Select value={role} onChange={(e) => setRole(e.target.value as Role)} {...a}>
                    {SCHOOL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <div>
                <Button type="submit">Prepare invitation</Button>
              </div>
              <DevNote>
                Invitations, activation and identity verification are handled by the backend.
              </DevNote>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
