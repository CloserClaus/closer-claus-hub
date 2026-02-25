import { useState, useEffect } from 'react';
import { Mail, Check, Trash2, Loader2, Plus, Link2 } from 'lucide-react';
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

  const providers = [
    { value: 'instantly', label: 'Instantly' },
    { value: 'smartlead', label: 'Smartlead' },
    { value: 'lemlist', label: 'Lemlist' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Connections
          </CardTitle>
          <CardDescription>
            Connect your email sending provider to send emails directly from the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connected providers */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : connections.length > 0 ? (
            <div className="space-y-3">
              {connections.map((conn) => (
                <div key={conn.id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Link2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium capitalize">{conn.provider_name || conn.provider}</p>
                      {conn.gmail_email && (
                        <p className="text-sm text-muted-foreground">{conn.gmail_email}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-50 dark:bg-green-950/20">
                      <Check className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDisconnect(conn.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No email providers connected yet</p>
              <p className="text-xs mt-1">Connect a provider to start sending emails from the platform</p>
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
