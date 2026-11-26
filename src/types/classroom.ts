export type ActiveView = 'picker' | 'groups' | 'roster';

export type PickerSpeed = 'standard' | 'fast';

export type RemainderStrategy = 'distribute' | 'separate';

export interface Student {
  id: string;
  name: string;
}

export interface DrawRecord {
  recordId: string;
  student: Student;
  round: number;
  timestamp: string;
}

export interface GroupPod {
  id: string;
  index: number;
  name: string;
  members: Student[];
}

export interface ParsedCsvPreview {
  fileName: string;
  rows: string[][];
  headers: string[];
  hasHeader: boolean;
  detectedColumnIndex: number;
}
