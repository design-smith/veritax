import AccessLiveForm from "@/components/AccessLiveForm"

// Public app entry. Pre-launch, /login shows the "Access Veritax Live" request form (same as /signup);
// the real email-code login lives at /auth. Restore the OTP form here to re-enable direct login.
export default function LoginPage() {
  return <AccessLiveForm />
}
