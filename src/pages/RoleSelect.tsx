import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Headphones, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import logoFull from '@/assets/logo-full.png';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface RoleOption {
  role: AppRole;
  title: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
}

const roleOptions: RoleOption[] = [
  {
    role: 'agency_owner',
    title: 'Agency Owner',
    description: 'Manage your team of SDRs and close more deals',
    icon: <Building2 className="w-8 h-8" />,
    features: [
      'Hire and manage SDRs',
      'Track deals and commissions',
      'Access CRM and dialer',
      'Create training materials',
    ],
  },
  {
    role: 'sdr',
    title: 'SDR / Closer',
    description: 'Join agencies and start closing deals',
    icon: <Headphones className="w-8 h-8" />,
    features: [
      'Browse and apply to jobs',
      'Work with multiple agencies',
      'Earn commissions on deals',
      'Access company resources',
    ],
  },
];

export default function RoleSelect() {
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstUser, setIsFirstUser] = useState(false);
  const { user, userRole, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (userRole) {
      navigate('/dashboard');
      return;
    }

    // Check if this is the first user (becomes platform admin)
    const checkFirstUser = async () => {
      const { data } = await supabase.rpc('is_first_user');
      setIsFirstUser(data === true);
    };

    checkFirstUser();
  }, [user, userRole, navigate]);

  const handleSelectRole = async () => {
    if (!selectedRole || !user) return;

    setIsLoading(true);

    try {
      // If first user, they become platform admin
      const roleToInsert = isFirstUser ? 'platform_admin' : selectedRole;

      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: roleToInsert,
        });

      if (error) throw error;

      await refreshProfile();

      toast({
        title: 'Role selected',
        description: isFirstUser 
          ? 'You are now the Platform Admin!'
          : `You are now registered as ${selectedRole === 'agency_owner' ? 'an Agency Owner' : 'an SDR'}`,
      });

      navigate('/onboarding');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to select role. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-3xl space-y-8 animate-fade-in relative">
        <div className="text-center space-y-4">
          <img src={logoFull} alt="Closer Claus" className="h-12 mx-auto object-contain" />
          <h1 className="text-3xl font-bold">Choose Your Role</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Select how you want to use Closer Claus. This determines your dashboard and features.
          </p>
        </div>

        {isFirstUser && (
          <Card className="border-primary/50 bg-primary/10">
            <CardContent className="flex items-center gap-4 p-4">
              <Shield className="w-8 h-8 text-primary" />
              <div>
                <p className="font-medium text-primary">You're the first user!</p>
                <p className="text-sm text-muted-foreground">
                  You'll be assigned as Platform Admin with full system access.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {roleOptions.map((option) => (
            <Card
              key={option.role}
              className={`cursor-pointer transition-all duration-200 hover:border-primary/50 ${
                selectedRole === option.role 
                  ? 'border-primary ring-2 ring-primary/20 glow-sm' 
                  : 'border-border'
              }`}
              onClick={() => setSelectedRole(option.role)}
            >
              <CardHeader>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-2 ${
                  selectedRole === option.role 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {option.icon}
                </div>
                <CardTitle className="text-xl">{option.title}</CardTitle>
                <CardDescription>{option.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {option.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleSelectRole}
            disabled={!selectedRole || isLoading}
            className="min-w-48 bg-primary hover:bg-primary/90"
          >
            {isLoading ? 'Setting up...' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}
