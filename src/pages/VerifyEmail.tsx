import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setErrorMessage('No verification token provided');
      return;
    }

    const verifyEmail = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('verify-email', {
          body: { token }
        });

        if (error) {
          throw new Error(error.message);
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        setStatus('success');
      } catch (error: any) {
        console.error('Verification error:', error);
        setStatus('error');
        setErrorMessage(error.message || 'Failed to verify email');
      }
    };

    verifyEmail();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
              <CardTitle>Verifying your email...</CardTitle>
              <CardDescription>Please wait while we verify your email address.</CardDescription>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
              <CardTitle className="text-success">Email Verified!</CardTitle>
              <CardDescription>
                Your email has been successfully verified. You now have full access to all features.
              </CardDescription>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <CardTitle className="text-destructive">Verification Failed</CardTitle>
              <CardDescription>{errorMessage}</CardDescription>
            </>
          )}
        </CardHeader>
        
        <CardContent className="flex justify-center">
          {status !== 'loading' && (
            <Button onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
