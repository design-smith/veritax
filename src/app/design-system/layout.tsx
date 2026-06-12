import { TopNav } from "@/components/nav";

export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav title="Design System" />
      <main>{children}</main>
    </>
  );
}
