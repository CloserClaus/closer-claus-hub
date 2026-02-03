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
import { FileText, GripHorizontal, Minimize2, Maximize2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
}

interface FloatingCallScriptProps {
  workspaceId: string;
  lead: Lead | null;
  isVisible: boolean;
  onClose: () => void;
}

export function FloatingCallScript({ workspaceId, lead, isVisible, onClose }: FloatingCallScriptProps) {
  const [scripts, setScripts] = useState<CallScript[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string>("");
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const fetchScripts = async () => {
      const { data, error } = await supabase
        .from('call_scripts')
        .select('id, title, content, is_default')
        .eq('workspace_id', workspaceId)
        .order('is_default', { ascending: false });

      if (error) {
        console.error('Error fetching scripts:', error);
        return;
      }

      setScripts(data || []);
      
      const defaultScript = data?.find(s => s.is_default);
      if (defaultScript) {
        setSelectedScriptId(defaultScript.id);
      } else if (data && data.length > 0) {
        setSelectedScriptId(data[0].id);
      }
    };

    fetchScripts();
  }, [workspaceId]);

  const selectedScript = scripts.find(s => s.id === selectedScriptId);

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
                <FileText className="h-4 w-4 text-primary" />
                Script
              </CardTitle>
            </div>
            <div className="flex items-center gap-1">
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
            <Select value={selectedScriptId} onValueChange={setSelectedScriptId}>
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
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedScript && (
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
                          const leadValues = lead ? [
                            lead.first_name,
                            lead.last_name,
                            lead.company,
                            lead.title,
                            lead.email,
                            lead.phone
                          ].filter(Boolean) : [];
                          
                          let result = part;
                          leadValues.forEach(value => {
                            if (value && result.includes(value)) {
                              result = result.split(value).join(`__HIGHLIGHT__${value}__ENDHIGHLIGHT__`);
                            }
                          });
                          
                          if (result.includes('__HIGHLIGHT__')) {
                            const segments = result.split(/(__HIGHLIGHT__|__ENDHIGHLIGHT__)/g);
                            let inHighlight = false;
                            return segments.map((seg, segIndex) => {
                              if (seg === '__HIGHLIGHT__') {
                                inHighlight = true;
                                return null;
                              }
                              if (seg === '__ENDHIGHLIGHT__') {
                                inHighlight = false;
                                return null;
                              }
                              if (inHighlight) {
                                return (
                                  <span
                                    key={segIndex}
                                    className="px-1 py-0.5 rounded bg-success/20 text-success font-medium"
                                  >
                                    {seg}
                                  </span>
                                );
                              }
                              return seg;
                            });
                          }
                          
                          return part;
                        })}
                      </p>
                    );
                  })}
                </div>
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
