"use server";

import { redirect } from "next/navigation";
import { ORGANIZATION_KINDS } from "@/domain/entities";
import { buildSandboxDataset } from "@/server/sandbox/fixtures";
import { getRuntime } from "@/server/runtime";
import { createUserClient } from "@/server/supabase/server";

export async function createOrganizationAction(_: { error?: string } | undefined, form: FormData): Promise<{ error?: string } | undefined> {
  const supabase = await createUserClient();
  if (!supabase) return { error: "Authentication is not configured." };
  const name = String(form.get("name") ?? "").trim();
  const kind = String(form.get("kind") ?? "individual");
  if (!name || name.length > 120) return { error: "Enter an organization name (up to 120 characters)." };
  if (!(ORGANIZATION_KINDS as readonly string[]).includes(kind)) return { error: "Choose an organization type." };
  // Runs as the signed-in user: the database derives ownership from auth.uid().
  const { data, error } = await supabase.rpc("sgk_create_organization", { p_name: name, p_kind: kind as (typeof ORGANIZATION_KINDS)[number] });
  if (error || !data) return { error: "The organization could not be created." };
  await getRuntime().store.replaceSandboxData(data, buildSandboxDataset({ organizationId: data, seedDate: new Date() }));
  redirect("/console");
}
