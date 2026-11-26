import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  Copy,
  Download,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Shuffle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { GroupPod, RemainderStrategy, Student } from '../types/classroom';
import { exportGroupsToCsv } from '../utils/rosterParser';
import { soundEngine } from '../utils/soundEffects';

interface GroupGeneratorStageProps {
  students: Student[];
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  onGoToRoster: () => void;
  onLoadSampleRoster: () => void;
}

const GROUP_PALETTES = [
  { headerBg: 'bg-sky-50', badgeBg: 'bg-sky-600', barBg: 'bg-sky-500', text: 'text-sky-900' },
  {
    headerBg: 'bg-emerald-50',
    badgeBg: 'bg-emerald-600',
    barBg: 'bg-emerald-500',
    text: 'text-emerald-900',
  },
  {
    headerBg: 'bg-indigo-50',
    badgeBg: 'bg-indigo-600',
    barBg: 'bg-indigo-500',
    text: 'text-indigo-900',
  },
  {
    headerBg: 'bg-amber-50',
    badgeBg: 'bg-amber-600',
    barBg: 'bg-amber-500',
    text: 'text-amber-900',
  },
  {
    headerBg: 'bg-rose-50',
    badgeBg: 'bg-rose-600',
    barBg: 'bg-rose-500',
    text: 'text-rose-900',
  },
  {
    headerBg: 'bg-teal-50',
    badgeBg: 'bg-teal-600',
    barBg: 'bg-teal-500',
    text: 'text-teal-900',
  },
  {
    headerBg: 'bg-violet-50',
    badgeBg: 'bg-violet-600',
    barBg: 'bg-violet-500',
    text: 'text-violet-900',
  },
  {
    headerBg: 'bg-cyan-50',
    badgeBg: 'bg-cyan-600',
    barBg: 'bg-cyan-500',
    text: 'text-cyan-900',
  },
];

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildGroups(
  students: Student[],
  groupSize: number,
  strategy: RemainderStrategy
): GroupPod[] {
  if (students.length === 0) return [];
  const shuffled = shuffleArray(students);
  const safeSize = Math.max(1, Math.min(groupSize, shuffled.length));

  if (shuffled.length <= safeSize) {
    return [
      {
        id: 'group-1',
        index: 1,
        name: '第 1 組',
        members: shuffled,
      },
    ];
  }

  if (strategy === 'separate' || shuffled.length % safeSize === 0) {
    const pods: GroupPod[] = [];
    for (let i = 0; i < shuffled.length; i += safeSize) {
      const idx = pods.length + 1;
      pods.push({
        id: `group-${idx}`,
        index: idx,
        name: `第 ${idx} 組`,
        members: shuffled.slice(i, i + safeSize),
      });
    }
    return pods;
  }

  // Distribute remainder evenly across floor(N / safeSize) groups
  const numGroups = Math.max(1, Math.floor(shuffled.length / safeSize));
  const baseCount = Math.floor(shuffled.length / numGroups);
  const extra = shuffled.length % numGroups;

  const pods: GroupPod[] = [];
  let cursor = 0;
  for (let g = 0; g < numGroups; g += 1) {
    const count = baseCount + (g < extra ? 1 : 0);
    pods.push({
      id: `group-${g + 1}`,
      index: g + 1,
      name: `第 ${g + 1} 組`,
      members: shuffled.slice(cursor, cursor + count),
    });
    cursor += count;
  }
  return pods;
}

export const GroupGeneratorStage: React.FC<GroupGeneratorStageProps> = ({
  students,
  isFocusMode,
  onToggleFocusMode,
  onGoToRoster,
  onLoadSampleRoster,
}) => {
  const [groupSize, setGroupSize] = useState(4);
  const [strategy, setStrategy] = useState<RemainderStrategy>('distribute');
  const [groups, setGroups] = useState<GroupPod[]>([]);
  const [shuffleVersion, setShuffleVersion] = useState(0);
  const [copied, setCopied] = useState(false);
  const [downloadedCsv, setDownloadedCsv] = useState(false);
  const [swapSelection, setSwapSelection] = useState<{
    groupId: string;
    studentId: string;
    studentName: string;
  } | null>(null);

  const maxGroupSize = Math.max(2, students.length);

  // Keep groupSize bounded if roster shrinks
  useEffect(() => {
    if (groupSize > maxGroupSize) {
      setGroupSize(maxGroupSize);
    }
  }, [groupSize, maxGroupSize]);

  // Auto-build initial groups whenever student list changes
  useEffect(() => {
    if (students.length === 0) {
      setGroups([]);
      setSwapSelection(null);
      return;
    }
    setGroups(buildGroups(students, groupSize, strategy));
    setSwapSelection(null);
    // Intentionally regenerate on roster/size/strategy changes for instant visual feedback
  }, [students, groupSize, strategy]);

  const handleReshuffle = useCallback(() => {
    if (students.length === 0) return;
    soundEngine.playShuffle();
    setGroups(buildGroups(students, groupSize, strategy));
    setShuffleVersion((v) => v + 1);
    setSwapSelection(null);
  }, [students, groupSize, strategy]);

  // Live preview summary string
  const breakdownSummary = useMemo(() => {
    const total = students.length;
    if (total === 0) return '尚無學生名單';
    if (groups.length === 0) return '';

    const sizeMap = new Map<number, number>();
    for (const g of groups) {
      const len = g.members.length;
      sizeMap.set(len, (sizeMap.get(len) ?? 0) + 1);
    }
    const parts = Array.from(sizeMap.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([size, count]) => `${size} 人 × ${count} 組`);

    return `共 ${total} 位學生 · 分成 ${groups.length} 組（${parts.join('、')}）`;
  }, [students.length, groups]);

  const hasRemainder = students.length > groupSize && students.length % groupSize !== 0;

  const handleCopyText = async () => {
    if (groups.length === 0) return;
    const text = groups
      .map((g) => `${g.name}（${g.members.length}人）：${g.members.map((m) => m.name).join('、')}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleStudentClick = (groupId: string, student: Student) => {
    if (!swapSelection) {
      setSwapSelection({
        groupId,
        studentId: student.id,
        studentName: student.name,
      });
      return;
    }

    if (swapSelection.studentId === student.id) {
      setSwapSelection(null);
      return;
    }

    // Perform swap between swapSelection and clicked student
    setGroups((prev) => {
      const next = prev.map((g) => ({ ...g, members: [...g.members] }));
      const sourceGroup = next.find((g) => g.id === swapSelection.groupId);
      const targetGroup = next.find((g) => g.id === groupId);
      if (!sourceGroup || !targetGroup) return prev;

      const sourceIdx = sourceGroup.members.findIndex((m) => m.id === swapSelection.studentId);
      const targetIdx = targetGroup.members.findIndex((m) => m.id === student.id);
      if (sourceIdx === -1 || targetIdx === -1) return prev;

      const temp = sourceGroup.members[sourceIdx];
      sourceGroup.members[sourceIdx] = targetGroup.members[targetIdx];
      targetGroup.members[targetIdx] = temp;
      return next;
    });
    setSwapSelection(null);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Group Size Stepper + Presets */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
                每組人數
              </span>
              <div className="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50">
                <button
                  type="button"
                  disabled={groupSize <= 2}
                  onClick={() => setGroupSize((s) => Math.max(2, s - 1))}
                  className="p-2 text-slate-600 hover:text-slate-900 disabled:text-slate-300 cursor-pointer disabled:cursor-not-allowed"
                  aria-label="減少每組人數"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center text-sm font-semibold text-slate-900 tabular-nums">
                  {groupSize} 人
                </span>
                <button
                  type="button"
                  disabled={groupSize >= maxGroupSize}
                  onClick={() => setGroupSize((s) => Math.min(maxGroupSize, s + 1))}
                  className="p-2 text-slate-600 hover:text-slate-900 disabled:text-slate-300 cursor-pointer disabled:cursor-not-allowed"
                  aria-label="增加每組人數"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick preset buttons */}
            <div className="flex items-center gap-1.5" role="group" aria-label="快速人數設定">
              {[2, 3, 4, 5, 6].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={students.length > 0 && preset > students.length}
                  onClick={() => setGroupSize(preset)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap tabular-nums ${
                    groupSize === preset
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  {preset}人組
                </button>
              ))}
            </div>
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={students.length === 0}
              onClick={handleReshuffle}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap min-h-[40px]"
            >
              <Shuffle className="w-4 h-4" aria-hidden="true" />
              <span>重新隨機分組</span>
            </button>

            <button
              type="button"
              disabled={groups.length === 0}
              onClick={handleCopyText}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap min-h-[40px]"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  <span className="text-emerald-700">已複製文字</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <span>複製結果</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={groups.length === 0}
              onClick={() => {
                exportGroupsToCsv(groups);
                setDownloadedCsv(true);
                window.setTimeout(() => setDownloadedCsv(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap min-h-[40px]"
            >
              {downloadedCsv ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  <span className="text-emerald-700">已下載 CSV</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <span>下載 CSV 檔案</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onToggleFocusMode}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
            >
              {isFocusMode ? (
                <>
                  <Minimize2 className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <span>顯示名單欄</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <span>投影專注模式</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Remainder Strategy & Live Breakdown */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium text-slate-600 tabular-nums">{breakdownSummary}</p>

          {hasRemainder && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">無法整除時：</span>
              <div
                className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200/70"
                role="group"
                aria-label="餘數處理方式"
              >
                <button
                  type="button"
                  onClick={() => setStrategy('distribute')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    strategy === 'distribute'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  平均併入各組
                </button>
                <button
                  type="button"
                  onClick={() => setStrategy('separate')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    strategy === 'separate'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  多出另成一組
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Empty State */}
      {students.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">目前尚無學生名單</h3>
          <p className="text-sm text-slate-500">
            請先匯入 CSV 或貼上學生姓名，或點選下方模擬名單快速體驗視覺化自動分組。
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onLoadSampleRoster}
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors cursor-pointer"
            >
              載入模擬名單（24 位）
            </button>
            <button
              type="button"
              onClick={onGoToRoster}
              className="lg:hidden inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              前往匯入名單
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Visual Distribution Bar & Swap Helper */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">各組人數分佈視覺圖</span>
              {swapSelection ? (
                <div className="flex items-center gap-2 text-xs font-medium text-sky-700">
                  <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    已選取「{swapSelection.studentName}」，請點擊另一位學生進行互換
                  </span>
                  <button
                    type="button"
                    onClick={() => setSwapSelection(null)}
                    className="underline text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-400">
                  小技巧：點擊任兩位學生姓名即可手動互換組別
                </span>
              )}
            </div>

            {/* Proportional Bar Visualization */}
            <div
              className="w-full h-7 rounded-lg overflow-hidden flex gap-0.5 bg-slate-100 p-0.5"
              role="img"
              aria-label={`共有 ${groups.length} 組人數分佈長條圖`}
            >
              {groups.map((group, idx) => {
                const palette = GROUP_PALETTES[idx % GROUP_PALETTES.length];
                return (
                  <div
                    key={group.id}
                    style={{ flexGrow: group.members.length }}
                    className={`${palette.barBg} h-full first:rounded-l-md last:rounded-r-md flex items-center justify-center text-[11px] font-semibold text-white tabular-nums px-1 truncate transition-all duration-300`}
                    title={`${group.name}：${group.members.length} 人`}
                  >
                    {group.index}組 ({group.members.length})
                  </div>
                );
              })}
            </div>
          </div>

          {/* Group Pods Grid */}
          <div
            className={`grid gap-4 ${
              isFocusMode
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
            }`}
          >
            {groups.map((group, idx) => {
              const palette = GROUP_PALETTES[idx % GROUP_PALETTES.length];
              return (
                <motion.section
                  key={`${group.id}-${shuffleVersion}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.22,
                    delay: Math.min(idx * 0.035, 0.28),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
                  aria-label={group.name}
                >
                  {/* Group Card Header */}
                  <div
                    className={`${palette.headerBg} px-4 py-3 border-b border-slate-200/80 flex items-center justify-between`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`${palette.badgeBg} text-white text-xs font-mono font-semibold w-6 h-6 rounded-md flex items-center justify-center tabular-nums`}
                      >
                        {String(group.index).padStart(2, '0')}
                      </span>
                      <h3 className={`text-sm font-bold ${palette.text}`}>{group.name}</h3>
                    </div>
                    <span className="text-xs font-medium text-slate-600 tabular-nums">
                      {group.members.length} 位成員
                    </span>
                  </div>

                  {/* Group Members List */}
                  <ul className="divide-y divide-slate-100 p-2 flex-1">
                    {group.members.map((member, mIdx) => {
                      const isSelected = swapSelection?.studentId === member.id;
                      return (
                        <li key={member.id}>
                          <button
                            type="button"
                            onClick={() => handleStudentClick(group.id, member)}
                            className={`w-full px-2.5 py-2 rounded-lg flex items-center justify-between text-left transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-sky-50 ring-1 ring-sky-500 text-sky-900'
                                : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-xs font-mono text-slate-400 tabular-nums w-4 shrink-0">
                                {mIdx + 1}
                              </span>
                              <span
                                className={`font-medium truncate ${
                                  isFocusMode ? 'text-base' : 'text-sm'
                                }`}
                              >
                                {member.name}
                              </span>
                            </div>
                            {isSelected && (
                              <span className="text-[11px] font-medium text-sky-700 shrink-0 ml-2">
                                已選取
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </motion.section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
