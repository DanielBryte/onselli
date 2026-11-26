import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CircleDollarSign,
  ChevronDown,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  Package,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Rocket,
  Share,
  Square,
  Users,
  Wallet,
  Store,
  Settings,
  Image as ImageIcon,
} from 'lucide-react';
import Logo from '@/app/components/Logo';
import { WorkspaceAvatar } from '@/app/components/WorkspaceAvatar';

const navigation = [
  { label: 'Overview', icon: LayoutDashboard, active: true },
  { label: 'Notifications', icon: Bell },
  { label: 'Sales', icon: CircleDollarSign },
  { label: 'Products', icon: Package },
  { label: 'Analytics', icon: BarChart3 },
  { label: 'Wallet & Payouts', icon: Wallet },
  { label: 'Contacts', icon: Users, expandable: true },
  { label: 'Marketing', icon: Mail, expandable: true },
  { label: 'Media Library', icon: ImageIcon },
  { label: 'Website & Storefront', icon: Store },
];

export default function HeroDashboardPreview() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white text-ink">
      {/* Browser chrome mirrors the public storefront preview. */}
      <div className="grid h-[58px] shrink-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-[clamp(12px,2vw,30px)] border-b border-[#dfe3df] bg-[#f3f4f2] px-5 text-[#77817a] max-[520px]:h-10 max-[520px]:grid-cols-[auto_minmax(0,1fr)_auto] max-[520px]:gap-2.5 max-[520px]:px-2.5" aria-hidden="true">
        <span className="flex gap-[5px]"><i className="size-[7px] rounded-full bg-[#ff6058] shadow-[inset_0_0_0_1px_rgba(0,0,0,.1)]"/><i className="size-[7px] rounded-full bg-[#ffbd2e] shadow-[inset_0_0_0_1px_rgba(0,0,0,.1)]"/><i className="size-[7px] rounded-full bg-[#28c840] shadow-[inset_0_0_0_1px_rgba(0,0,0,.1)]"/></span>
        <span className="flex items-center gap-5 max-[520px]:hidden"><ChevronLeft size={14}/><ChevronRight size={14}/></span>
        <span className="grid h-[36px] min-w-0 grid-cols-[1fr_auto_1fr] items-center rounded-[10px] border border-[#dfe3df] bg-white px-3 max-[520px]:h-[26px] max-[520px]:grid-cols-[auto_minmax(0,1fr)_auto] max-[520px]:px-2"><LockKeyhole className="justify-self-end max-[520px]:justify-self-start" size={11}/><span className="mx-3 inline-flex h-[30px] min-w-0 items-center justify-center rounded-full border border-[#e5ebe6] px-4 text-[11px] text-[#657169] max-[520px]:mx-1.5 max-[520px]:h-[22px] max-[520px]:px-2 max-[520px]:text-[8px]">onselli.com/workspace</span><RefreshCw className="justify-self-start max-[520px]:size-[11px]" size={13}/></span>
        <span className="flex items-center gap-5 max-[520px]:gap-2.5"><Share className="max-[520px]:size-[12px]" size={15}/><Plus className="max-[520px]:size-[12px]" size={16}/><Square className="max-[520px]:size-[12px]" size={15}/></span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[166px_minmax(0,1fr)] max-[760px]:grid-cols-1">
        <aside className="flex min-h-0 flex-col border-r border-border-subtle bg-white px-3 py-3 max-[760px]:hidden" aria-label="Creator workspace navigation">
          <div className="mb-3 flex items-center justify-between border-b border-border-subtle px-1 pb-3"><Logo className="gap-2 [&_.onselli-logo-mark]:size-8 [&_.onselli-logo-mark]:rounded-lg [&_strong]:text-[17px] [&_strong]:tracking-[-.04em]"/><PanelLeftClose className="text-ink-secondary" size={15}/></div>
          <div className="mb-3 flex min-h-12 items-center gap-2 rounded-xl border border-border px-2 py-2"><WorkspaceAvatar fallbackSeed="danielbryte" className="!h-8 !w-8 !basis-8 shrink-0 rounded-lg"/><strong className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-[-.03em] text-ink">danielbryte</strong><ChevronRight size={15} className="shrink-0 text-ink"/></div>
          <nav className="grid gap-1">{navigation.map(({ label, icon: Icon, active, expandable }) => <span key={label} className={`flex h-[29px] items-center gap-2 rounded-lg px-2 text-[9px] font-medium ${active ? 'bg-[#edf3f0] text-ink' : 'text-ink-secondary'}`}><Icon size={15} strokeWidth={1.9}/><span className="min-w-0 flex-1 truncate">{label}</span>{expandable && <ChevronDown size={12}/>}</span>)}</nav>
          <div className="mt-auto grid gap-1 pt-3"><span className="flex h-7 items-center gap-2 px-2 text-[9px] font-medium text-ink-secondary"><CircleHelp size={14}/>Support</span><span className="flex h-7 items-center gap-2 px-2 text-[9px] font-medium text-ink-secondary"><Settings size={14}/>Settings</span><span className="mt-1 flex h-9 items-center justify-center gap-2 rounded-full bg-brand px-2 text-[9px] font-semibold text-white"><Rocket size={14}/>Grow your business with Pro</span></div>
        </aside>

        <div className="min-w-0 overflow-hidden bg-white">
          <div className="flex h-[42px] items-center border-b border-border-subtle px-8 max-[760px]:h-9 max-[760px]:px-4 max-[520px]:px-3">
            <div className="flex min-w-0 items-center gap-3 text-[9px] text-muted max-[520px]:text-[8px]"><span>Workspace</span><span>/</span><strong className="font-semibold text-ink">Overview</strong></div>
            <div className="ml-auto hidden items-center gap-2 max-[760px]:flex"><Logo className="gap-1.5 [&_.onselli-logo-mark]:size-6 [&_.onselli-logo-mark]:rounded-md [&_strong]:text-[12px]"/></div>
          </div>

          <div className="min-w-0 overflow-hidden bg-[#fbfcfb] px-8 pb-5 pt-6 max-[760px]:px-4 max-[760px]:pt-4 max-[520px]:px-3 max-[520px]:pb-3 max-[520px]:pt-3">
          <header className="mb-4 flex items-center justify-between gap-3 max-[520px]:mb-2 max-[520px]:items-start">
            <div className="min-w-0"><h2 className="mb-0 mt-0 text-[25px] font-bold leading-[1.05] tracking-[-.045em] text-ink max-[760px]:text-[21px] max-[520px]:text-[17px]">Hi danielbryte,</h2><p className="mb-0 mt-2 text-[10px] text-ink-secondary max-[760px]:mt-1.5 max-[520px]:text-[8px]">Here’s how your business is performing today</p></div>
            <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-white p-1 text-[8px] max-[520px]:gap-0.5 max-[520px]:text-[7px]"><span className="px-1.5 text-ink-secondary max-[520px]:hidden">Currency</span><span className="rounded-md px-2 py-1.5 font-semibold text-ink-secondary max-[520px]:px-1.5">NGN</span><span className="rounded-md bg-brand px-2 py-1.5 font-bold text-white max-[520px]:px-1.5">USD</span></div>
          </header>

          <section className="mb-2.5 grid grid-cols-4 gap-2 max-[760px]:grid-cols-2 max-[520px]:mb-2 max-[520px]:gap-1.5" aria-label="Business summary">
            <Metric label="Revenue · USD" value="$248,500" detail="12.8% vs previous period" positive />
            <Metric label="Total orders" value="38" detail="8.3% vs previous period" positive />
            <Metric label="Available balance" value="$224,075" detail="Ready to withdraw" />
            <Metric label="Pending payout" value="$12,000" detail="In progress" />
          </section>

          <article className="overflow-hidden rounded-[9px] border border-border bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-3 py-2 max-[520px]:px-2 max-[520px]:py-1.5"><div><h3 className="m-0 text-[11px] font-bold text-ink max-[520px]:text-[9px]">Sales overview</h3><p className="m-0 mt-0.5 text-[7px] text-muted max-[520px]:text-[6px]">A little more momentum, every day.</p></div><div className="flex shrink-0 rounded-md border border-border-subtle bg-canvas p-0.5 text-[7px] font-semibold text-muted max-[520px]:text-[6px]"><span className="rounded-[4px] px-1.5 py-1">90 days</span><span className="rounded-[4px] bg-white px-1.5 py-1 text-ink shadow-[0_1px_2px_rgba(0,0,0,.08)]">30 days</span><span className="rounded-[4px] px-1.5 py-1">7 days</span></div></div>
            <div className="flex flex-wrap items-center gap-2 px-3 pt-2 max-[520px]:gap-1.5 max-[520px]:px-2"><strong className="text-[17px] font-bold tracking-[-.04em] tabular-nums text-ink max-[520px]:text-[14px]">$248,500</strong><span className="inline-flex items-center gap-0.5 text-[7px] font-bold text-success"><ArrowUpRight size={10}/> 12.8%</span><span className="ml-auto flex items-center gap-2 text-[7px] text-muted max-[520px]:gap-1 max-[520px]:text-[6px]"><span className="inline-flex items-center gap-1"><i className="size-1.5 rounded-full bg-[#73b68f]"/>Revenue</span><span className="inline-flex items-center gap-1"><i className="size-1.5 rounded-full bg-[#c4dfce]"/>Orders</span></span></div>
            <div className="relative mx-3 mt-1 h-[190px] max-[760px]:h-[165px] max-[520px]:mx-2 max-[520px]:h-[125px]">
              <div className="absolute inset-x-0 top-2 bottom-6 flex flex-col justify-between" aria-hidden="true"><span className="border-t border-dashed border-border-subtle"/><span className="border-t border-dashed border-border-subtle"/><span className="border-t border-dashed border-border-subtle"/></div>
              <svg className="absolute inset-x-0 top-2 h-[calc(100%-24px)] w-full" viewBox="0 0 760 150" preserveAspectRatio="none" role="img" aria-label="Revenue and orders trend over the last 30 days">
                <path d="M8 124 C55 120 70 103 112 110 S174 81 218 91 S273 71 320 82 S378 54 420 62 S474 52 520 56 S575 33 621 45 S688 16 752 21 L752 142 L8 142Z" fill="#dcefe4" opacity=".66"/>
                {[{x:30,h:12},{x:76,h:20},{x:122,h:16},{x:168,h:31},{x:214,h:25},{x:260,h:38},{x:306,h:27},{x:352,h:48},{x:398,h:42},{x:444,h:55},{x:490,h:38},{x:536,h:68},{x:582,h:59},{x:628,h:79},{x:674,h:66},{x:720,h:93}].map((bar) => <rect key={bar.x} x={bar.x} y={142-bar.h} width="11" height={bar.h} rx="3" fill="#c4dfce"/>)}
                <path d="M8 124 C55 120 70 103 112 110 S174 81 218 91 S273 71 320 82 S378 54 420 62 S474 52 520 56 S575 33 621 45 S688 16 752 21" fill="none" stroke="#73b68f" strokeWidth="2.4" vectorEffect="non-scaling-stroke"/>
              </svg>
              <div className="absolute inset-x-0 bottom-1 flex justify-between text-[6px] text-muted"><span>Nov 1</span><span>Nov 8</span><span>Nov 15</span><span>Nov 24</span></div>
            </div>
          </article>

          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, detail, positive = false }: { label: string; value: string; detail: string; positive?: boolean }) {
  return <article className="flex min-h-[90px] min-w-0 flex-col rounded-[9px] border border-border bg-white px-2.5 py-2.5 max-[520px]:min-h-[76px] max-[520px]:px-2 max-[520px]:py-2"><span className="truncate text-[8px] font-semibold text-muted max-[520px]:text-[7px]">{label}</span><strong className="mt-2 truncate text-[17px] font-bold leading-none tracking-[-.04em] tabular-nums text-ink max-[520px]:mt-1.5 max-[520px]:text-[14px]">{value}</strong><small className={`mt-2 flex items-center gap-0.5 truncate text-[7px] leading-none max-[520px]:mt-1.5 max-[520px]:text-[6px] ${positive ? 'font-semibold text-success' : 'text-muted'}`}>{positive ? <ArrowUpRight size={9}/> : null}{detail}</small></article>;
}
