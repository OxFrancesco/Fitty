import {
  LegalPage,
  LegalParagraph,
  LegalSection,
  OPENFIT_CONTACT_EMAIL,
  OPENFIT_PROVIDER,
} from '@/components/legal-page';

export default function TermsScreen() {
  return (
    <LegalPage title="OpenFit Terms of Service" updated="June 26, 2026">
      <LegalSection title="Provider">
        <LegalParagraph>
          OpenFit is provided by {OPENFIT_PROVIDER}. Contact {OPENFIT_CONTACT_EMAIL} with support
          questions.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Use of OpenFit">
        <LegalParagraph>
          OpenFit is a personal wellness utility that helps you view Google Health data and, on iOS,
          manually export selected records to Apple Health. You are responsible for the Google,
          Apple, and device accounts you use with OpenFit.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="No Medical Advice">
        <LegalParagraph>
          OpenFit does not provide medical advice, diagnosis, or treatment. Do not use OpenFit as a
          substitute for professional medical advice or emergency care.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="User Permissions">
        <LegalParagraph>
          OpenFit accesses Google Health and Apple Health data only after you grant permission. You
          can revoke access in your Google account, Apple Health settings, or device settings.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Availability">
        <LegalParagraph>
          OpenFit may change, pause, or stop features as the product evolves or as third-party APIs
          change. Health data availability depends on Google Health, Apple Health, your devices, and
          the permissions you grant.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Privacy">
        <LegalParagraph>
          The OpenFit Privacy Policy explains what data OpenFit accesses and how it is used.
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}
