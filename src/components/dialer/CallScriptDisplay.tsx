import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

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

interface CallScriptDisplayProps {
  workspaceId: string;
  lead: Lead | null;
}

export function CallScriptDisplay({ workspaceId, lead }: CallScriptDisplayProps) {
  const [scripts, setScripts] = useState<CallScript[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string>("");
  const [isCollapsed, setIsCollapsed] = useState(false);

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
      
      // Auto-select default script
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

  if (scripts.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Call Script
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedScriptId} onValueChange={setSelectedScriptId}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      {!isCollapsed && selectedScript && (
        <CardContent className="pt-0">
          <ScrollArea className="h-[200px]">
            <div className="text-sm whitespace-pre-wrap leading-relaxed">
              {interpolateScript(selectedScript.content, lead).split('\n').map((line, index) => {
                // Highlight interpolated values
                const parts = line.split(/(\[.*?\])/g);
                return (
                  <p key={index} className="mb-2">
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
                      // Check if part contains actual lead data (not placeholder)
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
          {lead && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Calling: <span className="text-foreground font-medium">{lead.first_name} {lead.last_name}</span>
                {lead.company && <span> at <span className="text-foreground">{lead.company}</span></span>}
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
