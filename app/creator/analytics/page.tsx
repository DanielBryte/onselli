import { redirect } from 'next/navigation';

// Keep older bookmarks and links pointed at the current workspace analytics page.
export default function LegacyCreatorAnalyticsPage() {
  redirect('/workspace/analytics');
}
