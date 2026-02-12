import { useState } from "react";
import { HelpCircle, Mail, Bug, Lightbulb, X, ChevronUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { BugReportForm } from "./BugReportForm";
import { FeatureHub } from "./FeatureHub";
import { useAuth } from "@/hooks/useAuth";

type ActivePanel = null | "bug" | "feature";

export function HelpWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const { user } = useAuth();

  if (!user) return null;

  const handleContactSupport = () => {
    window.location.href = "mailto:support@closerclaus.com?subject=Support Request";
    setIsOpen(false);
  };

  const handleClose = () => {
    setActivePanel(null);
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-20 right-4 md:bottom-4 z-50">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            size="lg"
            className="rounded-full h-14 w-14 shadow-lg hover:shadow-xl transition-shadow"
          >
            {isOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <HelpCircle className="h-6 w-6" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          className="w-96 p-0 mb-2 bg-popover border border-border"
          sideOffset={8}
        >
          {activePanel === null ? (
            <div className="p-4 space-y-2">
              <h3 className="font-semibold text-lg mb-4">How can we help?</h3>
              
              <button
                onClick={handleContactSupport}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Contact Support</p>
                  <p className="text-sm text-muted-foreground">Email us for help</p>
                </div>
                <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
              </button>

              <button
                onClick={() => setActivePanel("bug")}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Bug className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-medium">Report a Bug</p>
                  <p className="text-sm text-muted-foreground">Something not working?</p>
                </div>
                <ChevronUp className="h-4 w-4 ml-auto text-muted-foreground rotate-90" />
              </button>

              <button
                onClick={() => setActivePanel("feature")}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Lightbulb className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="font-medium">Features & Updates</p>
                  <p className="text-sm text-muted-foreground">Vote, roadmap & changelog</p>
                </div>
                <ChevronUp className="h-4 w-4 ml-auto text-muted-foreground rotate-90" />
              </button>
            </div>
          ) : activePanel === "bug" ? (
            <BugReportForm onClose={handleClose} onBack={() => setActivePanel(null)} />
          ) : (
            <FeatureHub onClose={handleClose} onBack={() => setActivePanel(null)} />
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
