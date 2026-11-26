import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  FileSpreadsheet,
  ListChecks,
  Plus,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { ParsedCsvPreview, Student } from '../types/classroom';
import {
  buildCsvPreview,
  decodeCsvFile,
  deduplicateNames,
  extractNamesFromCsvPreview,
  findDuplicateCounts,
  parsePastedNames,
  SAMPLE_STUDENT_NAMES,
} from '../utils/rosterParser';

interface RosterPanelProps {
  students: Student[];
  onReplaceStudents: (names: string[]) => void;
  onAppendStudents: (names: string[]) => void;
  onRemoveStudent: (id: string) => void;
  onDeduplicateCurrentStudents: () => number;
  onClearStudents: () => void;
  csvPreview: ParsedCsvPreview | null;
  onSetCsvPreview: (preview: ParsedCsvPreview | null) => void;
  isFullPage?: boolean;
}

export const RosterPanel: React.FC<RosterPanelProps> = ({
  students,
  onReplaceStudents,
  onAppendStudents,
  onRemoveStudent,
  onDeduplicateCurrentStudents,
  onClearStudents,
  csvPreview,
  onSetCsvPreview,
  isFullPage = false,
}) => {
  const [pasteText, setPasteText] = useState('');
  const [singleName, setSingleName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // CSV Preview state
  const [selectedCol, setSelectedCol] = useState(0);
  const [skipHeader, setSkipHeader] = useState(true);
  const [csvPreviewNames, setCsvPreviewNames] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (csvPreview) {
      setSelectedCol(csvPreview.detectedColumnIndex);
      setSkipHeader(csvPreview.hasHeader);
    } else {
      setCsvPreviewNames([]);
    }
  }, [csvPreview]);

  useEffect(() => {
    if (!csvPreview) return;
    const extracted = extractNamesFromCsvPreview(csvPreview, selectedCol, skipHeader, false);
    setCsvPreviewNames(extracted);
  }, [csvPreview, selectedCol, skipHeader]);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    window.setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  // Duplicate analysis for CSV preview
  const csvDuplicateCounts = useMemo(
    () => findDuplicateCounts(csvPreviewNames),
    [csvPreviewNames]
  );
  const csvExtraDuplicateCount = useMemo(() => {
    let extra = 0;
    for (const count of csvDuplicateCounts.values()) {
      extra += count - 1;
    }
    return extra;
  }, [csvDuplicateCounts]);

  // Duplicate analysis for Paste preview
  const pastedPreviewNames = useMemo(
    () => (pasteText.trim() ? parsePastedNames(pasteText, false) : []),
    [pasteText]
  );
  const pastedDuplicateCounts = useMemo(
    () => findDuplicateCounts(pastedPreviewNames),
    [pastedPreviewNames]
  );
  const pastedExtraDuplicateCount = useMemo(() => {
    let extra = 0;
    for (const count of pastedDuplicateCounts.values()) {
      extra += count - 1;
    }
    return extra;
  }, [pastedDuplicateCounts]);

  // Duplicate analysis for current active roster
  const rosterDuplicateCounts = useMemo(
    () => findDuplicateCounts(students.map((s) => s.name)),
    [students]
  );
  const rosterExtraDuplicateCount = useMemo(() => {
    let extra = 0;
    for (const count of rosterDuplicateCounts.values()) {
      extra += count - 1;
    }
    return extra;
  }, [rosterDuplicateCounts]);

  const handleFile = async (file: File) => {
    if (
      !file.name.toLowerCase().endsWith('.csv') &&
      !file.type.includes('csv') &&
      !file.type.includes('text')
    ) {
      showNotice('error', '請上傳 .csv 或純文字格式的檔案。');
      return;
    }

    try {
      const content = await decodeCsvFile(file);
      const preview = buildCsvPreview(file.name, content);
      if (preview.rows.length === 0) {
        showNotice('error', '檔案內容為空，請確認後再試。');
        return;
      }
      setSelectedCol(preview.detectedColumnIndex);
      setSkipHeader(preview.hasHeader);
      onSetCsvPreview(preview);
    } catch {
      showNotice('error', '讀取檔案時發生錯誤，請確認檔案未損毀。');
    }
  };

  const handleRemoveCsvDuplicates = () => {
    const { unique, removedCount } = deduplicateNames(csvPreviewNames);
    setCsvPreviewNames(unique);
    showNotice('success', `已移除預覽中 ${removedCount} 筆重複姓名，保留 ${unique.length} 位。`);
  };

  const handleConfirmCsvImport = (mode: 'replace' | 'append') => {
    if (!csvPreview) return;
    if (csvPreviewNames.length === 0) {
      showNotice('error', '所選欄位沒有可匯入的姓名資料。');
      return;
    }
    if (mode === 'replace') {
      onReplaceStudents(csvPreviewNames);
      showNotice('success', `已匯入並更新為 ${csvPreviewNames.length} 位學生名單。`);
    } else {
      onAppendStudents(csvPreviewNames);
      showNotice('success', `已將 ${csvPreviewNames.length} 位學生加入現有名單。`);
    }
    onSetCsvPreview(null);
  };

  const handleRemovePasteDuplicates = () => {
    const { unique, removedCount } = deduplicateNames(pastedPreviewNames);
    setPasteText(unique.join('\n'));
    showNotice('success', `已移除貼上預覽中 ${removedCount} 筆重複姓名，保留 ${unique.length} 位。`);
  };

  const handlePasteImport = (mode: 'replace' | 'append') => {
    if (pastedPreviewNames.length === 0) {
      showNotice('error', '請先貼上學生姓名（每行一位，或以逗號分隔）。');
      return;
    }
    if (mode === 'replace') {
      onReplaceStudents(pastedPreviewNames);
      showNotice('success', `已套用貼上的 ${pastedPreviewNames.length} 位學生名單。`);
    } else {
      onAppendStudents(pastedPreviewNames);
      showNotice('success', `已新增 ${pastedPreviewNames.length} 位學生至名單。`);
    }
    setPasteText('');
  };

  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = singleName.trim();
    if (!trimmed) return;
    onAppendStudents([trimmed]);
    setSingleName('');
    showNotice('success', `已新增「${trimmed}」。`);
  };

  const handleLoadSample = () => {
    onReplaceStudents(SAMPLE_STUDENT_NAMES);
    showNotice(
      'success',
      `已載入模擬名單（${SAMPLE_STUDENT_NAMES.length} 位）！可直接體驗「隨機抽籤」與「自動分組」。`
    );
  };

  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl flex flex-col ${
        isFullPage ? 'max-w-5xl mx-auto w-full' : 'h-full'
      }`}
    >
      {/* Panel Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">班級名單來源</h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            目前共有 {students.length} 位學生
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLoadSample}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200/70 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="一鍵載入 24 位模擬學生名單，快速試用抽籤與分組功能"
          >
            <ListChecks className="w-3.5 h-3.5" aria-hidden="true" />
            <span>模擬名單</span>
          </button>
          {students.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onClearStudents();
                showNotice('success', '已清空名單。');
              }}
              className="px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="清空名單"
            >
              清空
            </button>
          )}
        </div>
      </div>

      {/* Inline Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`mx-5 mt-4 px-3.5 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between gap-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-0.5 rounded hover:bg-black/5 cursor-pointer shrink-0"
            aria-label="關閉訊息"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* CSV Preview & Duplicate Removal Panel */}
      {csvPreview && (
        <div className="mx-5 mt-4 p-4 rounded-xl bg-sky-50/70 border border-sky-200 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 min-w-0">
              <FileSpreadsheet className="w-4 h-4 text-sky-600 shrink-0" />
              <span className="truncate">CSV 匯入預覽：{csvPreview.fileName}</span>
            </div>
            <button
              type="button"
              onClick={() => onSetCsvPreview(null)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer shrink-0"
              aria-label="取消 CSV 匯入"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {csvPreview.headers.length > 1 && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">
                請選擇「學生姓名」所在的欄位：
              </label>
              <div className="flex flex-wrap gap-1.5">
                {csvPreview.headers.map((header, idx) => (
                  <button
                    key={`${header}-${idx}`}
                    type="button"
                    onClick={() => setSelectedCol(idx)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      selectedCol === idx
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300'
                    }`}
                  >
                    {header}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={skipHeader}
              onChange={(e) => setSkipHeader(e.target.checked)}
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-600"
            />
            <span>略過第一列標題列</span>
          </label>

          {/* Duplicate Alert Bar inside CSV Preview */}
          {csvExtraDuplicateCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                <span className="tabular-nums">
                  發現 {csvExtraDuplicateCount} 筆重複姓名（已於下方標記）
                </span>
              </div>
              <button
                type="button"
                onClick={handleRemoveCsvDuplicates}
                className="px-2.5 py-1 text-xs font-semibold text-amber-900 bg-white hover:bg-amber-100 border border-amber-300 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                一鍵移除重複姓名
              </button>
            </div>
          )}

          {/* Full Scrollable Preview List */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-medium text-slate-500">
              <span>預覽名單</span>
              <span className="tabular-nums">共 {csvPreviewNames.length} 筆</span>
            </div>
            {csvPreviewNames.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">此欄位無姓名資料</p>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-[180px] overflow-y-auto">
                {csvPreviewNames.map((name, idx) => {
                  const dupCount = csvDuplicateCounts.get(name) ?? 0;
                  const isDup = dupCount > 1;
                  return (
                    <li
                      key={`${name}-${idx}`}
                      className={`px-3 py-1.5 flex items-center justify-between gap-2 text-xs ${
                        isDup ? 'bg-amber-50/70' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-slate-400 tabular-nums w-5 shrink-0">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span
                          className={`truncate ${
                            isDup ? 'font-semibold text-amber-950' : 'text-slate-800'
                          }`}
                        >
                          {name}
                        </span>
                      </div>
                      {isDup && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 shrink-0 tabular-nums">
                          <AlertTriangle className="w-3 h-3 text-amber-600" aria-hidden="true" />
                          <span>重複（共 {dupCount} 筆）</span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleConfirmCsvImport('replace')}
              disabled={csvPreviewNames.length === 0}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>取代現有名單</span>
            </button>
            <button
              type="button"
              onClick={() => handleConfirmCsvImport('append')}
              disabled={csvPreviewNames.length === 0}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>加入名單</span>
            </button>
          </div>
        </div>
      )}

      {/* Import Controls Area */}
      <div
        className={`p-5 space-y-5 ${
          isFullPage ? 'grid grid-cols-1 md:grid-cols-2 gap-6 space-y-0' : ''
        }`}
      >
        {/* Left/Top Column: CSV Upload & Paste */}
        <div className="space-y-4">
          {/* CSV Dropzone */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFile(file);
                }
                e.target.value = '';
              }}
            />
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  handleFile(file);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
              className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
                isDragging
                  ? 'border-sky-500 bg-sky-50'
                  : 'border-slate-300 hover:border-sky-400 hover:bg-slate-50/70'
              }`}
            >
              <Upload className="w-5 h-5 text-sky-600 mx-auto mb-1.5" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-800">
                點擊上傳或拖曳 CSV 檔案至此
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                支援 UTF-8 / Big5 編碼，匯入前可預覽並清除重複姓名
              </p>
            </div>
          </div>

          {/* Paste Names Textarea + Live Paste Preview */}
          <div className="space-y-2">
            <label htmlFor="paste-roster" className="block text-xs font-medium text-slate-700">
              貼上學生姓名（可從 Excel / Google 試算表直接複製）
            </label>
            <textarea
              id="paste-roster"
              rows={isFullPage ? 5 : 4}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'每行輸入一位姓名，或以逗號分隔\n例如：\n陳怡君\n林冠宇\n張宇軒'}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 resize-y"
            />

            {/* Live Paste Preview when user has pasted/typed names */}
            {pastedPreviewNames.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">貼上名單預覽</span>
                  <span className="text-slate-500 tabular-nums">
                    共 {pastedPreviewNames.length} 筆
                  </span>
                </div>

                {pastedExtraDuplicateCount > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-amber-900">
                      <AlertTriangle
                        className="w-3.5 h-3.5 text-amber-600 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="tabular-nums">
                        偵測到 {pastedExtraDuplicateCount} 筆重複姓名
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePasteDuplicates}
                      className="px-2.5 py-1 text-xs font-semibold text-amber-900 bg-white hover:bg-amber-100 border border-amber-300 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                    >
                      一鍵移除重複姓名
                    </button>
                  </div>
                )}

                <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[150px] overflow-y-auto">
                  {pastedPreviewNames.map((name, idx) => {
                    const dupCount = pastedDuplicateCounts.get(name) ?? 0;
                    const isDup = dupCount > 1;
                    return (
                      <li
                        key={`${name}-${idx}`}
                        className={`px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs ${
                          isDup ? 'bg-amber-50/70' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-slate-400 tabular-nums w-5 shrink-0">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span
                            className={`truncate ${
                              isDup ? 'font-semibold text-amber-950' : 'text-slate-800'
                            }`}
                          >
                            {name}
                          </span>
                        </div>
                        {isDup && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 shrink-0 tabular-nums">
                            <AlertTriangle
                              className="w-3 h-3 text-amber-600"
                              aria-hidden="true"
                            />
                            <span>重複（共 {dupCount} 筆）</span>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePasteImport('replace')}
                disabled={pastedPreviewNames.length === 0}
                className="flex-1 py-2 px-3 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
              >
                套用貼上名單
              </button>
              <button
                type="button"
                onClick={() => handlePasteImport('append')}
                disabled={pastedPreviewNames.length === 0}
                className="py-2 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:text-slate-300 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
              >
                附加至後方
              </button>
            </div>
          </div>

          {/* Single student quick add */}
          <form
            onSubmit={handleAddSingle}
            className="flex items-center gap-2 pt-1 border-t border-slate-100"
          >
            <input
              type="text"
              value={singleName}
              onChange={(e) => setSingleName(e.target.value)}
              placeholder="單筆新增學生姓名..."
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
            <button
              type="submit"
              disabled={!singleName.trim()}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 disabled:bg-slate-100 disabled:text-slate-400 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap min-h-[38px]"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>新增</span>
            </button>
          </form>
        </div>

        {/* Right/Bottom Column: Current Student List */}
        <div
          className={`flex flex-col ${
            isFullPage
              ? 'border border-slate-200 rounded-xl overflow-hidden bg-slate-50/40'
              : 'border-t border-slate-100 pt-4'
          }`}
        >
          <div
            className={`flex items-center justify-between ${
              isFullPage ? 'px-4 py-3 border-b border-slate-200 bg-white' : 'mb-2.5'
            }`}
          >
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>目前學生名單</span>
            </span>
            <span className="text-xs text-slate-500 tabular-nums">{students.length} 位</span>
          </div>

          {/* Duplicate Alert Bar if active roster contains duplicates */}
          {rosterExtraDuplicateCount > 0 && (
            <div
              className={`${
                isFullPage ? 'mx-4 mt-3' : 'mb-2.5'
              } bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2`}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-900">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                <span className="tabular-nums">
                  名單中有 {rosterExtraDuplicateCount} 筆重複姓名
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const removed = onDeduplicateCurrentStudents();
                  if (removed > 0) {
                    showNotice('success', `已移除現有名單中 ${removed} 筆重複姓名。`);
                  }
                }}
                className="px-2.5 py-1 text-xs font-semibold text-amber-900 bg-white hover:bg-amber-100 border border-amber-300 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                一鍵移除重複
              </button>
            </div>
          )}

          {students.length === 0 ? (
            <div className="py-10 px-4 text-center space-y-3">
              <p className="text-xs text-slate-400">
                尚未匯入學生名單，請上傳 CSV、貼上姓名，或點選下方模擬名單快速試用。
              </p>
              <button
                type="button"
                onClick={handleLoadSample}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors cursor-pointer"
              >
                <ListChecks className="w-3.5 h-3.5" aria-hidden="true" />
                <span>載入模擬名單（24 位）</span>
              </button>
            </div>
          ) : (
            <ul
              className={`divide-y divide-slate-100 overflow-y-auto ${
                isFullPage ? 'max-h-[460px] bg-white' : 'max-h-[280px] pr-1'
              }`}
            >
              {students.map((student, index) => {
                const dupCount = rosterDuplicateCounts.get(student.name) ?? 0;
                const isDup = dupCount > 1;
                return (
                  <li
                    key={student.id}
                    className={`group flex items-center justify-between py-2 ${
                      isFullPage ? 'px-4' : 'px-1.5'
                    } ${
                      isDup ? 'bg-amber-50/60' : 'hover:bg-slate-50'
                    } rounded-md transition-colors`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-slate-400 tabular-nums w-6 shrink-0">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span
                        className={`text-sm font-medium truncate ${
                          isDup ? 'text-amber-950' : 'text-slate-800'
                        }`}
                      >
                        {student.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isDup && (
                        <span className="text-[11px] font-semibold text-amber-700 tabular-nums">
                          重複
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemoveStudent(student.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 opacity-70 group-hover:opacity-100 transition-colors rounded cursor-pointer"
                        aria-label={`移除 ${student.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
