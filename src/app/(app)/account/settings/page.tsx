import { redirect } from 'next/navigation'

// /account/settings is the spec-level path per Task 7; the actual
// implementation lives at /settings where BrandingPanel + profile
// editing already exist. Redirect keeps both URLs working.
export default function AccountSettingsRedirect() {
  redirect('/settings')
}
