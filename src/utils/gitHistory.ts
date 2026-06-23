import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";

export interface RecentExam {
  id: string;
  timestamp: number;
  message: string;
}

export function getRecentlyChangedExams(): RecentExam[] {
  try {
    const output = execSync(
      `git -c core.quotePath=false log --format='---COMMIT---%n%at%n%s' --name-only --max-count=30 -- 'exams/'`,
      { encoding: "utf-8" },
    );
    console.warn("[gitHistory] raw output length:", output.length);
    const exams = parseGitLog(output);
    console.warn("[gitHistory] parsed exams:", exams.length);
    const filtered = filterExistingExams(exams);
    console.warn("[gitHistory] after filtering:", filtered.length);
    return filtered;
  } catch (e) {
    console.warn("[gitHistory] git log failed:", e);
    return [];
  }
}

function parseGitLog(output: string): RecentExam[] {
  const blocks = output.split("---COMMIT---\n").filter(Boolean);
  const examMap = new Map<string, RecentExam>();
  let validTimestampCount = 0;
  let totalFilePathCount = 0;
  let matchedFilePathCount = 0;

  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    if (lines.length < 2) continue;

    const timestamp = parseInt(lines[0], 10);
    if (isNaN(timestamp)) continue;
    validTimestampCount++;

    const message = lines[1];
    const filePaths = lines.slice(2);
    totalFilePathCount += filePaths.length;

    for (const filePath of filePaths) {
      const match = filePath.match(/^exams\/([^/]+)\//);
      if (!match) continue;
      matchedFilePathCount++;
      const examId = match[1];
      if (!examMap.has(examId)) {
        examMap.set(examId, { id: examId, timestamp, message });
      }
    }
  }

  if (blocks.length > 0) {
    const sample = blocks[0].split("\n");
    console.warn("[gitHistory] blocks:", blocks.length);
    console.warn("[gitHistory] first block lines:", {
      count: sample.length,
      l0: sample[0]?.slice(0, 80),
      l1: sample[1]?.slice(0, 80),
      l2: sample[2]?.slice(0, 80),
      l3: sample[3]?.slice(0, 80),
    });
    console.warn("[gitHistory] stats:", {
      validTimestampCount,
      totalFilePathCount,
      matchedFilePathCount,
    });
  }

  return [...examMap.values()].sort((a, b) => b.timestamp - a.timestamp);
}

function filterExistingExams(exams: RecentExam[]): RecentExam[] {
  let validDirs: Set<string>;
  try {
    const entries = readdirSync("exams", { withFileTypes: true });
    validDirs = new Set(
      entries
        .filter(
          (e) =>
            e.isDirectory() &&
            !e.name.startsWith(".") &&
            e.name !== "LICENSE",
        )
        .map((e) => e.name),
    );
  } catch {
    return exams;
  }

  return exams.filter((e) => validDirs.has(e.id));
}
