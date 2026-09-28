import { z } from "zod";
import { EXECUTION_CLASS_META } from "@/domain/execution-classes";
import type { AnyTool } from "./types";

/**
 * Compose the model-facing description. The structure is fixed so models can
 * reliably find when to use a tool, when not to, what it needs, what it does
 * and what authority it requires.
 */
export function composeToolDescription(tool: AnyTool): string {
  const d = tool.description;
  const cls = EXECUTION_CLASS_META[tool.executionClass];
  const lines: string[] = [d.summary, "", "WHEN TO USE"];
  for (const item of d.whenToUse) lines.push(`- ${item}`);
  lines.push("", "WHEN NOT TO USE");
  for (const item of d.whenNotToUse) lines.push(`- ${item}`);
  lines.push("", "REQUIRED CONTEXT");
  for (const item of d.requiredContext) lines.push(`- ${item}`);
  lines.push("", "EFFECT", d.effect);
  lines.push(
    "",
    "AUTHORIZATION CLASS",
    `${cls.label.toUpperCase()} — ${cls.effect} Required scopes: ${tool.requiredScopes.length ? tool.requiredScopes.join(", ") : "none"}.${
      tool.approvalRequired ? " Explicit human approval is always required before execution." : ""
    }`,
  );
  if (d.limitations?.length) {
    lines.push("", "LIMITATIONS");
    for (const item of d.limitations) lines.push(`- ${item}`);
  }
  lines.push("", "EXAMPLE", `User: "${d.example.request}"`, `Arguments: ${JSON.stringify(d.example.arguments)}`);
  return lines.join("\n");
}

export function majorVersion(tool: Pick<AnyTool, "version">): number {
  return Number.parseInt(tool.version.split(".")[0] ?? "1", 10);
}

/** Envelope version string, e.g. "1.0". */
export function envelopeVersion(tool: Pick<AnyTool, "version">): string {
  const [major = "1", minor = "0"] = tool.version.split(".");
  return `${major}.${minor}`;
}

export function inputJsonSchema(tool: AnyTool): Record<string, unknown> {
  const schema = z.toJSONSchema(tool.input, { io: "input", target: "draft-2020-12" }) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

export function outputJsonSchema(tool: AnyTool): Record<string, unknown> {
  const schema = z.toJSONSchema(tool.output, { io: "output", target: "draft-2020-12" }) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}
