import { useState, useRef, useEffect } from "react";
import { Bot, Send, Loader2, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const { currentWorkspace } = useWorkspace();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again.", timestamp: new Date() },
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
        <Sparkles className="h-3 w-3 text-primary ml-auto" />
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-3">
            <Bot className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium text-foreground">Ask Klaus anything</p>
              <p className="text-xs text-muted-foreground mt-1">
                "How many calls this week?" • "Who's my top SDR?" • "Assign leads to John"
              </p>
            </div>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
