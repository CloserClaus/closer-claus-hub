import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  FileSignature,
  CheckCircle,
  AlertCircle,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

interface ContractData {
  id: string;
  title: string;
  content: string;
  status: string;
  deals?: {
    title: string;
    value: number;
    leads?: {
      first_name: string;
      last_name: string;
      email: string | null;
      company: string | null;
    } | null;
  };
}

type Step = 'email' | 'otp' | 'sign' | 'success';

export default function SignContract() {
  const { contractId } = useParams<{ contractId: string }>();
  const [contract, setContract] = useState<ContractData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Step management
  const [step, setStep] = useState<Step>('email');
  
  // Form state
  const [signerEmail, setSignerEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [signerName, setSignerName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  
  // Loading states
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchContract();
  }, [contractId]);

  const fetchContract = async () => {
    if (!contractId) {
      setError("Invalid contract link");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contracts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_contract', contractId }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.status === 'signed') {
          setError("This contract has already been signed.");
        } else if (data.status === 'draft') {
          setError("This contract is not ready for signing yet.");
        } else {
          setError(data.error || "Failed to load contract");
        }
        setIsLoading(false);
        return;
      }

      setContract(data.contract);

      // Pre-fill email and name from lead data
      if (data.contract.deals?.leads?.email) {
        setSignerEmail(data.contract.deals.leads.email);
      }
      if (data.contract.deals?.leads) {
        const lead = data.contract.deals.leads;
        setSignerName(`${lead.first_name} ${lead.last_name}`);
      }
    } catch (err) {
      console.error('Error fetching contract:', err);
      setError("Failed to load contract. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    if (!signerEmail.trim()) {
      toast.error("Please enter your email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signerEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSendingOtp(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contracts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'request_signing_otp',
            contractId,
            email: signerEmail.trim().toLowerCase(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to send verification code");
        return;
      }

      toast.success("Verification code sent to your email");
      setStep('otp');
    } catch (err) {
      console.error('Error requesting OTP:', err);
      toast.error("Failed to send verification code. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      toast.error("Please enter the 6-digit verification code");
      return;
    }

    setIsVerifyingOtp(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contracts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'verify_signing_otp',
            contractId,
            email: signerEmail.trim().toLowerCase(),
            otpCode,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Invalid verification code");
        if (data.error?.includes('request a new')) {
          setOtpCode('');
        }
        return;
      }

      setSessionToken(data.sessionToken);
      toast.success("Email verified successfully");
      setStep('sign');
    } catch (err) {
      console.error('Error verifying OTP:', err);
      toast.error("Failed to verify code. Please try again.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSign = async () => {
    if (!signerName.trim()) {
      toast.error("Please enter your full name");
      return;
    }

    if (!agreed) {
      toast.error("Please agree to the terms to sign the contract");
      return;
    }

    if (!sessionToken) {
      toast.error("Verification expired. Please verify your email again.");
      setStep('email');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contracts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sign_contract',
            contractId,
            signerName: signerName.trim(),
            signerEmail: signerEmail.trim().toLowerCase(),
            sessionToken,
            agreed: true,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.error?.includes('verification') || data.error?.includes('session')) {
          toast.error("Session expired. Please verify your email again.");
          setStep('email');
          setSessionToken(null);
        } else {
          toast.error(data.error || "Failed to sign contract");
        }
        return;
      }

      setStep('success');
      toast.success("Contract signed successfully!");
    } catch (err) {
      console.error('Error signing contract:', err);
      toast.error("Failed to sign contract. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading contract...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-semibold mb-2">Unable to Load Contract</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Contract Signed!</h2>
            <p className="text-muted-foreground mb-4">
              Thank you, {signerName}. Your signature has been recorded successfully.
            </p>
            <p className="text-sm text-muted-foreground">
              A confirmation has been sent to {signerEmail}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <FileSignature className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h1 className="text-2xl font-bold">{contract?.title}</h1>
          {contract?.deals && (
            <p className="text-muted-foreground mt-2">
              {contract.deals.title} • ${contract.deals.value.toLocaleString()}
            </p>
          )}
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            step === 'email' ? 'bg-primary text-primary-foreground' : 
            step === 'otp' || step === 'sign' ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
          }`}>
            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-current/20 text-xs">1</span>
            Email
          </div>
          <div className="w-8 h-px bg-border" />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            step === 'otp' ? 'bg-primary text-primary-foreground' : 
            step === 'sign' ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
          }`}>
            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-current/20 text-xs">2</span>
            Verify
          </div>
          <div className="w-8 h-px bg-border" />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            step === 'sign' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}>
            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-current/20 text-xs">3</span>
            Sign
          </div>
        </div>

        {/* Contract Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contract Terms</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] rounded-lg border bg-muted/30 p-4">
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {contract?.content}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Step 1: Email Verification Request */}
        {step === 'email' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Verify Your Email
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                To sign this contract, we need to verify your email address. Enter your email below and we'll send you a verification code.
              </p>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address *</label>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  disabled={isSendingOtp}
                />
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={handleRequestOtp}
                disabled={isSendingOtp || !signerEmail}
              >
                {isSendingOtp ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Verification Code
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: OTP Verification */}
        {step === 'otp' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Enter Verification Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We've sent a 6-digit code to <strong>{signerEmail}</strong>. Enter it below to verify your identity.
              </p>
              
              <div className="flex justify-center py-4">
                <InputOTP
                  maxLength={6}
                  value={otpCode}
                  onChange={(value) => setOtpCode(value)}
                  disabled={isVerifyingOtp}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={handleVerifyOtp}
                disabled={isVerifyingOtp || otpCode.length !== 6}
              >
                {isVerifyingOtp ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Verify Code
                  </>
                )}
              </Button>

              <div className="text-center">
                <Button
                  variant="link"
                  className="text-sm"
                  onClick={() => {
                    setOtpCode('');
                    handleRequestOtp();
                  }}
                  disabled={isSendingOtp}
                >
                  Didn't receive the code? Resend
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Sign Contract */}
        {step === 'sign' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSignature className="h-5 w-5" />
                Sign This Contract
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg">
                <ShieldCheck className="h-5 w-5 text-success" />
                <div>
                  <p className="text-sm font-medium text-success">Email Verified</p>
                  <p className="text-xs text-muted-foreground">{signerEmail}</p>
                </div>
                <Badge variant="outline" className="ml-auto text-success border-success/30">Verified</Badge>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Full Legal Name *</label>
                <Input
                  placeholder="Enter your full name"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <Separator />

              <div className="flex items-start gap-3">
                <Checkbox
                  id="agreement"
                  checked={agreed}
                  onCheckedChange={(checked) => setAgreed(checked === true)}
                  disabled={isSubmitting}
                />
                <label htmlFor="agreement" className="text-sm leading-relaxed cursor-pointer">
                  I, <strong>{signerName || '[Your Name]'}</strong>, have read and understood the terms of this 
                  contract. By checking this box and clicking "Sign Contract" below, I agree to be legally 
                  bound by the terms and conditions set forth in this agreement.
                </label>
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={handleSign}
                disabled={isSubmitting || !agreed || !signerName}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Signing...
                  </>
                ) : (
                  <>
                    <FileSignature className="h-4 w-4 mr-2" />
                    Sign Contract
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                By signing, you agree that your electronic signature is legally binding. 
                Your IP address and timestamp will be recorded.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
