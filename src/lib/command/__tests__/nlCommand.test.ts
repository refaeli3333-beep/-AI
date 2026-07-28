import { describe, it, expect } from "vitest";
import { parseScanCommand, resolveDateRange, describeCommand } from "../nlCommand";

const NOW = new Date("2026-07-11T09:00:00Z");
const TZ = 180; // Israel +3h

describe("NaturalLanguageScanCommandEngine", () => {
  it("parses a Hebrew person + last-week command", () => {
    const c = parseScanCommand("תמצא לי את כל הציוצים של אילון מאסק מהשבוע האחרון", NOW, TZ);
    expect(c.people).toContain("Elon Musk");
    expect(c.sourceTypes).toContain("x_posts");
    expect(c.dateRange.fromLabel).toBe("7 ימים אחרונים");
  });

  it("recognizes 'היום' (start of local day)", () => {
    const r = resolveDateRange("מה טראמפ אמר היום", NOW, TZ);
    expect(r.fromLabel).toBe("מתחילת היום");
    // start of local day (03:00Z for +3) is before now
    expect(new Date(r.from).getTime()).toBeLessThan(NOW.getTime());
  });

  it("recognizes '24 השעות האחרונות'", () => {
    const r = resolveDateRange("מה ביבי אמר ב-24 השעות האחרונות", NOW, TZ);
    expect(r.fromLabel).toBe("24 שעות אחרונות");
    expect(NOW.getTime() - new Date(r.from).getTime()).toBe(86400000);
  });

  it("detects multiple people and a topic", () => {
    const c = parseScanCommand("מה נתניהו וטראמפ אמרו השבוע על ביטחון", NOW, TZ);
    expect(c.people).toEqual(expect.arrayContaining(["Benjamin Netanyahu", "Donald Trump"]));
    expect(c.topics).toContain("defense");
  });

  it("maps chips/AI to the ai topic and flags beneficiary companies", () => {
    const c = parseScanCommand("מה ביבי אמר היום על שבבים ואיזה מניות יכולות להרוויח", NOW, TZ);
    expect(c.topics).toContain("ai");
    expect(c.includeBeneficiaryCompanies).toBe(true);
  });

  it("detects 'not reacted' and 'moved' intents", () => {
    expect(parseScanCommand("אילו מניות עדיין לא הגיבו לציוצים מהשבוע", NOW, TZ).onlyNotReacted).toBe(true);
    expect(parseScanCommand("אילו ציוצים מהיום יצרו תנועה בשוק", NOW, TZ).onlyMovedStocks).toBe(true);
  });

  it("produces a readable Hebrew description", () => {
    const c = parseScanCommand("מה אילון מאסק אמר היום", NOW, TZ);
    expect(describeCommand(c)).toContain("Elon Musk");
    expect(describeCommand(c)).toContain("מתחילת היום");
  });

  it("defaults to all watched people when none named", () => {
    const c = parseScanCommand("תסרוק את כל האנשים החשובים ותראה מה משפיע על מניות", NOW, TZ);
    expect(c.people.length).toBe(0);
    expect(describeCommand(c)).toContain("כל האנשים במעקב");
  });
});
