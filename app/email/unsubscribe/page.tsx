import UnsubscribeForm from './UnsubscribeForm';

export default async function EmailUnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  return <main className="grid min-h-screen place-items-center bg-[#f7f8f5] px-6 py-6"><section className="w-[min(100%,520px)] rounded-[18px] border border-[#e2e8e2] bg-white p-[34px] shadow-[0_14px_36px_#183b2510]"><span className="section-kicker">Email preferences</span><h1 className="my-3 text-[26px] font-bold text-[#203329]">Unsubscribe from marketing emails</h1><p className="text-[13px] leading-[1.6] text-[#718077]">This affects promotional emails from this creator. It does not change account or purchase notifications.</p><UnsubscribeForm token={token}/></section></main>;
}
