// Data completeness = how much of a signal is backed by real (not mock) data.
export interface CompletenessInput {
  liveNews: boolean; fullText: boolean; exactTime: boolean; livePrice: boolean; liveAnalysis: boolean;
}
export interface Completeness { percent: number; missing: string[] }

export function dataCompleteness(i: CompletenessInput): Completeness {
  const parts: [string, boolean][] = [
    ["מקור חדשות אמיתי", i.liveNews],
    ["טקסט מלא של המקור", i.fullText],
    ["זמן פרסום מדויק", i.exactTime],
    ["מחיר שוק אמיתי", i.livePrice],
    ["ניתוח אמיתי", i.liveAnalysis],
  ];
  const have = parts.filter((p) => p[1]).length;
  return { percent: Math.round((have / parts.length) * 100), missing: parts.filter((p) => !p[1]).map((p) => p[0]) };
}
