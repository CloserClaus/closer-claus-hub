import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Loader2, Sparkles, Trash2, Minus, X, Paperclip, FileText, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AttachedFile {
  name: string;
  content: string; // text content or "[image uploaded]"
  type: string;
}

interface KlausChatProps {
  onClose: () => void;
  onMinimize: () => void;
}

const QUICK_ACTIONS = [
  "What should I do next?",
  "Show my KPIs",
  "Who's my top SDR?",
  "Analyze my bottlenecks",
];

export function KlausChat({ onClose, onMinimize }: KlausChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentWorkspace } = useWorkspace();

  useEffect(() => {
    if (!currentWorkspace?.id || historyLoaded) return;
    const loadHistory = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: history } = await supabase
        .from("klaus_conversations")
        .select("role, content, created_at")
        .eq("user_id", user.id)
        .eq("organization_id", currentWorkspace.id)
        .order("created_at", { ascending: true })
        .limit(50);
      if (history?.length) {
        setMessages(history.map((h: any) => ({
          role: h.role as "user" | "assistant",
          content: h.content,
          timestamp: new Date(h.created_at),
        })));
      }
      setHistoryLoaded(true);
    };
    loadHistory();
  }, [currentWorkspace?.id, historyLoaded]);

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages, isLoading]);

  const clearHistory = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !currentWorkspace?.id) return;
    await supabase
      .from("klaus_conversations")
      .delete()
      .eq("user_id", user.id)
      .eq("organization_id", currentWorkspace.id);
    setMessages([]);
  }, [currentWorkspace?.id]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setMessages(prev => [...prev, { role: "assistant", content: "File is too large. Max 5MB.", timestamp: new Date() }]);
      return;
    }

    if (file.type === "text/csv" || file.name.endsWith(".csv")) {
      const text = await file.text();
      // Truncate to first 50 rows for context
      const lines = text.split("\n").slice(0, 51);
      setAttachedFile({ name: file.name, content: lines.join("\n"), type: "csv" });
    } else if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".json")) {
      const text = await file.text();
      setAttachedFile({ name: file.name, content: text.slice(0, 5000), type: "text" });
    } else {
      setAttachedFile({ name: file.name, content: `[File: ${file.name} (${file.type}, ${Math.round(file.size / 1024)}KB)]`, type: "other" });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const sendMessage = async (overrideMessage?: string) => {
    const text = overrideMessage || input.trim();
    if (!text || isLoading || !currentWorkspace?.id) return;

    let fullMessage = text;
    if (attachedFile) {
      fullMessage += `\n\n---\nAttached file: ${attachedFile.name}\n${attachedFile.content}`;
    }

    const userMessage: Message = { role: "user", content: text + (attachedFile ? ` 📎 ${attachedFile.name}` : ""), timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setAttachedFile(null);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("klaus", {
        body: { message: fullMessage, workspace_id: currentWorkspace.id },
      });
      if (error) throw error;
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data?.response || "I couldn't process that request.",
        timestamp: new Date(),
      }]);
    } catch (err: any) {
      console.error("Klaus error:", err);
      const errorMsg = err?.message?.includes("429")
        ? "I'm being rate limited. Please wait a moment and try again."
        : err?.message?.includes("402")
        ? "AI credits exhausted. Please add credits in Settings → Workspace → Usage."
        : "Sorry, I encountered an error. Please try again.";
      setMessages(prev => [...prev, { role: "assistant", content: errorMsg, timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed bottom-20 right-4 md:bottom-4 z-[60] w-[460px] h-[620px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] flex flex-col rounded-xl border border-border bg-background shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30 shrink-0">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Klaus</p>
          <p className="text-xs text-muted-foreground">Execution Agent</p>
        </div>
        <div className="flex items-center gap-0.5">
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearHistory} title="Clear history">
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMinimize} title="Minimize">
            <Minus className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} title="Close">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-6 space-y-4">
            <div className="h-14 w-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Hey! I'm Klaus, your platform agent.</p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
                I can analyze your performance, guide your next steps, and help you get more out of CloserClaus.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  onClick={() => sendMessage(action)}
                  className="px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Analyzing...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-3 border-t border-border shrink-0">
        {attachedFile && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-muted rounded-md text-xs">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate text-muted-foreground">{attachedFile.name}</span>
            <button onClick={() => setAttachedFile(null)} className="ml-auto shrink-0">
              <XCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.json,.pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="Attach file"
          >
            <Paperclip className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Klaus anything…"
            className="text-sm"
            disabled={isLoading}
          />
          <Button size="icon" className="shrink-0" onClick={() => sendMessage()} disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
