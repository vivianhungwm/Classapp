import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { DrawRecord, PickerSpeed, Student } from '../types/classroom';
import { soundEngine } from '../utils/soundEffects';

interface RandomPickerStageProps {
  students: Student[];
  allowRepeat: boolean;
  onChangeAllowRepeat: (val: boolean) => void;
  drawnIds: string[];
  onRecordDraw: (student: Student) => void;
  onReturnStudentToPool: (studentId: string, recordId: string) => void;
  onResetPool: () => void;
  drawHistory: DrawRecord[];
  soundEnabled: boolean;
  onToggleSound: () => void;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  onGoToRoster: () => void;
  onLoadSampleRoster: () => void;
}

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  life: number;
  maxLife: number;
}

const CONFETTI_COLORS = ['#0284C7', '#059669', '#D97706', '#6366F1', '#E11D48', '#0EA5E9'];

export const RandomPickerStage: React.FC<RandomPickerStageProps> = ({
  students,
  allowRepeat,
  onChangeAllowRepeat,
  drawnIds,
  onRecordDraw,
  onReturnStudentToPool,
  onResetPool,
  drawHistory,
  soundEnabled,
  onToggleSound,
  isFocusMode,
  onToggleFocusMode,
  onGoToRoster,
  onLoadSampleRoster,
}) => {
  const [speed, setSpeed] = useState<PickerSpeed>('standard');
  const [isSpinning, setIsSpinning] = useState(false);
  const [displayStudent, setDisplayStudent] = useState<Student | null>(null);
  const [winnerRecord, setWinnerRecord] = useState<{ student: Student; recordId?: string } | null>(
    null
  );
  const [tickKey, setTickKey] = useState(0);

  const timeoutRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const eligibleStudents = useMemo(() => {
    if (allowRepeat) return students;
    const drawnSet = new Set(drawnIds);
    return students.filter((s) => !drawnSet.has(s.id));
  }, [students, allowRepeat, drawnIds]);

  const clearSpinTimeout = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearSpinTimeout();
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Reset displayed winner if roster becomes empty
  useEffect(() => {
    if (students.length === 0) {
      clearSpinTimeout();
      setIsSpinning(false);
      setDisplayStudent(null);
      setWinnerRecord(null);
    }
  }, [students.length]);

  const fireConfetti = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const particles: ConfettiParticle[] = Array.from({ length: 48 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const velocity = 3 + Math.random() * 6.5;
      return {
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 2.5,
        size: 5 + Math.random() * 5,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.25,
        life: 0,
        maxLife: 55 + Math.random() * 25,
      };
    });

    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
    }

    const render = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      let aliveCount = 0;

      for (const p of particles) {
        p.life += 1;
        if (p.life >= p.maxLife) continue;
        aliveCount += 1;

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.18; // gentle gravity
        p.vx *= 0.985;
        p.rotation += p.vRot;

        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
        ctx.restore();
      }

      if (aliveCount > 0) {
        animFrameRef.current = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, rect.width, rect.height);
      }
    };

    animFrameRef.current = requestAnimationFrame(render);
  }, []);

  const handleStartDraw = useCallback(() => {
    if (isSpinning || eligibleStudents.length === 0) return;

    // Pick final winner using uniform random selection
    const finalIndex = Math.floor(Math.random() * eligibleStudents.length);
    const chosenStudent = eligibleStudents[finalIndex];

    setIsSpinning(true);
    setWinnerRecord(null);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setDisplayStudent(chosenStudent);
      setWinnerRecord({ student: chosenStudent });
      setIsSpinning(false);
      soundEngine.playReveal();
      onRecordDraw(chosenStudent);
      return;
    }

    const totalSteps =
      eligibleStudents.length === 1 ? 6 : speed === 'fast' ? 12 : 22;
    let currentStep = 0;
    let lastShownId = displayStudent?.id ?? '';

    const runStep = () => {
      currentStep += 1;
      const progress = currentStep / totalSteps;

      if (currentStep >= totalSteps) {
        setDisplayStudent(chosenStudent);
        setTickKey((k) => k + 1);
        setWinnerRecord({ student: chosenStudent });
        setIsSpinning(false);
        soundEngine.playReveal();
        fireConfetti();
        onRecordDraw(chosenStudent);
        return;
      }

      // Pick a random candidate for visual cycling (avoiding exact repeat back-to-back)
      let candidate = eligibleStudents[Math.floor(Math.random() * eligibleStudents.length)];
      if (eligibleStudents.length > 1 && candidate.id === lastShownId) {
        const others = eligibleStudents.filter((s) => s.id !== lastShownId);
        candidate = others[Math.floor(Math.random() * others.length)];
      }
      lastShownId = candidate.id;

      setDisplayStudent(candidate);
      setTickKey((k) => k + 1);
      soundEngine.playTick(progress);

      // Ease-out deceleration curve for suspense
      const minDelay = speed === 'fast' ? 40 : 48;
      const maxDelay = speed === 'fast' ? 190 : 340;
      const delay = minDelay + Math.pow(progress, 2.35) * (maxDelay - minDelay);

      timeoutRef.current = window.setTimeout(runStep, delay);
    };

    runStep();
  }, [
    isSpinning,
    eligibleStudents,
    speed,
    displayStudent?.id,
    fireConfetti,
    onRecordDraw,
  ]);

  // Allow Spacebar shortcut when viewing the picker stage
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'BUTTON' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      handleStartDraw();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleStartDraw]);

  const latestHistoryRecord = drawHistory[0];

  const handleReturnLatestAbsent = () => {
    if (!winnerRecord || !latestHistoryRecord) return;
    if (latestHistoryRecord.student.id !== winnerRecord.student.id) return;
    onReturnStudentToPool(winnerRecord.student.id, latestHistoryRecord.recordId);
    setWinnerRecord(null);
    setDisplayStudent(null);
  };

  return (
    <div className="space-y-6">
      {/* Stage Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-600 tabular-nums">
          <span>名單共 {students.length} 位</span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          {allowRepeat ? (
            <span>模式：允許重複抽取</span>
          ) : (
            <>
              <span className="font-medium text-slate-900">
                待抽 {eligibleStudents.length} 位
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span>已抽 {students.length - eligibleStudents.length} 位</span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Repeat vs No-Repeat Segmented Control */}
          <div
            className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200/70"
            role="group"
            aria-label="抽籤重複規則設定"
          >
            <button
              type="button"
              disabled={isSpinning}
              onClick={() => onChangeAllowRepeat(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                !allowRepeat
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              不重複抽取
            </button>
            <button
              type="button"
              disabled={isSpinning}
              onClick={() => onChangeAllowRepeat(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                allowRepeat
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              允許重複抽取
            </button>
          </div>

          {/* Animation Speed Control */}
          <div
            className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200/70"
            role="group"
            aria-label="動畫節奏"
          >
            <button
              type="button"
              disabled={isSpinning}
              onClick={() => setSpeed('standard')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                speed === 'standard'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              標準節奏
            </button>
            <button
              type="button"
              disabled={isSpinning}
              onClick={() => setSpeed('fast')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                speed === 'fast'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              快速模式
            </button>
          </div>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={onToggleSound}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              soundEnabled
                ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-700'
            }`}
            aria-pressed={soundEnabled}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-sky-600" aria-hidden="true" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" aria-hidden="true" />
            )}
            <span>{soundEnabled ? '音效開啟' : '已靜音'}</span>
          </button>

          {/* Focus / Projector View Toggle */}
          <button
            type="button"
            onClick={onToggleFocusMode}
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title={isFocusMode ? '顯示左側名單面板' : '隱藏左側面板，放大抽籤舞台'}
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

      {/* Main Spotlight Card */}
      <div className="relative overflow-hidden bg-white border border-slate-200 rounded-2xl px-6 py-12 sm:py-16 flex flex-col items-center justify-center text-center min-h-[360px] sm:min-h-[400px]">
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 w-full h-full z-10"
          aria-hidden="true"
        />

        {students.length === 0 ? (
          <div className="relative z-20 max-w-md space-y-4">
            <h3 className="text-xl font-semibold text-slate-900">目前尚無學生名單</h3>
            <p className="text-sm text-slate-500">
              請先於左側匯入 CSV 或貼上學生姓名，或點選下方模擬名單快速體驗課堂隨機抽籤。
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
          <div className="relative z-20 w-full max-w-2xl flex flex-col items-center space-y-8">
            {/* Stage State Kicker */}
            <div className="h-6 flex items-center justify-center">
              {isSpinning ? (
                <span className="text-sm font-medium text-sky-700 tracking-wide">
                  正在隨機抽取中...
                </span>
              ) : winnerRecord ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  <span>本次抽中學生</span>
                </span>
              ) : eligibleStudents.length === 0 && !allowRepeat ? (
                <span className="text-sm font-medium text-amber-700">
                  本輪所有學生皆已抽過，請重置名單後繼續
                </span>
              ) : (
                <span className="text-sm text-slate-500">
                  按下「開始抽籤」隨機選出一名學生
                </span>
              )}
            </div>

            {/* Name Spotlight Slot */}
            <div className="w-full min-h-[112px] sm:min-h-[132px] flex items-center justify-center px-4">
              <AnimatePresence mode="popLayout">
                {displayStudent ? (
                  <motion.div
                    key={`${displayStudent.id}-${tickKey}`}
                    initial={
                      isSpinning
                        ? { y: 18, opacity: 0.45, scale: 0.96 }
                        : { scale: 0.88, opacity: 0.7 }
                    }
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={isSpinning ? { y: -18, opacity: 0.35 } : { opacity: 0 }}
                    transition={
                      isSpinning
                        ? { duration: 0.08, ease: 'easeOut' }
                        : { type: 'spring', stiffness: 380, damping: 22 }
                    }
                    className={`font-bold tracking-tight select-none break-words max-w-full ${
                      isFocusMode
                        ? 'text-6xl sm:text-7xl lg:text-8xl'
                        : 'text-5xl sm:text-6xl lg:text-7xl'
                    } ${winnerRecord ? 'text-slate-900' : 'text-slate-700'}`}
                  >
                    {displayStudent.name}
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle-placeholder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-3xl sm:text-4xl font-semibold text-slate-300 select-none"
                  >
                    等待抽籤
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-wrap items-center justify-center gap-3">
                {eligibleStudents.length === 0 && !allowRepeat ? (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playReset();
                      setDisplayStudent(null);
                      setWinnerRecord(null);
                      onResetPool();
                    }}
                    className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 rounded-xl transition-colors cursor-pointer min-h-[52px]"
                  >
                    <RotateCcw className="w-5 h-5" aria-hidden="true" />
                    <span>重置待抽名單（{students.length} 位）</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSpinning}
                    onClick={handleStartDraw}
                    className="inline-flex items-center gap-2.5 px-9 py-3.5 text-base font-semibold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:bg-sky-400 rounded-xl transition-colors cursor-pointer disabled:cursor-wait min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
                  >
                    <Sparkles className="w-5 h-5" aria-hidden="true" />
                    <span>
                      {isSpinning
                        ? '抽取中...'
                        : winnerRecord
                          ? '再抽下一位'
                          : '開始抽籤'}
                    </span>
                  </button>
                )}

                {!isSpinning &&
                  !allowRepeat &&
                  winnerRecord &&
                  latestHistoryRecord?.student.id === winnerRecord.student.id && (
                    <button
                      type="button"
                      onClick={handleReturnLatestAbsent}
                      className="inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer min-h-[52px]"
                    >
                      <Undo2 className="w-4 h-4" aria-hidden="true" />
                      <span>未出席，放回名單</span>
                    </button>
                  )}
              </div>

              <p className="text-xs text-slate-400">
                快捷鍵提示：按空白鍵（Space）可直接開始抽籤
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Lower Pool & History Section */}
      {students.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Drawn History */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">抽籤紀錄</h3>
                <span className="text-xs text-slate-400 tabular-nums">
                  {drawHistory.length} 筆
                </span>
              </div>
              {(drawHistory.length > 0 || drawnIds.length > 0) && (
                <button
                  type="button"
                  disabled={isSpinning}
                  onClick={() => {
                    soundEngine.playReset();
                    setDisplayStudent(null);
                    setWinnerRecord(null);
                    onResetPool();
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>清除並重置名單</span>
                </button>
              )}
            </div>

            {drawHistory.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                尚無抽籤紀錄
              </p>
            ) : (
              <ol className="divide-y divide-slate-100 max-h-[240px] overflow-y-auto mt-1">
                {drawHistory.map((record) => (
                  <li
                    key={record.recordId}
                    className="py-2.5 flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-slate-400 tabular-nums w-7 shrink-0">
                        #{String(record.round).padStart(2, '0')}
                      </span>
                      <span className="font-medium text-slate-900 truncate">
                        {record.student.name}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 tabular-nums shrink-0">
                      {record.timestamp}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Remaining Pool */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">
                {allowRepeat ? '目前可抽名單' : '尚未抽中名單'}
              </h3>
              <span className="text-xs text-slate-500 tabular-nums">
                {eligibleStudents.length} / {students.length} 位
              </span>
            </div>

            {eligibleStudents.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                本輪名單已全數抽完
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 max-h-[240px] overflow-y-auto">
                {eligibleStudents.map((student) => (
                  <div
                    key={student.id}
                    className="py-1.5 px-2 text-sm text-slate-700 bg-slate-50 rounded-md truncate"
                    title={student.name}
                  >
                    {student.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
