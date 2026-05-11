import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type McpTool = {
  name: string;
  description: string;
  inputSchema: object;
};

function JsonSchemaView({ schema, depth = 0 }: { schema: Record<string, unknown>; depth?: number }) {
  const [expanded, setExpanded] = useState(true);

  if (depth > 2) return <span className="text-muted-foreground text-[9px]">...</span>;

  if (schema.type === "object" && schema.properties) {
    const props = schema.properties as Record<string, Record<string, unknown>>;
    const required = (schema.required as string[]) ?? [];

    return (
      <div className={depth > 0 ? "ml-3 border-l border-border/50 pl-2" : ""}>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground mb-1"
        >
          {expanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
          <span className="font-mono">object</span>
        </button>
        {expanded &&
          Object.entries(props).map(([key, val]) => (
            <div key={key} className="flex flex-col mb-1">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[9px] text-primary font-medium">{key}</span>
                {required.includes(key) && (
                  <span className="text-[8px] text-destructive">*</span>
                )}
                <span className="text-[9px] text-muted-foreground">
                  {Array.isArray(val.type) ? val.type.join(" | ") : (val.type as string) ?? "any"}
                  {val.enum ? ` (${(val.enum as string[]).join(" | ")})` : ""}
                </span>
              </div>
              {val.description && (
                <span className="text-[8px] text-muted-foreground/70 ml-0 mt-0.5">{val.description as string}</span>
              )}
            </div>
          ))}
      </div>
    );
  }

  return (
    <span className="font-mono text-[9px] text-muted-foreground">
      {Array.isArray(schema.type) ? (schema.type as string[]).join(" | ") : (schema.type as string) ?? "any"}
    </span>
  );
}

export function McpToolsPanel({ tools }: { tools: McpTool[] }) {
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  return (
    <div className="flex gap-4 px-5 py-3 overflow-x-auto">
      {tools.map((tool) => {
        const isExpanded = expandedTool === tool.name;
        return (
          <div
            key={tool.name}
            className="flex-none min-w-[280px] max-w-[320px] rounded-lg border border-border bg-background p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-0.5" />
                <code className="text-xs font-semibold text-primary">{tool.name}</code>
              </div>
              <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">MCP Tool</span>
            </div>

            <p className="text-[10px] text-muted-foreground leading-relaxed">{tool.description}</p>

            <button
              data-testid={`tool-schema-toggle-${tool.name}`}
              onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
              className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {isExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
              <span>Input schema</span>
            </button>

            {isExpanded && (
              <div className="rounded-md bg-muted/60 p-2 animate-fade-up">
                <JsonSchemaView schema={tool.inputSchema as Record<string, unknown>} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
