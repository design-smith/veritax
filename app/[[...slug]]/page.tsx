// Single catch-all route so the whole app is ONE mounted component across every URL
// (/, /company/<slug>, /project/<id>/<step>[/<country>]). Keeping one instance means workflow steps
// never unmount as you navigate — their in-flight polling and results persist. The explicit routes
// (/auth, /login, /signup, /demo) are more specific and take precedence over this catch-all.
import Workspace from "@/components/workspace"

export default function AppCatchAll() {
  return <Workspace />
}
