import { eq } from 'drizzle-orm';
import { requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { accounts, users } from '@/src/server/db/schema';
import { getCreatorLogoUrl } from '@/src/server/workspaces/logo';
import ProfileSettings from '../ProfileSettings';
import SettingsLayout from '../SettingsLayout';

export default async function CreatorProfileSettingsPage() {
  const { creator, session } = await requireCreator();
  const db = getDatabase();
  const [linkedAccounts, [appUser]] = await Promise.all([
    db.select({ providerId: accounts.providerId }).from(accounts).where(eq(accounts.userId, session.user.id)),
    db.select({ persona: users.persona }).from(users).where(eq(users.id, session.user.id)).limit(1),
  ]);
  const googleConnected = linkedAccounts.some(account => account.providerId === 'google');
  return <SettingsLayout section="profile">
    <ProfileSettings initialProfile={{ displayName: creator.displayName, slug: creator.slug, headline: creator.headline ?? '', bio: creator.bio ?? '', whatsappE164: creator.whatsappE164 ?? '', timezone: creator.timezone, avatarKey: creator.avatarKey ?? '', avatarUrl: getCreatorLogoUrl(creator.avatarKey), persona: appUser?.persona ?? '' }} email={session.user.email} googleConnected={googleConnected}/>
  </SettingsLayout>;
}
