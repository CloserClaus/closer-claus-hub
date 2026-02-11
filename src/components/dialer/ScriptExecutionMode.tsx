import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { parseScript, type ScriptBeat, type ParsedScript } from "./scriptParser";

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  company: string | null;
  email: string | null;
  title: string | null;
}

interface ScriptExecutionModeProps {
  content: string;
  lead: Lead | null;
}

export function ScriptExecutionMode({ content, lead }: ScriptExecutionModeProps) {
  const [parsed, setParsed] = useState<ParsedScript>({ beats: [], isStructured: false });
  const [currentBeatIndex, setCurrentBeatIndex] = useState(0);
  const [history, setHistory] = useState<number[]>([0]);

  useEffect(() => {
    const result = parseScript(content);
    setParsed(result);
    setCurrentBeatIndex(0);
    setHistory([0]);
  }, [content]);

  const interpolate = useCallback((text: string): string => {
    if (!lead) return text;
    return text
      .replace(/\{\{first_name\}\}/g, lead.first_name || '[First Name]')
      .replace(/\{\{last_name\}\}/g, lead.last_name || '[Last Name]')
      .replace(/\{\{company\}\}/g, lead.company || '[Company]')
      .replace(/\{\{title\}\}/g, lead.title || '[Title]')
      .replace(/\{\{email\}\}/g, lead.email || '[Email]')
      .replace(/\{\{phone\}\}/g, lead.phone || '[Phone]');
  }, [lead]);

  const navigateToBeat = useCallback((beatNumber: number) => {
    const idx = parsed.beats.findIndex(b => b.number === beatNumber);
    if (idx !== -1) {
      setCurrentBeatIndex(idx);
      setHistory(prev => [...prev, idx]);
    }
  }, [parsed.beats]);

  const goNext = useCallback(() => {
    if (currentBeatIndex < parsed.beats.length - 1) {
      const next = currentBeatIndex + 1;
      setCurrentBeatIndex(next);
      setHistory(prev => [...prev, next]);
    }
  }, [currentBeatIndex, parsed.beats.length]);

  const goPrev = useCallback(() => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      setHistory(newHistory);
      setCurrentBeatIndex(newHistory[newHistory.length - 1]);
    }
  }, [history]);

  const resetScript = useCallback(() => {
    setCurrentBeatIndex(0);
    setHistory([0]);
  }, []);

  if (!parsed.isStructured || parsed.beats.length === 0) {
    return null;
  }

  const beat = parsed.beats[currentBeatIndex];
  if (!beat) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Beat Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-xs font-bold px-2 py-0.5">
            {beat.number}
          </Badge>
          <span className="text-sm font-semibold text-foreground">{beat.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">
            {currentBeatIndex + 1}/{parsed.beats.length}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetScript} title="Restart">
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* SAY THIS */}
      <div className="rounded-md bg-primary/10 border border-primary/20 p-3 mb-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1.5">
          Say This
        </p>
        <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
          {interpolate(beat.sayThis)}
        </div>
      </div>

      {/* BRANCHES */}
      {beat.branches.length > 0 && (
        <div className="flex-1 min-h-0 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            If They Say
          </p>
          <div className="space-y-1.5">
            {beat.branches.map((branch, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (branch.targetBeat) {
                    navigateToBeat(branch.targetBeat);
                  } else {
                    goNext();
                  }
                }}
                className="w-full text-left rounded-md border border-border hover:border-primary/40 hover:bg-accent/50 p-2 transition-colors group"
              >
                <p className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                  "{interpolate(branch.condition)}"
                </p>
                <p className="text-xs text-foreground/80 mt-0.5">
                  → {interpolate(branch.response)}
                </p>
                {branch.targetBeat && (
                  <span className="text-[10px] text-primary mt-0.5 inline-block">
                    Goes to Beat {branch.targetBeat}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={goPrev}
          disabled={history.length <= 1}
          className="h-7 text-xs gap-1"
        >
          <ChevronLeft className="h-3 w-3" />
          Back
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={goNext}
          disabled={currentBeatIndex >= parsed.beats.length - 1}
          className="h-7 text-xs gap-1"
        >
          Next
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
