"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PolicyState = "self-serve" | "request" | "disabled";

const POLICY_LABELS: Record<PolicyState, string> = { "self-serve": "Self-serve", request: "Request", disabled: "Disabled" };
const POLICY_COLORS: Record<PolicyState, string> = {
  "self-serve": "border-transparent bg-success-soft text-success-soft-foreground",
  request:      "border-transparent bg-warning-soft text-warning-soft-foreground",
  disabled:     "border-border text-muted-foreground",
};

export interface ConnectorPolicy {
  connectorType: string;
  policyState: PolicyState;
  scopeCeiling: string;
  allowWrite: boolean;
}

interface ConnectorPolicyMatrixProps {
  policies: ConnectorPolicy[];
  onUpdatePolicy: (connectorType: string, state: PolicyState) => void;
  className?: string;
}

export function ConnectorPolicyMatrix({ policies, onUpdatePolicy: _onUpdatePolicy, className }: ConnectorPolicyMatrixProps) {
  return (
    <div className={cn("rounded-lg border border-border overflow-hidden", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {["Connector type", "Policy", "Scope ceiling", "Write"].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {policies.map((p) => (
            <tr key={p.connectorType} className="bg-card">
              <td className="px-4 py-3 font-medium capitalize">{p.connectorType}</td>
              <td className="px-4 py-3">
                <Badge variant="outline" className={cn("text-xs", POLICY_COLORS[p.policyState])}>
                  {POLICY_LABELS[p.policyState]}
                </Badge>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{p.scopeCeiling}</td>
              <td className="px-4 py-3">
                <Badge variant="outline" className={p.allowWrite ? "border-success/25 text-success-soft-foreground" : "border-border text-muted-foreground"}>
                  {p.allowWrite ? "Yes" : "No"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
