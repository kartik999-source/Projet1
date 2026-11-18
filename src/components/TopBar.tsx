import React from 'react';
import { WorkspaceTab } from '../types/domain';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onPrimaryAction: () => void;
}

const NAV_ITEMS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'matchmaker', label: 'Matchmaker' },
  { id: 'student', label: 'Student Hub' },
  { id: 'tnp', label: 'T&P Cell' },
  { id: 'sprint', label: 'Sprint & PPO' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onPrimaryAction,
}) => {
  return (
    <header className="md:sticky md:top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm no-print">
      <div className="mx-auto flex max-w-[1400px] flex-wrap md:flex-nowrap items-center justify-between gap-y-2 gap-x-4 md:gap-8 px-4 py-3 sm:px-6">
        <a
          href="#matchmaker"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('matchmaker');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          SetuMatch
        </a>

        <div className="order-2 md:order-3 flex items-center shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="rounded-lg bg-blue-700 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 whitespace-nowrap shrink-0"
          >
            New Requirement
          </button>
        </div>

        <nav
          aria-label="Primary workspaces"
          className="order-3 md:order-2 flex w-full md:w-auto items-center justify-between md:justify-center gap-2 sm:gap-7 border-t border-slate-100 pt-2 md:border-t-0 md:pt-0"
        >
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative py-1.5 text-xs sm:text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded ${
                  active
                    ? 'text-blue-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-2 md:-bottom-[15px] h-0.5 bg-blue-700"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
