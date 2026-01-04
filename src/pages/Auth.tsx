import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Headphones, ArrowLeft, KeyRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import logoFull from '@/assets/logo-full.png';

// Personal email domains to block for agency sign-up
const personalEmailDomains = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'aol.com', 'icloud.com', 'me.com', 'mac.com', 'msn.com',
  'protonmail.com', 'proton.me', 'tutanota.com', 'zoho.com',
  'yandex.com', 'mail.com', 'gmx.com', 'fastmail.com',
];

const isCompanyEmail = (email: string): boolean => {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? !personalEmailDomains.includes(domain) : false;
};

const signInSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const agencySignUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Please enter a valid email address').max(255)
    .refine(isCompanyEmail, 'Please use your company email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const sdrSignUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Please enter a valid email address').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignInFormData = z.infer<typeof signInSchema>;
type AgencySignUpFormData = z.infer<typeof agencySignUpSchema>;
type SDRSignUpFormData = z.infer<typeof sdrSignUpSchema>;

type AuthMode = 'signin' | 'signup-select' | 'signup-agency' | 'signup-sdr' | 'forgot-password' | 'reset-password';

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [isLoading, setIsLoading] = useState(false);
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Check for password recovery token on mount
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    
    if (type === 'recovery' && accessToken) {
      setMode('reset-password');
    }
  }, []);

  useEffect(() => {
    // Don't redirect if we're in reset-password mode
    if (mode === 'reset-password') return;
    
    if (user) {
      if (!userRole) {
        navigate('/role-select');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, userRole, navigate, mode]);

  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const agencySignUpForm = useForm<AgencySignUpFormData>({
    resolver: zodResolver(agencySignUpSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  const sdrSignUpForm = useForm<SDRSignUpFormData>({
    resolver: zodResolver(sdrSignUpSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  const handleSignIn = async (data: SignInFormData) => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    setIsLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Sign in failed',
        description: error.message === 'Invalid login credentials' 
          ? 'Invalid email or password. Please try again.'
          : error.message,
      });
    }
  };

  const handleAgencySignUp = async (data: AgencySignUpFormData) => {
    setIsLoading(true);
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: data.fullName,
          signup_role: 'agency_owner',
        },
      },
    });
    setIsLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({
          variant: 'destructive',
          title: 'Account exists',
          description: 'An account with this email already exists. Please sign in instead.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Sign up failed',
          description: error.message,
        });
      }
    } else {
      toast({
        title: 'Account created',
        description: 'Welcome to Closer Claus! Complete your agency setup.',
      });
    }
  };

  const handleSDRSignUp = async (data: SDRSignUpFormData) => {
    setIsLoading(true);
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: data.fullName,
          signup_role: 'sdr',
        },
      },
    });
    setIsLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({
          variant: 'destructive',
          title: 'Account exists',
          description: 'An account with this email already exists. Please sign in instead.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Sign up failed',
          description: error.message,
        });
      }
    } else {
      toast({
        title: 'Account created',
        description: 'Welcome to Closer Claus! Start finding jobs.',
      });
    }
  };

  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  
  // Password reset state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    
    setIsResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/auth`,
    });
    setIsResetting(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } else {
      setResetSent(true);
      toast({
        title: 'Check your email',
        description: 'We sent you a password reset link.',
      });
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Password must be at least 6 characters.',
      });
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Passwords do not match.',
      });
      return;
    }
    
    setIsUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsUpdatingPassword(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } else {
      toast({
        title: 'Password updated',
        description: 'Your password has been successfully updated.',
      });
      // Clear hash and redirect to sign in
      window.history.replaceState(null, '', '/auth');
      setMode('signin');
      setNewPassword('');
      setConfirmNewPassword('');
    }
  };

  const renderForgotPassword = () => (
    <Card className="w-full max-w-md glass animate-fade-in relative">
      <CardHeader className="text-center space-y-4">
        <button
          type="button"
          onClick={() => { setMode('signin'); setResetSent(false); setResetEmail(''); }}
          className="absolute left-4 top-4 p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex justify-center">
          <img src={logoFull} alt="Closer Claus" className="h-12 object-contain" />
        </div>
        <div>
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <CardDescription className="text-muted-foreground">
            {resetSent 
              ? 'Check your email for a reset link'
              : 'Enter your email to receive a reset link'}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {resetSent ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">
              We've sent a password reset link to <strong>{resetEmail}</strong>
            </p>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => { setMode('signin'); setResetSent(false); setResetEmail(''); }}
            >
              Back to Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="bg-muted border-border"
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90" 
              disabled={isResetting || !resetEmail.trim()}
            >
              {isResetting ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
        )}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => { setMode('signin'); setResetSent(false); setResetEmail(''); }}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Back to Sign In
          </button>
        </div>
      </CardContent>
    </Card>
  );

  const renderResetPassword = () => (
    <Card className="w-full max-w-md glass animate-fade-in relative">
      <CardHeader className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
        </div>
        <div>
          <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your new password below
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">New Password</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-muted border-border"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Confirm New Password</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="bg-muted border-border"
              required
              minLength={6}
            />
          </div>
          <Button 
            type="submit" 
            className="w-full bg-primary hover:bg-primary/90" 
            disabled={isUpdatingPassword || !newPassword || !confirmNewPassword}
          >
            {isUpdatingPassword ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  const renderSignIn = () => (
    <Card className="w-full max-w-md glass animate-fade-in relative">
      <CardHeader className="text-center space-y-4">
        <div className="flex justify-center">
          <img src={logoFull} alt="Closer Claus" className="h-12 object-contain" />
        </div>
        <div>
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in to your account to continue
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...signInForm}>
          <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-4">
            <FormField
              control={signInForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="you@example.com" 
                      {...field}
                      className="bg-muted border-border"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={signInForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      {...field}
                      className="bg-muted border-border"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90" 
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </Form>
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setMode('forgot-password')}
            className="text-sm text-primary hover:underline transition-colors"
          >
            Forgot your password?
          </button>
        </div>
        <div className="mt-2 text-center">
          <button
            type="button"
            onClick={() => setMode('signup-select')}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Don't have an account? Sign up
          </button>
        </div>
      </CardContent>
    </Card>
  );

  const renderSignUpSelect = () => (
    <div className="w-full max-w-2xl animate-fade-in relative">
      <div className="text-center mb-8">
        <img src={logoFull} alt="Closer Claus" className="h-12 mx-auto object-contain mb-6" />
        <h1 className="text-3xl font-bold mb-2">Create Your Account</h1>
        <p className="text-muted-foreground">How do you want to use Closer Claus?</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card 
          className="cursor-pointer transition-all duration-200 hover:border-primary/50 hover:glow-sm"
          onClick={() => setMode('signup-agency')}
        >
          <CardHeader>
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-xl">I'm an Agency Owner</CardTitle>
            <CardDescription>
              Hire SDRs and manage your sales team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Post jobs and hire SDRs
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Access CRM and Dialer
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Manage commissions
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer transition-all duration-200 hover:border-primary/50 hover:glow-sm"
          onClick={() => setMode('signup-sdr')}
        >
          <CardHeader>
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
              <Headphones className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-xl">I'm an SDR / Closer</CardTitle>
            <CardDescription>
              Find jobs and earn commissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Browse and apply to jobs
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Work with multiple agencies
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Earn commission on deals
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => setMode('signin')}
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          Already have an account? Sign in
        </button>
      </div>
    </div>
  );

  const renderAgencySignUp = () => (
    <Card className="w-full max-w-md glass animate-fade-in relative">
      <CardHeader className="text-center space-y-4">
        <button
          type="button"
          onClick={() => setMode('signup-select')}
          className="absolute left-4 top-4 p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
        </div>
        <div>
          <CardTitle className="text-2xl font-bold">Agency Sign Up</CardTitle>
          <CardDescription className="text-muted-foreground">
            Create your agency account
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...agencySignUpForm}>
          <form onSubmit={agencySignUpForm.handleSubmit(handleAgencySignUp)} className="space-y-4">
            <FormField
              control={agencySignUpForm.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="John Doe" 
                      {...field}
                      className="bg-muted border-border"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={agencySignUpForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="you@yourcompany.com" 
                      {...field}
                      className="bg-muted border-border"
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    Personal email addresses (Gmail, Yahoo, etc.) are not accepted
                  </p>
                </FormItem>
              )}
            />
            <FormField
              control={agencySignUpForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      {...field}
                      className="bg-muted border-border"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={agencySignUpForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      {...field}
                      className="bg-muted border-border"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90" 
              disabled={isLoading}
            >
              {isLoading ? 'Creating account...' : 'Create Agency Account'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );

  const renderSDRSignUp = () => (
    <Card className="w-full max-w-md glass animate-fade-in relative">
      <CardHeader className="text-center space-y-4">
        <button
          type="button"
          onClick={() => setMode('signup-select')}
          className="absolute left-4 top-4 p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <Headphones className="w-8 h-8 text-primary" />
          </div>
        </div>
        <div>
          <CardTitle className="text-2xl font-bold">SDR Sign Up</CardTitle>
          <CardDescription className="text-muted-foreground">
            Start your sales career
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...sdrSignUpForm}>
          <form onSubmit={sdrSignUpForm.handleSubmit(handleSDRSignUp)} className="space-y-4">
            <FormField
              control={sdrSignUpForm.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="John Doe" 
                      {...field}
                      className="bg-muted border-border"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={sdrSignUpForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="you@example.com" 
                      {...field}
                      className="bg-muted border-border"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={sdrSignUpForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      {...field}
                      className="bg-muted border-border"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={sdrSignUpForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      {...field}
                      className="bg-muted border-border"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90" 
              disabled={isLoading}
            >
              {isLoading ? 'Creating account...' : 'Create SDR Account'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      {mode === 'signin' && renderSignIn()}
      {mode === 'signup-select' && renderSignUpSelect()}
      {mode === 'signup-agency' && renderAgencySignUp()}
      {mode === 'signup-sdr' && renderSDRSignUp()}
      {mode === 'forgot-password' && renderForgotPassword()}
      {mode === 'reset-password' && renderResetPassword()}
    </div>
  );
}
