import { useState } from "react";
import { AlertTriangle, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailVerificationBannerProps {
  email: string;
  userId: string;
  fullName?: string;
}

export function EmailVerificationBanner({ email, userId, fullName }: EmailVerificationBannerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const handleResendEmail = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-verification-email', {
        body: { user_id: userId, email, full_name: fullName }
      });

      if (error) throw error;
      toast.success("Verification email sent! Check your inbox.");
    } catch (error) {
      console.error('Error sending verification email:', error);
      toast.error("Failed to send verification email");
    } finally {
      setIsLoading(false);
    }
  };

  if (isDismissed) return null;

  return (
    <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 md:p-4 mb-4 md:mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Verify your email address</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Please verify {email} to unlock all features
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-8 sm:ml-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResendEmail}
            disabled={isLoading}
            className="text-xs h-8"
          >
            <Mail className="h-3 w-3 mr-1.5" />
            {isLoading ? "Sending..." : "Resend"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDismissed(true)}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
