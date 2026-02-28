import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Loader2, ArrowLeft, Sparkles, Trash2 } from "lucide-react";
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

interface KlausChatProps {
  onBack: () => void;
}

export function KlausChat({ onBack }: KlausChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { currentWorkspace } = useWorkspace();

  // Load conversation history on mount
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
        setMessages(
          history.map((h: any) => ({
            role: h.role as "user" | "assistant",
            content: h.content,
            timestamp: new Date(h.created_at),
          }))
        );
      }
      setHistoryLoaded(true);
    };

    loadHistory();
  }, [currentWorkspace?.id, historyLoaded]);

  // Auto-scroll on new messages
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

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !currentWorkspace?.id) return;

    const userMessage: Message = { role: "user", content: input.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("klaus", {
        body: {
          message: userMessage.content,
          workspace_id: currentWorkspace.id,
        },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: "assistant",
        content: data?.response || "I couldn't process that request.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error("Klaus error:", err);
      const errorMsg = err?.message?.includes("429")
        ? "I'm being rate limited. Please wait a moment and try again."
        : err?.message?.includes("402")
        ? "AI credits exhausted. Please add credits in Settings → Workspace → Usage."
        : "Sorry, I encountered an error. Please try again.";

      setMessages(prev => [
        ...prev,
        { role: "assistant", content: errorMsg, timestamp: new Date() },
      ]);
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
    <div className="flex flex-col h-[460px]">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-sm">Klaus</p>
          <p className="text-xs text-muted-foreground">Execution Agent</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearHistory} title="Clear history">
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-8 space-y-3">
            <Bot className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium text-foreground">Ask Klaus anything</p>
              <p className="text-xs text-muted-foreground mt-1">
                "What should I do next?" • "How many leads do I have?" • "Who's my top SDR?"
              </p>
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

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Klaus anything or tell him what to do…"
            className="text-sm"
            disabled={isLoading}
          />
          <Button size="icon" onClick={sendMessage} disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
