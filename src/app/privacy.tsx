import {
  LegalBullet,
  LegalPage,
  LegalParagraph,
  LegalSection,
  OPENFIT_CONTACT_EMAIL,
  OPENFIT_PROVIDER,
} from '@/components/legal-page';

export default function PrivacyPolicyScreen() {
  return (
    <LegalPage title="OpenFit Privacy Policy" updated="June 26, 2026">
      <LegalSection title="Who We Are">
        <LegalParagraph>
          OpenFit is provided by {OPENFIT_PROVIDER}. For privacy or support questions, contact{' '}
          {OPENFIT_CONTACT_EMAIL}.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="What OpenFit Does">
        <LegalParagraph>
          OpenFit signs in with Google, reads Google Health data with your permission, and displays
          that data in a configurable dashboard and home-screen widgets. On iOS, OpenFit can export
          selected Google Health records into Apple Health when you start that sync.
        </LegalParagraph>
        <LegalParagraph>
          OpenFit is a personal wellness utility. It does not provide medical advice, diagnosis, or
          treatment.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Data We Access">
        <LegalBullet>
          Google account information needed for sign-in, such as your email address and profile
          information.
        </LegalBullet>
        <LegalBullet>
          Google Health data you authorize, including activity, sleep, profile, health metrics and
          measurements, and nutrition data.
        </LegalBullet>
        <LegalBullet>Dashboard preferences, widget preferences, cached summaries, and sync status.</LegalBullet>
        <LegalBullet>
          On iOS, Apple Health permissions and Apple Health write results for records you choose to
          export.
        </LegalBullet>
      </LegalSection>

      <LegalSection title="How We Use Data">
        <LegalBullet>Sign you in with Google.</LegalBullet>
        <LegalBullet>Fetch and refresh your Google Health data.</LegalBullet>
        <LegalBullet>Display your dashboard, cards, rings, and widgets.</LegalBullet>
        <LegalBullet>Save your preferences.</LegalBullet>
        <LegalBullet>
          Export supported Google Health weight, sleep, and workout records to Apple Health on iOS
          when you start the export.
        </LegalBullet>
        <LegalBullet>Avoid rewriting unchanged Apple Health records.</LegalBullet>
      </LegalSection>

      <LegalSection title="Storage">
        <LegalParagraph>
          On native platforms, OpenFit stores OAuth tokens and app preferences in local secure
          platform storage. Widget data, cached summaries, and Apple Health sync ledger entries are
          stored locally on your device. On web, token and preference data may be stored in browser
          storage.
        </LegalParagraph>
        <LegalParagraph>
          OpenFit server routes process OAuth authorization codes and token refresh requests so the
          app can connect to Google. OpenFit does not use health data for advertising.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Sharing">
        <LegalParagraph>
          OpenFit uses Google APIs for sign-in, token exchange, token refresh, and Google Health
          data access. On iOS, OpenFit uses Apple Health only when you grant permission and start
          the export.
        </LegalParagraph>
        <LegalParagraph>
          We do not sell personal data. We do not share Google Health data with advertisers.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Your Choices">
        <LegalParagraph>
          You can revoke Google access from your Google account settings. You can revoke Apple
          Health permissions in the iOS Health app or iOS Settings. You can remove local OpenFit
          data by signing out in the app and deleting the app from your device.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Children">
        <LegalParagraph>OpenFit is not intended for children under 13.</LegalParagraph>
      </LegalSection>

      <LegalSection title="Changes">
        <LegalParagraph>
          We may update this policy as OpenFit changes. The effective date above shows when this
          policy was last updated.
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}
