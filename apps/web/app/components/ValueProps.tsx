import React from 'react';
import { ShieldCheck, Search, MessageSquare, Star } from 'lucide-react';

export default function ValueProps() {
  const props = [
    {
      icon: <ShieldCheck className="w-5 h-5 text-[#02924B]" />,
      title: 'Verified businesses',
      copy: 'We verify businesses for a safer and more trusted experience.',
    },
    {
      icon: <Search className="w-5 h-5 text-[#02924B]" />,
      title: 'Easy search & filters',
      copy: 'Find exactly what you need, quickly and easily.',
    },
    {
      icon: <MessageSquare className="w-5 h-5 text-[#02924B]" />,
      title: 'Direct communication',
      copy: 'Message businesses, ask questions, and get the info you need.',
    },
    {
      icon: <Star className="w-5 h-5 text-[#02924B]" />,
      title: 'Real reviews',
      copy: 'See what others are saying before you make a decision.',
    },
  ];

  return (
    <section className="px-4 py-14 sm:px-6 sm:py-18">
      <div className="mx-auto max-w-[1240px] rounded-[28px] border border-[#d8ebdf] bg-[#F2F3F0] px-6 py-9 sm:px-10 sm:py-11">
        <div className="max-w-[560px]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#02924B]">Why Onselli</p>
          <h2 className="mt-3 text-2xl font-bold tracking-[-0.035em] text-[#05291F] sm:text-[30px]">Search and connect with confidence.</h2>
          <p className="mt-3 text-sm leading-6 text-[#577367]">Everything you need to make better local buying decisions, in one trusted place.</p>
        </div>
        <div className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {props.map((p) => (
            <div
              key={p.title}
              className="flex min-h-[190px] flex-col items-start rounded-2xl border border-[#dcece3] bg-white p-5 transition-colors hover:border-[#9ddbb8]"
            >
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-[#e2f5ea]">
                {p.icon}
              </div>
              <h3 className="text-[15px] font-semibold text-[#05291F]">
                {p.title}
              </h3>
              <p className="mt-2 text-[13px] leading-5 text-[#577367]">
                {p.copy}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
