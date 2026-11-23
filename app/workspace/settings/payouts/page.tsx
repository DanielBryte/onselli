import { CreditCard } from 'lucide-react';
import { requireCreator } from '@/src/server/auth/permissions';
import PayoutMethods from '../../payouts/PayoutMethods';
import SettingsLayout from '../SettingsLayout';

export default async function CreatorPayoutSettingsPage() {
  const { creator } = await requireCreator();
  return <SettingsLayout section="payouts">
    <section className="settings-section" id="payout-methods">
      <div className="settings-section__heading"><span><CreditCard size={18}/></span><div><h2>Payout destination</h2><p>Add a bank account and track its verification status before withdrawing.</p></div></div>
      <PayoutMethods country={creator.countryCode ?? 'NG'}/>
    </section>
  </SettingsLayout>;
}
