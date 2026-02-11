/**
 * Parses beat-structured scripts produced by the Script Builder
 * into a structured format for Execution Mode rendering.
 */

export interface ScriptBranch {
  condition: string;
  response: string;
  targetBeat: number | null;
}

export interface ScriptBeat {
  number: number;
  title: string;
  sayThis: string;
  branches: ScriptBranch[];
}

export interface ParsedScript {
  beats: ScriptBeat[];
  isStructured: boolean;
}

/**
 * Detect whether a script follows the beat structure format.
 * Looks for numbered beat headings like "1. Attention Capture" or "## 1. Attention Capture"
 */
export function isStructuredScript(content: string): boolean {
  // Must have at least beats 1-4 to qualify
  const beatPattern = /(?:^|\n)#{0,4}\s*(?:\*{0,2})?\s*(?:Beat\s+)?1\.\s+/i;
  const hasBeat1 = beatPattern.test(content);
  const hasBeat4 = /(?:^|\n)#{0,4}\s*(?:\*{0,2})?\s*(?:Beat\s+)?4\.\s+/i.test(content);
  return hasBeat1 && hasBeat4;
}

/**
 * Parse the script content into structured beats.
 * Handles various markdown formats the Script Builder may produce.
 */
export function parseScript(content: string): ParsedScript {
  if (!isStructuredScript(content)) {
    return { beats: [], isStructured: false };
  }

  // Split by beat headings - match patterns like:
  // "1. Attention Capture", "## 1. Attention Capture", "**1. Attention Capture**"
  // Also "Beat 1 – Attention Capture", "## Beat 1: Attention Capture"
  const beatSplitPattern = /(?:^|\n)(?:#{1,4}\s*)?(?:\*{1,2})?(?:Beat\s+)?(\d+)[\.\):\s–—-]+\s*([^\n*#]+?)(?:\*{1,2})?\s*\n/gi;
  
  const beatMatches: { number: number; title: string; startIndex: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = beatSplitPattern.exec(content)) !== null) {
    const beatNum = parseInt(match[1], 10);
    // Only take beats 1-8, skip duplicates
    if (beatNum >= 1 && beatNum <= 8 && !beatMatches.find(b => b.number === beatNum)) {
      beatMatches.push({
        number: beatNum,
        title: match[2].trim().replace(/[:\-–—]+$/, '').trim(),
        startIndex: match.index + match[0].length,
      });
    }
  }

  if (beatMatches.length < 3) {
    return { beats: [], isStructured: false };
  }

  // Extract content for each beat
  const beats: ScriptBeat[] = [];

  for (let i = 0; i < beatMatches.length; i++) {
    const beatMatch = beatMatches[i];
    const nextStart = i < beatMatches.length - 1 ? beatMatches[i + 1].startIndex - 100 : undefined;
    
    // Get raw content between this beat heading and the next
    let rawContent: string;
    if (i < beatMatches.length - 1) {
      // Find where the next beat heading starts in the original content
      const nextBeatHeadingPattern = new RegExp(
        `(?:^|\\n)(?:#{1,4}\\s*)?(?:\\*{1,2})?(?:Beat\\s+)?${beatMatches[i + 1].number}[\\.):\\s–—-]+`,
        'i'
      );
      const nextMatch = nextBeatHeadingPattern.exec(content.slice(beatMatch.startIndex));
      rawContent = nextMatch 
        ? content.slice(beatMatch.startIndex, beatMatch.startIndex + nextMatch.index)
        : content.slice(beatMatch.startIndex);
    } else {
      // Last beat - take until "CONVERSATION WIN CONDITION" or "HOW TO THINK" or "SECTION 2" or end
      const endPattern = /(?:^|\n)(?:#{1,4}\s*)?(?:\*{1,2})?\s*(?:CONVERSATION WIN CONDITION|HOW TO THINK|SECTION 2|---{3,})/i;
      const endMatch = endPattern.exec(content.slice(beatMatch.startIndex));
      rawContent = endMatch 
        ? content.slice(beatMatch.startIndex, beatMatch.startIndex + endMatch.index) 
        : content.slice(beatMatch.startIndex);
    }

    const { sayThis, branches } = parseBeatContent(rawContent);

    beats.push({
      number: beatMatch.number,
      title: beatMatch.title,
      sayThis,
      branches,
    });
  }

  return { beats, isStructured: beats.length >= 3 };
}

/**
 * Extract the "say this" line and branches from a beat's raw content.
 */
function parseBeatContent(raw: string): { sayThis: string; branches: ScriptBranch[] } {
  const lines = raw.split('\n');
  const sayLines: string[] = [];
  const branches: ScriptBranch[] = [];
  
  let inBranches = false;
  let currentBranchCondition = '';
  let currentBranchResponse = '';
  let currentBranchTarget: number | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Skip markdown decorators, section headers for branches/guardrails
    const isBranchHeader = /^(?:\*{1,2})?(?:GUARDRAILS|BRANCHES|IF THEY SAY|CONDITIONAL|BRANCH)/i.test(line);
    if (isBranchHeader) {
      inBranches = true;
      continue;
    }

    // Detect branch lines: various formats
    // "If they say X → Rep: Y → Move to Beat Z"
    // "- If they say "X" → Rep: "Y""
    // "- "Who is this?" → "I'm calling from..."
    const branchMatch = line.match(
      /^[-•*]?\s*(?:If\s+they\s+(?:say|respond|ask|interrupt|push back|resist)[^:→"]*)?[:""]?\s*(.+?)\s*["""]?\s*→\s*(?:Rep:\s*)?["""]?\s*(.+?)(?:["""]?\s*→\s*(?:Move to\s*)?Beat\s*#?(\d+))?$/i
    );

    if (branchMatch) {
      inBranches = true;
      // Save previous branch if exists
      if (currentBranchCondition) {
        branches.push({
          condition: cleanText(currentBranchCondition),
          response: cleanText(currentBranchResponse),
          targetBeat: currentBranchTarget,
        });
      }
      currentBranchCondition = branchMatch[1];
      currentBranchResponse = branchMatch[2];
      currentBranchTarget = branchMatch[3] ? parseInt(branchMatch[3], 10) : null;
      continue;
    }

    // Also detect simpler "If..." patterns
    const simpleIfMatch = line.match(
      /^[-•*]?\s*(?:\*{0,2})?If\s+(?:they\s+)?(.+?)(?:\*{0,2})?:\s*(.+)/i
    );
    if (simpleIfMatch) {
      inBranches = true;
      if (currentBranchCondition) {
        branches.push({
          condition: cleanText(currentBranchCondition),
          response: cleanText(currentBranchResponse),
          targetBeat: currentBranchTarget,
        });
      }
      currentBranchCondition = simpleIfMatch[1];
      // Check for "Move to Beat X" in response
      const moveMatch = simpleIfMatch[2].match(/(.+?)→?\s*(?:Move to\s*)?Beat\s*#?(\d+)/i);
      if (moveMatch) {
        currentBranchResponse = moveMatch[1];
        currentBranchTarget = parseInt(moveMatch[2], 10);
      } else {
        currentBranchResponse = simpleIfMatch[2];
        currentBranchTarget = null;
      }
      continue;
    }

    // Check for standalone "Move to Beat X" (continuation of previous branch)
    const moveOnly = line.match(/^[-•*]?\s*→?\s*(?:Move to\s*)?Beat\s*#?(\d+)/i);
    if (moveOnly && currentBranchCondition) {
      currentBranchTarget = parseInt(moveOnly[1], 10);
      continue;
    }

    // Skip meta-text lines
    if (/^(?:SAY THIS|WHAT TO SAY|PRIMARY LINE|REP SAYS)/i.test(line)) continue;
    if (/^(?:---+|===+|\*\*\*+)$/.test(line)) continue;

    // If not in branches section, this is a "say this" line
    if (!inBranches) {
      // Clean up "**Rep:**" or "Rep:" prefixes
      const cleaned = line
        .replace(/^\*{1,2}Rep:\*{0,2}\s*/i, '')
        .replace(/^Rep:\s*/i, '')
        .replace(/^\*{1,2}/, '')
        .replace(/\*{1,2}$/, '');
      
      if (cleaned && !cleaned.match(/^#{1,4}\s/) && !cleaned.match(/^(?:Example|Note|Pattern):/i)) {
        sayLines.push(cleaned);
      }
    }
  }

  // Push last branch
  if (currentBranchCondition) {
    branches.push({
      condition: cleanText(currentBranchCondition),
      response: cleanText(currentBranchResponse),
      targetBeat: currentBranchTarget,
    });
  }

  return {
    sayThis: sayLines.join('\n') || '(Follow the flow)',
    branches,
  };
}

function cleanText(text: string): string {
  return text
    .replace(/^["'""]+/, '')
    .replace(/["'""]+$/, '')
    .replace(/^\*{1,2}/, '')
    .replace(/\*{1,2}$/, '')
    .replace(/→\s*$/, '')
    .trim();
}
