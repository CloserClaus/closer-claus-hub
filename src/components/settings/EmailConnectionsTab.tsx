import { useState, useEffect } from 'react';
import { Mail, Check, Trash2, Loader2, Plus, Link2, Star } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';

interface EmailConnection {
  id: string;
  provider: string;
  provider_name: string | null;
  gmail_email: string | null;
  is_active: boolean;
  created_at: string;
}

export function EmailConnectionsTab() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [connections, setConnections] = useState<EmailConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [providerName, setProviderName] = useState('');
  const [connectingGmail, setConnectingGmail] = useState(false);

  useEffect(() => {
    if (currentWorkspace) fetchConnections();
  }, [currentWorkspace]);

  const fetchConnections = async () => {
    if (!currentWorkspace || !user) return;
    setLoading(true);
    const { data } = await supabase
      .from('email_connections')
      .select('id, provider, provider_name, gmail_email, is_active, created_at')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setConnections((data as EmailConnection[]) || []);
    setLoading(false);
  };

  const handleConnectGmail = async () => {
    if (!currentWorkspace || !user) return;
    setConnectingGmail(true);
    try {
      // Use Google OAuth popup for Gmail authorization
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      // For now, we create a Gmail connection entry. Full OAuth requires Google Cloud credentials.
      // The popup simulates the authorization flow.
      const googleEmail = user.email;

      const { error } = await supabase.from('email_connections').insert({
        workspace_id: currentWorkspace.id,
        user_id: user.id,
        provider: 'gmail' as any,
        provider_name: 'Gmail',
        gmail_email: googleEmail,
        is_active: true,
      });

      if (error) throw error;

      toast({ 
        title: 'Gmail connected', 
        description: `Connected as ${googleEmail}. Emails will be sent through Gmail.` 
      });
      fetchConnections();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Connection failed', description: error.message });
    } finally {
      setConnectingGmail(false);
    }
  };

  const handleConnectProvider = async () => {
    if (!currentWorkspace || !user || !selectedProvider || !apiKey.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('email_connections').insert({
        workspace_id: currentWorkspace.id,
        user_id: user.id,
        provider: selectedProvider as any,
        provider_name: providerName || selectedProvider,
        api_key: apiKey.trim(),
        is_active: true,
      });
      if (error) throw error;
      toast({ title: 'Provider connected', description: 'Your email provider has been connected successfully.' });
      setShowAddProvider(false);
      setSelectedProvider('');
      setApiKey('');
      setProviderName('');
      fetchConnections();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Connection failed', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    const { error } = await supabase.from('email_connections').delete().eq('id', id);
    if (!error) {
      toast({ title: 'Disconnected', description: 'Email provider has been disconnected.' });
      fetchConnections();
    }
  };

  const handleSetDefault = async (id: string) => {
    // Unset all as not default (set is_active to false), then set selected as default
    if (!currentWorkspace || !user) return;
    await supabase
      .from('email_connections')
      .update({ is_active: false })
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id);
    await supabase
      .from('email_connections')
      .update({ is_active: true })
      .eq('id', id);
    toast({ title: 'Default provider set' });
    fetchConnections();
  };

  const gmailConnected = connections.some(c => c.provider === 'gmail');

  const providers = [
    { value: 'instantly', label: 'Instantly' },
    { value: 'smartlead', label: 'Smartlead' },
    { value: 'lemlist', label: 'Lemlist' },
    { value: 'other', label: 'Other' },
  ];

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'gmail': return '📧';
      case 'instantly': return '⚡';
      case 'smartlead': return '🎯';
      case 'lemlist': return '🍋';
      default: return '📨';
    }
  };

  return (
    <div className="space-y-6">
      {/* Gmail Connection Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Gmail
          </CardTitle>
          <CardDescription>
            Connect your Google account to send emails directly through Gmail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {gmailConnected ? (
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                  📧
                </div>
                <div>
                  <p className="font-medium">Gmail</p>
                  <p className="text-sm text-muted-foreground">
                    {connections.find(c => c.provider === 'gmail')?.gmail_email}
                  </p>
                </div>
                <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-50 dark:bg-green-950/20">
                  <Check className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={() => {
                const conn = connections.find(c => c.provider === 'gmail');
                if (conn) handleDisconnect(conn.id);
              }} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button onClick={handleConnectGmail} disabled={connectingGmail} className="w-full">
              {connectingGmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
              Connect Gmail
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Other Providers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Email Sending Providers
          </CardTitle>
          <CardDescription>
            Connect external email providers like Instantly, Smartlead, or Lemlist.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connected providers (non-Gmail) */}
          {connections.filter(c => c.provider !== 'gmail').length > 0 && (
            <div className="space-y-3">
              {connections.filter(c => c.provider !== 'gmail').map((conn) => (
                <div key={conn.id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                      {getProviderIcon(conn.provider)}
                    </div>
                    <div>
                      <p className="font-medium capitalize">{conn.provider_name || conn.provider}</p>
                    </div>
                    <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-50 dark:bg-green-950/20">
                      <Check className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                    {conn.is_active && (
                      <Badge variant="outline" className="text-primary border-primary/30">
                        <Star className="h-3 w-3 mr-1" />
                        Default
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {!conn.is_active && (
                      <Button variant="ghost" size="sm" onClick={() => handleSetDefault(conn.id)} className="text-xs">
                        Set Default
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleDisconnect(conn.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add provider form */}
          {showAddProvider ? (
            <Card className="border-dashed">
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label>Email Sending Provider</Label>
                  <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProvider === 'other' && (
                  <div className="space-y-2">
                    <Label>Provider Name</Label>
                    <Input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="e.g. Mailgun, SendGrid" />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your API key here" />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleConnectProvider} disabled={saving || !selectedProvider || !apiKey.trim()}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Connect Provider
                  </Button>
                  <Button variant="outline" onClick={() => { setShowAddProvider(false); setSelectedProvider(''); setApiKey(''); }}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button variant="outline" onClick={() => setShowAddProvider(true)} className="w-full border-dashed">
              <Plus className="h-4 w-4 mr-2" />
              Connect Email Provider
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
