import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PermissionsProvider, usePermission, PermissionGate } from "../permissions-context";
import type { Role } from "@/lib/mock/types";

function Wrapper({ role, children }: { role: Role; children: React.ReactNode }) {
  return <PermissionsProvider role={role}>{children}</PermissionsProvider>;
}

function CapabilityDisplay({ capability }: { capability: Parameters<typeof usePermission>[0] }) {
  const perm = usePermission(capability);
  return <span data-testid="result">{perm}</span>;
}

describe("usePermission", () => {
  it("returns 'allowed' for VP promote_gates", () => {
    render(<CapabilityDisplay capability="promote_gates" />, {
      wrapper: ({ children }) => <Wrapper role="vp">{children}</Wrapper>,
    });
    expect(screen.getByTestId("result")).toHaveTextContent("allowed");
  });

  it("returns 'hidden' for analyst promote_gates", () => {
    render(<CapabilityDisplay capability="promote_gates" />, {
      wrapper: ({ children }) => <Wrapper role="analyst">{children}</Wrapper>,
    });
    expect(screen.getByTestId("result")).toHaveTextContent("hidden");
  });

  it("returns 'visible-disabled' for analyst methodology_instructions", () => {
    render(<CapabilityDisplay capability="methodology_instructions" />, {
      wrapper: ({ children }) => <Wrapper role="analyst">{children}</Wrapper>,
    });
    expect(screen.getByTestId("result")).toHaveTextContent("visible-disabled");
  });

  it("returns 'allowed' for admin connector_policy", () => {
    render(<CapabilityDisplay capability="connector_policy" />, {
      wrapper: ({ children }) => <Wrapper role="admin">{children}</Wrapper>,
    });
    expect(screen.getByTestId("result")).toHaveTextContent("allowed");
  });
});

describe("PermissionGate", () => {
  it("renders children when allowed", () => {
    render(
      <PermissionsProvider role="vp">
        <PermissionGate capability="promote_gates">
          <button>Approve</button>
        </PermissionGate>
      </PermissionsProvider>
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("renders disabled child with tooltip reason when visible-disabled", () => {
    render(
      <PermissionsProvider role="analyst">
        <PermissionGate capability="methodology_instructions">
          <button>Change methodology</button>
        </PermissionGate>
      </PermissionsProvider>
    );
    expect(screen.getByRole("button", { name: /change methodology/i })).toBeDisabled();
    expect(screen.getByTitle(/requires/i)).toBeInTheDocument();
  });

  it("renders nothing when hidden", () => {
    render(
      <PermissionsProvider role="analyst">
        <PermissionGate capability="promote_gates">
          <button>Approve</button>
        </PermissionGate>
      </PermissionsProvider>
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
