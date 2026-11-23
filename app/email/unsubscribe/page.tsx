import UnsubscribeForm from './UnsubscribeForm';

export default async function EmailUnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  return <main className="email-unsubscribe"><section><span className="section-kicker">Email preferences</span><h1>Unsubscribe from marketing emails</h1><p>This affects promotional emails from this creator. It does not change account or purchase notifications.</p><UnsubscribeForm token={token}/></section></main>;
}
