import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GroupGeneratorStage } from './components/GroupGeneratorStage';
import { Header } from './components/Header';
import { RandomPickerStage } from './components/RandomPickerStage';
import { RosterPanel } from './components/RosterPanel';
import { ActiveView, DrawRecord, ParsedCsvPreview, Student } from './types/classroom';
import {
  buildCsvPreview,
  createStudentsFromNames,
  decodeCsvFile,
  SAMPLE_STUDENT_NAMES,
} from './utils/rosterParser';
import { soundEngine } from './utils/soundEffects';

const STORAGE_KEYS = {
  STUDENTS: 'classroom_toolkit_students_v1',
  INITIALIZED: 'classroom_toolkit_initialized_v1',
  ALLOW_REPEAT: 'classroom_toolkit_allow_repeat_v1',
  SOUND_ENABLED: 'classroom_toolkit_sound_v1',
};

function loadInitialStudents(): Student[] {
  try {
    const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    const saved = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is Student =>
            Boolean(item && typeof item.id === 'string' && typeof item.name === 'string')
        );
      }
    }
    if (!initialized) {
      return createStudentsFromNames(SAMPLE_STUDENT_NAMES);
    }
  } catch {
    // Fallback to sample list if storage unavailable
  }
  return createStudentsFromNames(SAMPLE_STUDENT_NAMES);
}

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('picker');
  const [students, setStudents] = useState<Student[]>(loadInitialStudents);
  const [allowRepeat, setAllowRepeat] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.ALLOW_REPEAT) === 'true';
    } catch {
      return false;
    }
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  });
  const [drawnIds, setDrawnIds] = useState<string[]>([]);
  const [drawHistory, setDrawHistory] = useState<DrawRecord[]>([]);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [csvPreview, setCsvPreview] = useState<ParsedCsvPreview | null>(null);

  const globalCsvInputRef = useRef<HTMLInputElement | null>(null);

  // Persist roster & preferences
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    } catch {
      // Ignore storage quota errors
    }
  }, [students]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ALLOW_REPEAT, String(allowRepeat));
    } catch {
      // Ignore
    }
  }, [allowRepeat]);

  useEffect(() => {
    soundEngine.setEnabled(soundEnabled);
    try {
      localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(soundEnabled));
    } catch {
      // Ignore
    }
  }, [soundEnabled]);

  const handleReplaceStudents = useCallback((names: string[]) => {
    const nextStudents = createStudentsFromNames(names);
    setStudents(nextStudents);
    setDrawnIds([]);
    setDrawHistory([]);
  }, []);

  const handleAppendStudents = useCallback((names: string[]) => {
    const appended = createStudentsFromNames(names);
    setStudents((prev) => [...prev, ...appended]);
  }, []);

  const handleRemoveStudent = useCallback((id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
    setDrawnIds((prev) => prev.filter((dId) => dId !== id));
  }, []);

  const handleClearStudents = useCallback(() => {
    setStudents([]);
    setDrawnIds([]);
    setDrawHistory([]);
  }, []);

  const handleDeduplicateCurrentStudents = useCallback((): number => {
    const seen = new Set<string>();
    const next: Student[] = [];
    let removedCount = 0;
    for (const stu of students) {
      if (seen.has(stu.name)) {
        removedCount += 1;
      } else {
        seen.add(stu.name);
        next.push(stu);
      }
    }
    if (removedCount > 0) {
      const keptIds = new Set(next.map((s) => s.id));
      setStudents(next);
      setDrawnIds((prev) => prev.filter((id) => keptIds.has(id)));
    }
    return removedCount;
  }, [students]);

  const handleLoadSampleRoster = useCallback(() => {
    handleReplaceStudents(SAMPLE_STUDENT_NAMES);
  }, [handleReplaceStudents]);

  const handleRecordDraw = useCallback(
    (student: Student) => {
      if (!allowRepeat) {
        setDrawnIds((prev) => (prev.includes(student.id) ? prev : [...prev, student.id]));
      }
      const now = new Date();
      const timeStr = now.toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      setDrawHistory((prev) => [
        {
          recordId: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          student,
          round: prev.length + 1,
          timestamp: timeStr,
        },
        ...prev,
      ]);
    },
    [allowRepeat]
  );

  const handleReturnStudentToPool = useCallback((studentId: string, recordId: string) => {
    setDrawnIds((prev) => prev.filter((id) => id !== studentId));
    setDrawHistory((prev) => prev.filter((rec) => rec.recordId !== recordId));
  }, []);

  const handleResetPool = useCallback(() => {
    setDrawnIds([]);
    setDrawHistory([]);
  }, []);

  const handleGlobalCsvSelected = async (file: File) => {
    try {
      const content = await decodeCsvFile(file);
      const preview = buildCsvPreview(file.name, content);
      if (preview.rows.length === 0) return;

      setCsvPreview(preview);
      // Ensure the RosterPanel is visible so the teacher can inspect preview & duplicates
      if (isFocusMode) {
        setIsFocusMode(false);
      }
      if (window.innerWidth < 1024) {
        setActiveView('roster');
      }
    } catch {
      // Handled gracefully
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <input
        ref={globalCsvInputRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleGlobalCsvSelected(file);
          }
          e.target.value = '';
        }}
      />

      <Header
        activeView={activeView}
        onChangeView={setActiveView}
        onTriggerCsvUpload={() => globalCsvInputRef.current?.click()}
        isFocusMode={isFocusMode}
        onToggleFocusMode={() => setIsFocusMode((f) => !f)}
        studentCount={students.length}
      />

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeView === 'roster' ? (
          <RosterPanel
            students={students}
            onReplaceStudents={handleReplaceStudents}
            onAppendStudents={handleAppendStudents}
            onRemoveStudent={handleRemoveStudent}
            onDeduplicateCurrentStudents={handleDeduplicateCurrentStudents}
            onClearStudents={handleClearStudents}
            csvPreview={csvPreview}
            onSetCsvPreview={setCsvPreview}
            isFullPage
          />
        ) : (
          <div className="flex flex-col lg:flex-row items-start gap-6">
            {/* Left Sidebar: Always-accessible Roster Source on Desktop unless in Focus Mode */}
            {!isFocusMode && (
              <aside
                className="hidden lg:block w-[350px] xl:w-[370px] shrink-0"
                aria-label="班級名單側邊欄"
              >
                <RosterPanel
                  students={students}
                  onReplaceStudents={handleReplaceStudents}
                  onAppendStudents={handleAppendStudents}
                  onRemoveStudent={handleRemoveStudent}
                  onDeduplicateCurrentStudents={handleDeduplicateCurrentStudents}
                  onClearStudents={handleClearStudents}
                  csvPreview={csvPreview}
                  onSetCsvPreview={setCsvPreview}
                />
              </aside>
            )}

            {/* Main Interactive Stage */}
            <section className="flex-1 min-w-0 w-full">
              {activeView === 'picker' ? (
                <RandomPickerStage
                  students={students}
                  allowRepeat={allowRepeat}
                  onChangeAllowRepeat={setAllowRepeat}
                  drawnIds={drawnIds}
                  onRecordDraw={handleRecordDraw}
                  onReturnStudentToPool={handleReturnStudentToPool}
                  onResetPool={handleResetPool}
                  drawHistory={drawHistory}
                  soundEnabled={soundEnabled}
                  onToggleSound={() => setSoundEnabled((s) => !s)}
                  isFocusMode={isFocusMode}
                  onToggleFocusMode={() => setIsFocusMode((f) => !f)}
                  onGoToRoster={() => setActiveView('roster')}
                  onLoadSampleRoster={handleLoadSampleRoster}
                />
              ) : (
                <GroupGeneratorStage
                  students={students}
                  isFocusMode={isFocusMode}
                  onToggleFocusMode={() => setIsFocusMode((f) => !f)}
                  onGoToRoster={() => setActiveView('roster')}
                  onLoadSampleRoster={handleLoadSampleRoster}
                />
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
