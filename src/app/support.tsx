import {
  LegalBullet,
  LegalPage,
  LegalParagraph,
  LegalSection,
  OPENFIT_CONTACT_EMAIL,
} from '@/components/legal-page';

export default function SupportScreen() {
  return (
    <LegalPage title="OpenFit Support" updated="June 26, 2026">
      <LegalSection title="Contact">
        <LegalParagraph>Email: {OPENFIT_CONTACT_EMAIL}</LegalParagraph>
      </LegalSection>

      <LegalSection title="What OpenFit Does">
        <LegalParagraph>
          OpenFit shows Google Health data in a configurable dashboard with activity rings, metric
          cards, and home-screen widgets.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Common Questions">
        <LegalBullet>
          Medical advice: OpenFit is a personal wellness utility and does not provide medical
          advice, diagnosis, or treatment.
        </LegalBullet>
        <LegalBullet>
          Google data: OpenFit accesses the Google Health data you authorize through Google sign-in.
        </LegalBullet>
        <LegalBullet>
          Apple Health: On iOS, OpenFit can write supported weight, sleep, and workout records to
          Apple Health when you start the export and grant HealthKit permission.
        </LegalBullet>
        <LegalBullet>
          Disconnect Google: Sign out in OpenFit and revoke OpenFit access from your Google account
          permissions page.
        </LegalBullet>
        <LegalBullet>
          Revoke Apple Health: Open the iOS Health app or iOS Settings, find OpenFit under Health
          permissions, and turn off access.
        </LegalBullet>
      </LegalSection>

      <LegalSection title="Data Deletion">
        <LegalParagraph>
          Email {OPENFIT_CONTACT_EMAIL} with the subject OpenFit data deletion request. OpenFit
          stores app data locally on your device, but support can help with any server-side records
          if the hosted deployment adds them.
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}
