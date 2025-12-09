import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  FileSignature,
  CheckCircle,
  AlertCircle,
  Loader2,
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

export default function SignContract() {
  const { contractId } = useParams<{ contractId: string }>();
  const [contract, setContract] = useState<ContractData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigned, setIsSigned] = useState(false);

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

      // Pre-fill email if available from lead
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

  const handleSign = async () => {
    if (!signerName.trim()) {
      toast.error("Please enter your full name");
      return;
    }

    if (!signerEmail.trim()) {
      toast.error("Please enter your email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signerEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (!agreed) {
      toast.error("Please agree to the terms to sign the contract");
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
            signerEmail: signerEmail.trim(),
            agreed: true,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to sign contract");
        setIsSubmitting(false);
        return;
      }

      setIsSigned(true);
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

  if (isSigned) {
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

        {/* Contract Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contract Terms</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] rounded-lg border bg-muted/30 p-4">
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {contract?.content}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Signature Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sign This Contract</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Legal Name *</label>
                <Input
                  placeholder="Enter your full name"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address *</label>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <Checkbox
                id="agreement"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
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
              disabled={isSubmitting || !agreed || !signerName || !signerEmail}
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
      </div>
    </div>
  );
}