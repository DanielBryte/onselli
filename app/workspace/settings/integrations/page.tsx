import { ArrowRight, PlugZap } from 'lucide-react';
import SettingsLayout from '../SettingsLayout';

export default function WorkspaceIntegrationsPage() {
  return <SettingsLayout section="integrations">
    <section className="creator-integration-empty" aria-labelledby="integrations-empty-title"><span><PlugZap size={21}/></span><h2 id="integrations-empty-title">No integrations connected</h2><p>There aren’t any external integrations available for this workspace yet. If you need help connecting a tool, our support team can help.</p><a href="mailto:support@onselli.com?subject=Workspace%20integrations">Contact support <ArrowRight size={15}/></a></section>
  </SettingsLayout>;
}
