import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { CSSProperties } from 'react';

export type AccountEmailAction = 'verify' | 'reset-password';

const content = {
  verify: {
    preview: 'Confirm your email to finish setting up your Onselli account.',
    eyebrow: 'ACCOUNT SETUP',
    heading: 'Verify your email',
    description: 'Confirm this email address to finish setting up your Onselli account and get started.',
    button: 'Verify email address',
    expiration: 'This link expires in 1 hour.',
  },
  'reset-password': {
    preview: 'Use this secure link to choose a new Onselli password.',
    eyebrow: 'ACCOUNT SECURITY',
    heading: 'Reset your password',
    description: 'We received a request to change the password for your Onselli account. Use the secure link below to continue.',
    button: 'Choose a new password',
    expiration: 'This link expires in 1 hour. If it expires, request a new reset link.',
  },
} satisfies Record<AccountEmailAction, {
  preview: string;
  eyebrow: string;
  heading: string;
  description: string;
  button: string;
  expiration: string;
}>;

export function AccountActionEmail({ action, actionUrl, appUrl }: {
  action: AccountEmailAction;
  actionUrl: string;
  appUrl: string;
}) {
  const copy = content[action];

  return (
    <Html lang="en">
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.brandBar}>
            <Text style={styles.brand}>Onselli</Text>
            <Text style={styles.brandCaption}>YOUR KNOWLEDGE, YOUR BUSINESS</Text>
          </Section>
          <Section style={styles.content}>
            <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
            <Heading as="h1" style={styles.heading}>{copy.heading}</Heading>
            <Text style={styles.description}>{copy.description}</Text>
            <Section style={styles.buttonSection}>
              <Button href={actionUrl} style={styles.button}>{copy.button}</Button>
            </Section>
            <Text style={styles.fallbackLabel}>If the button doesn’t work, copy and paste this link:</Text>
            <Link href={actionUrl} style={styles.fallbackLink}>{actionUrl}</Link>
            <Text style={styles.expiration}>{copy.expiration}</Text>
            <Hr style={styles.divider} />
            <Text style={styles.securityNote}>
              If you didn’t request this, you can safely ignore this email. Never share this link with anyone.
            </Text>
          </Section>
          <Section style={styles.footer}>
            <Link href={appUrl} style={styles.footerBrand}>onselli.com</Link>
            <Text style={styles.footerText}>Run. Sell. Grow.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles: Record<string, CSSProperties> = {
  body: {
    backgroundColor: '#f3f6f3',
    color: '#17261d',
    fontFamily: 'Arial, Helvetica, sans-serif',
    margin: 0,
    padding: '36px 16px',
  },
  container: {
    backgroundColor: '#ffffff',
    border: '1px solid #e1e8e2',
    borderRadius: 16,
    margin: '0 auto',
    maxWidth: 560,
    overflow: 'hidden',
    width: '100%',
  },
  brandBar: {
    backgroundColor: '#014733',
    borderBottom: '4px solid #8de9ad',
    padding: '23px 32px 19px',
  },
  brand: {
    color: '#ffffff',
    fontSize: 23,
    fontWeight: 700,
    letterSpacing: '-0.8px',
    lineHeight: '28px',
    margin: 0,
  },
  brandCaption: {
    color: '#c9f2d6',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '1.5px',
    lineHeight: '14px',
    margin: '3px 0 0',
  },
  content: { padding: '34px 32px 30px' },
  eyebrow: {
    color: '#47745b',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '1.3px',
    lineHeight: '16px',
    margin: '0 0 11px',
  },
  heading: {
    color: '#17261d',
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: '-0.8px',
    lineHeight: '34px',
    margin: '0 0 12px',
  },
  description: {
    color: '#58685e',
    fontSize: 15,
    lineHeight: '24px',
    margin: '0 0 22px',
  },
  buttonSection: { margin: '0 0 21px' },
  button: {
    backgroundColor: '#014733',
    borderRadius: 9,
    color: '#ffffff',
    display: 'inline-block',
    fontSize: 15,
    fontWeight: 700,
    lineHeight: '20px',
    padding: '14px 20px',
    textAlign: 'center',
    textDecoration: 'none',
  },
  fallbackLabel: {
    color: '#68766e',
    fontSize: 12,
    lineHeight: '18px',
    margin: '0 0 5px',
  },
  fallbackLink: {
    color: '#176343',
    fontSize: 12,
    lineHeight: '19px',
    overflowWrap: 'anywhere',
    textDecoration: 'underline',
  },
  expiration: {
    color: '#68766e',
    fontSize: 12,
    lineHeight: '18px',
    margin: '17px 0 0',
  },
  divider: { borderColor: '#e8ede9', margin: '22px 0 17px' },
  securityNote: {
    color: '#78847c',
    fontSize: 12,
    lineHeight: '19px',
    margin: 0,
  },
  footer: { backgroundColor: '#f8faf8', padding: '17px 32px 20px' },
  footerBrand: {
    color: '#315c42',
    fontSize: 12,
    fontWeight: 700,
    textDecoration: 'none',
  },
  footerText: {
    color: '#8a958d',
    fontSize: 11,
    lineHeight: '17px',
    margin: '4px 0 0',
  },
};
