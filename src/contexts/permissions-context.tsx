"use client";

import React, { createContext, useContext } from "react";
import { ROLE_CAPABILITIES } from "@/lib/mock";
import type { Capability, Permission, Role } from "@/lib/mock/types";

interface PermissionsContextValue {
  role: Role;
  check: (capability: Capability) => Permission;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const check = (capability: Capability): Permission =>
    ROLE_CAPABILITIES[role][capability];

  return (
    <PermissionsContext.Provider value={{ role, check }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermission(capability: Capability): Permission {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error("usePermission must be used inside PermissionsProvider");
  return ctx.check(capability);
}

export function useRole(): Role {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error("useRole must be used inside PermissionsProvider");
  return ctx.role;
}

// ── PermissionGate ───────────────────────────────────────────────────────────

interface PermissionGateProps {
  capability: Capability;
  children: React.ReactElement;
  disabledReason?: string;
}

export function PermissionGate({
  capability,
  children,
  disabledReason,
}: PermissionGateProps) {
  const permission = usePermission(capability);

  if (permission === "hidden") return null;

  if (permission === "visible-disabled") {
    const reason = disabledReason ?? `Requires elevated role to use ${capability.replace(/_/g, " ")}`;
    return (
      <span title={reason}>
        {/* Clone the child and inject disabled prop */}
        {cloneDisabled(children)}
      </span>
    );
  }

  return children;
}

function cloneDisabled(child: React.ReactElement): React.ReactElement {
  return React.cloneElement(child, { disabled: true, "aria-disabled": true } as React.HTMLAttributes<HTMLElement>);
}
