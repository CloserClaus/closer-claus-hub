import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, GripHorizontal, Minimize2, Maximize2, X, ShieldAlert, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isStructuredScript } from "./scriptParser";
import { ScriptExecutionMode } from "./ScriptExecutionMode";

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  company: string | null;
  email: string | null;
  title: string | null;
}

interface CallScript {
  id: string;
  title: string;
  content: string;
  is_default: boolean;
  objection_playbook: ObjectionItem[] | null;
}

interface ObjectionItem {
  category: string;
  phase: string;
  objection: string;
  meaning: string;
  understanding: string;
  strategy: string;
  what_to_say: string;
  if_they_resist: string;
  if_they_engage: string;
  return_to_beat: string;
}

const OBJECTION_CATEGORIES = [
  'Brush-Off Resistance',
  'Authority Resistance',
  'Timing Resistance',
  'Skepticism Resistance',
  'Status Quo Resistance',
  'Pricing Resistance',
] as const;

interface FloatingCallScriptProps {
  workspaceId: string;
  lead: Lead | null;
  isVisible: boolean;
  onClose: () => void;
}

function ObjectionAssistPanel({ objections }: { objections: ObjectionItem[] }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const byCategory: Record<string, ObjectionItem[]> = {};
  for (const cat of OBJECTION_CATEGORIES) {
    const items = objections.filter(o => o.category === cat);
    if (items.length > 0) byCategory[cat] = items;
  }

  const shortLabel = (cat: string) => cat.replace(' Resistance', '');

  if (activeCategory && byCategory[activeCategory]) {
    const items = byCategory[activeCategory];
    return (
      <div className="space-y-1">
        <button
          onClick={() => setActiveCategory(null)}
          className="text-[10px] text-primary font-medium mb-1 flex items-center gap-1"
        >
          ← Back
        </button>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
          {activeCategory}
        </p>
        {items.map((item, idx) => (
          <ObjectionQuickCard key={idx} item={item} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
        Quick Objection Assist
      </p>
      <div className="grid grid-cols-2 gap-1">
        {Object.keys(byCategory).map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className="text-left rounded border border-border hover:border-primary/40 hover:bg-accent/50 px-2 py-1.5 transition-colors"
          >
            <span className="text-[11px] font-medium text-foreground">{shortLabel(cat)}</span>
            <span className="text-[10px] text-muted-foreground ml-1">({byCategory[cat].length})</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ObjectionQuickCard({ item }: { item: ObjectionItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full text-left rounded border border-border hover:border-primary/30 p-2 transition-colors"
    >
      <p className="text-[11px] font-medium text-foreground leading-snug">"{item.objection}"</p>
      {expanded ? (
        <div className="mt-1.5 space-y-1">
          <div className="bg-primary/5 rounded px-2 py-1">
            <p className="text-[10px] font-bold text-primary uppercase">Say this</p>
            <p className="text-[11px] text-foreground">"{item.what_to_say}"</p>
          </div>
          <p className="text-[10px] text-muted-foreground">
            <span className="font-semibold">Return to:</span> {item.return_to_beat}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-1 mt-0.5">
          <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Tap for response</span>
        </div>
      )}
    </button>
  );
}

export function FloatingCallScript({ workspaceId, lead, isVisible, onClose }: FloatingCallScriptProps) {
  const [scripts, setScripts] = useState<CallScript[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string>("");
  const [isMinimized, setIsMinimized] = useState(false);
  const [showObjections, setShowObjections] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);

  const prevVisibleRef = useRef(false);

  const fetchScripts = async () => {
    const { data, error } = await supabase
      .from('call_scripts')
      .select('id, title, content, is_default, objection_playbook')
      .eq('workspace_id', workspaceId)
      .order('is_default', { ascending: false });

    if (error) {
      console.error('Error fetching scripts:', error);
      return;
    }

    setScripts((data || []).map(s => ({
      ...s,
      objection_playbook: s.objection_playbook as unknown as ObjectionItem[] | null,
    })));
    
    const defaultScript = data?.find(s => s.is_default);
    if (defaultScript) {
      setSelectedScriptId(defaultScript.id);
    } else if (data && data.length > 0) {
      setSelectedScriptId(data[0].id);
    }
  };

  useEffect(() => {
    fetchScripts();
  }, [workspaceId]);

  // Refetch scripts when floating script becomes visible (e.g. call starts)
  useEffect(() => {
    if (isVisible && !prevVisibleRef.current) {
      fetchScripts();
      setShowObjections(false);
    }
    prevVisibleRef.current = isVisible;
  }, [isVisible]);

  const selectedScript = scripts.find(s => s.id === selectedScriptId);
  const hasObjections = selectedScript?.objection_playbook && selectedScript.objection_playbook.length > 0;

  const interpolateScript = (content: string, lead: Lead | null): string => {
    if (!lead) return content;

    return content
      .replace(/\{\{first_name\}\}/g, lead.first_name || '[First Name]')
      .replace(/\{\{last_name\}\}/g, lead.last_name || '[Last Name]')
      .replace(/\{\{company\}\}/g, lead.company || '[Company]')
      .replace(/\{\{title\}\}/g, lead.title || '[Title]')
      .replace(/\{\{email\}\}/g, lead.email || '[Email]')
      .replace(/\{\{phone\}\}/g, lead.phone || '[Phone]');
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: position.x,
      offsetY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return;
      
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 350, dragRef.current.offsetX + deltaX)),
        y: Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.offsetY + deltaY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!isVisible || scripts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed z-50 shadow-2xl"
      style={{
        left: position.x,
        top: position.y,
        width: isMinimized ? 200 : 340,
        transition: isDragging ? 'none' : 'width 0.2s ease',
      }}
    >
      <Card className="border-primary/30 bg-background/95 backdrop-blur-sm">
        <CardHeader 
          className="pb-2 cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GripHorizontal className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm flex items-center gap-2">
                {showObjections ? (
                  <ShieldAlert className="h-4 w-4 text-primary" />
                ) : (
                  <FileText className="h-4 w-4 text-primary" />
                )}
                {showObjections ? 'Objections' : 'Script'}
              </CardTitle>
            </div>
            <div className="flex items-center gap-1">
              {hasObjections && !isMinimized && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowObjections(!showObjections)}
                  title={showObjections ? 'Show script' : 'Show objection assist'}
                >
                  {showObjections ? (
                    <FileText className="h-3 w-3" />
                  ) : (
                    <ShieldAlert className="h-3 w-3" />
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? (
                  <Maximize2 className="h-3 w-3" />
                ) : (
                  <Minimize2 className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onClose}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {!isMinimized && (
          <CardContent className="pt-0 space-y-3">
            <Select value={selectedScriptId} onValueChange={(val) => {
              setSelectedScriptId(val);
              setShowObjections(false);
            }}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select script" />
              </SelectTrigger>
              <SelectContent>
                {scripts.map((script) => (
                  <SelectItem key={script.id} value={script.id}>
                    <div className="flex items-center gap-2">
                      {script.title}
                      {script.is_default && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          Default
                        </Badge>
                      )}
                      {script.objection_playbook && script.objection_playbook.length > 0 && (
                        <ShieldAlert className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedScript && !showObjections && (
              <>
                {isStructuredScript(selectedScript.content) ? (
                  <div className="h-[280px] overflow-y-auto pr-1">
                    <ScriptExecutionMode content={selectedScript.content} lead={lead} />
                  </div>
                ) : (
                  <ScrollArea className="h-[250px] pr-2">
                    <div className="text-sm whitespace-pre-wrap leading-relaxed space-y-2">
                      {interpolateScript(selectedScript.content, lead).split('\n').map((line, index) => {
                        const parts = line.split(/(\[.*?\])/g);
                        return (
                          <p key={index}>
                            {parts.map((part, partIndex) => {
                              if (part.startsWith('[') && part.endsWith(']')) {
                                return (
                                  <span
                                    key={partIndex}
                                    className="px-1 py-0.5 rounded bg-warning/20 text-warning-foreground font-medium"
                                  >
                                    {part}
                                  </span>
                                );
                              }
                              return part;
                            })}
                          </p>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </>
            )}

            {selectedScript && showObjections && hasObjections && (
              <ScrollArea className="h-[280px] pr-1">
                <ObjectionAssistPanel objections={selectedScript.objection_playbook!} />
              </ScrollArea>
            )}

            {lead && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">{lead.first_name} {lead.last_name}</span>
                  {lead.company && <span> • {lead.company}</span>}
                </p>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}