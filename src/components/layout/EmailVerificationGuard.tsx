import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MailCheck, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

interface EmailVerificationGuardProps {
  children: ReactNode;
  feature?: string;
}

export function EmailVerificationGuard({ children, feature = 'this feature' }: EmailVerificationGuardProps) {
  const { user, profile, loading } = useAuth();
  const [isSending, setIsSending] = useState(false);

  if (loading) return null;

  // Not logged in - let other guards handle this
  if (!user || !profile) return <>{children}</>;

  // Email verified - allow access
  if (profile.email_verified) return <>{children}</>;

  const handleResend = async () => {
    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-verification-email', {
        body: { user_id: user.id, email: user.email, full_name: profile.full_name }
      });
      if (error) throw error;
      toast.success("Verification email sent! Check your inbox.");
    } catch {
      toast.error("Failed to send verification email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-md glass">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <MailCheck className="w-8 h-8 text-primary" />
          </div>
          <CardTitle>Email Verification Required</CardTitle>
          <CardDescription>
            You need to verify your email address to access {feature}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Check your inbox for a verification email sent to <strong>{user.email}</strong>.
          </p>
          <Button
            className="w-full"
            variant="outline"
            onClick={handleResend}
            disabled={isSending}
          >
            <Mail className="w-4 h-4 mr-2" />
            {isSending ? 'Sending...' : 'Resend Verification Email'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
