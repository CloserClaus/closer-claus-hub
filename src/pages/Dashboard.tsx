import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Building2, Headphones, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import logoFull from '@/assets/logo-full.png';

export default function Dashboard() {
  const { user, userRole, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }

    if (!loading && user && !userRole) {
      navigate('/role-select');
      return;
    }

    if (!loading && user && userRole && !profile?.onboarding_completed) {
      navigate('/onboarding');
    }
  }, [user, userRole, profile, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const getRoleIcon = () => {
    switch (userRole) {
      case 'platform_admin':
        return <Shield className="w-6 h-6" />;
      case 'agency_owner':
        return <Building2 className="w-6 h-6" />;
      case 'sdr':
        return <Headphones className="w-6 h-6" />;
      default:
        return null;
    }
  };

  const getRoleTitle = () => {
    switch (userRole) {
      case 'platform_admin':
        return 'Platform Admin';
      case 'agency_owner':
        return 'Agency Owner';
      case 'sdr':
        return 'SDR / Closer';
      default:
        return 'User';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <img src={logoFull} alt="Closer Claus" className="h-8 object-contain" />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {getRoleIcon()}
              <span>{getRoleTitle()}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome, {profile?.full_name || 'User'}!
          </h1>
          <p className="text-muted-foreground">
            {userRole === 'platform_admin' && 'Manage the platform from here.'}
            {userRole === 'agency_owner' && 'Manage your agency and team.'}
            {userRole === 'sdr' && 'Find jobs and start closing deals.'}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userRole === 'platform_admin' && (
            <>
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Agencies</CardTitle>
                  <CardDescription>View all registered agencies</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-primary">0</p>
                  <p className="text-sm text-muted-foreground">Total agencies</p>
                </CardContent>
              </Card>
              <Card className="glass">
                <CardHeader>
                  <CardTitle>SDRs</CardTitle>
                  <CardDescription>View all registered SDRs</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-primary">0</p>
                  <p className="text-sm text-muted-foreground">Total SDRs</p>
                </CardContent>
              </Card>
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Disputes</CardTitle>
                  <CardDescription>Pending dispute resolutions</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-warning">0</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </CardContent>
              </Card>
            </>
          )}

          {userRole === 'agency_owner' && (
            <>
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Team</CardTitle>
                  <CardDescription>Your SDR team</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-primary">0</p>
                  <p className="text-sm text-muted-foreground">Active SDRs</p>
                </CardContent>
              </Card>
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Deals</CardTitle>
                  <CardDescription>Active pipeline</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-success">$0</p>
                  <p className="text-sm text-muted-foreground">Pipeline value</p>
                </CardContent>
              </Card>
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Commissions</CardTitle>
                  <CardDescription>Pending payments</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-warning">$0</p>
                  <p className="text-sm text-muted-foreground">Owed to SDRs</p>
                </CardContent>
              </Card>
            </>
          )}

          {userRole === 'sdr' && (
            <>
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Jobs</CardTitle>
                  <CardDescription>Browse available positions</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-primary">0</p>
                  <p className="text-sm text-muted-foreground">Open positions</p>
                </CardContent>
              </Card>
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Earnings</CardTitle>
                  <CardDescription>Your commissions</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-success">$0</p>
                  <p className="text-sm text-muted-foreground">Total earned</p>
                </CardContent>
              </Card>
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Workspaces</CardTitle>
                  <CardDescription>Active agencies</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-primary">0</p>
                  <p className="text-sm text-muted-foreground">Active workspaces</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <Card className="mt-8 border-dashed">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              More features coming soon! The full dashboard with CRM, Dialer, Jobs, and more will be built in the next phases.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
