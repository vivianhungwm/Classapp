import React from 'react';
import { Upload } from 'lucide-react';
import { ActiveView } from '../types/classroom';

interface HeaderProps {
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
  onTriggerCsvUpload: () => void;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  studentCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onChangeView,
  onTriggerCsvUpload,
  isFocusMode,
  onToggleFocusMode,
  studentCount,
}) => {
  const navItems: { id: ActiveView; label: string }[] = [
    { id: 'picker', label: '隨機抽籤' },
    { id: 'groups', label: '自動分組' },
    { id: 'roster', label: `名單管理（${studentCount}）` },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => onChangeView('picker')}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 rounded"
        >
          課堂抽籤分組
        </button>

        {/* Zone 2: Clean Single-Line Text Navigation */}
        <nav className="flex items-center gap-5 sm:gap-8 overflow-x-auto" aria-label="主要功能導覽">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChangeView(item.id);
                  if (item.id === 'roster' && isFocusMode) {
                    onToggleFocusMode();
                  }
                }}
                className={`relative py-5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 rounded-sm ${
                  isActive
                    ? 'text-sky-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 rounded-full"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onTriggerCsvUpload}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 min-h-[40px]"
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            <span>上傳 CSV</span>
          </button>
        </div>
      </div>
    </header>
  );
};
