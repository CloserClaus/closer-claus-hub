import { useState, useEffect } from 'react';
import { Mail, Check, Trash2, Loader2, Plus, Link2, User, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useEmailInbox, type EmailProvider, type EmailInbox } from '@/hooks/useEmailInbox';
import { supabase } from '@/integrations/supabase/client';

export function EmailConnectionsTab() {
  const { user } = useAuth();
  const { currentWorkspace, isOwner } = useWorkspace();
  const { toast } = useToast();
  const { providers, allInboxes, loading, refresh } = useEmailInbox();
  const [saving, setSaving] = useState(false);
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [selectedProviderType, setSelectedProviderType] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [providerName, setProviderName] = useState('');
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<{ id: string; full_name: string; email: string }[]>([]);

  useEffect(() => {
    if (currentWorkspace && isOwner) fetchMembers();
  }, [currentWorkspace, isOwner]);

  const fetchMembers = async () => {
    if (!currentWorkspace) return;
    // Get workspace owner + members
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', currentWorkspace.id)
      .is('removed_at', null);

    const memberIds = [currentWorkspace.owner_id, ...((members as any[]) || []).map(m => m.user_id)];
    const uniqueIds = [...new Set(memberIds)];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', uniqueIds);

    setWorkspaceMembers((profiles as any[]) || []);
  };

  const handleConnectGmail = async () => {
    if (!currentWorkspace || !user) return;
    setConnectingGmail(true);
    try {
      // Create provider entry
      const { data: provider, error: provError } = await supabase
        .from('email_providers')
        .insert({
          workspace_id: currentWorkspace.id,
          provider_type: 'gmail',
          provider_name: 'Gmail',
          status: 'connected',
          created_by: user.id,
          last_validated_at: new Date().toISOString(),
        } as any)
        .select('id')
        .single();

      if (provError) throw provError;

      // Create inbox entry (for now using user email - will use OAuth account selector)
      const gmailEmail = user.email || 'unknown@gmail.com';
      const { error: inboxError } = await supabase
        .from('email_inboxes')
        .insert({
          provider_id: provider.id,
          workspace_id: currentWorkspace.id,
          email_address: gmailEmail,
          status: 'active',
        } as any);

      if (inboxError) throw inboxError;

      // Audit log
      await supabase.from('email_audit_log').insert({
        workspace_id: currentWorkspace.id,
        action_type: 'provider_connected',
        actor_id: user.id,
        provider_id: provider.id,
        metadata: { provider_type: 'gmail', email: gmailEmail },
      } as any);

      toast({ title: 'Gmail connected', description: `Inbox ${gmailEmail} added.` });
      refresh();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Connection failed', description: error.message });
    } finally {
      setConnectingGmail(false);
    }
  };

  const handleConnectProvider = async () => {
    if (!currentWorkspace || !user || !selectedProviderType || !apiKey.trim()) return;
    setSaving(true);
    try {
      const { data: provider, error: provError } = await supabase
        .from('email_providers')
        .insert({
          workspace_id: currentWorkspace.id,
          provider_type: selectedProviderType,
          provider_name: providerName || selectedProviderType,
          api_key: apiKey.trim(),
          status: 'connected',
          created_by: user.id,
          last_validated_at: new Date().toISOString(),
        } as any)
        .select('id')
        .single();

      if (provError) throw provError;

      // For API providers, create a placeholder inbox (provider would return real inboxes)
      const { error: inboxError } = await supabase
        .from('email_inboxes')
        .insert({
          provider_id: provider.id,
          workspace_id: currentWorkspace.id,
          email_address: `inbox@${selectedProviderType}.connected`,
          external_inbox_id: 'default',
          status: 'active',
        } as any);

      if (inboxError) throw inboxError;

      await supabase.from('email_audit_log').insert({
        workspace_id: currentWorkspace.id,
        action_type: 'provider_connected',
        actor_id: user.id,
        provider_id: provider.id,
        metadata: { provider_type: selectedProviderType },
      } as any);

      toast({ title: 'Provider connected' });
      setShowAddProvider(false);
      setSelectedProviderType('');
      setApiKey('');
      setProviderName('');
      refresh();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Connection failed', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnectProvider = async (providerId: string) => {
    // Cascade deletes inboxes
    const { error } = await supabase.from('email_providers').delete().eq('id', providerId);
    if (!error) {
      toast({ title: 'Provider disconnected' });
      refresh();
    }
  };

  const handleAssignInbox = async (inboxId: string, userId: string | null) => {
    const { error } = await supabase
      .from('email_inboxes')
      .update({ assigned_to: userId } as any)
      .eq('id', inboxId);

    if (!error) {
      await supabase.from('email_audit_log').insert({
        workspace_id: currentWorkspace!.id,
        action_type: 'inbox_assigned',
        actor_id: user!.id,
        inbox_id: inboxId,
        metadata: { assigned_to: userId },
      } as any);
      toast({ title: userId ? 'Inbox assigned' : 'Inbox unassigned' });
      refresh();
    }
  };

  const providerTypes = [
    { value: 'instantly', label: 'Instantly' },
    { value: 'smartlead', label: 'Smartlead' },
    { value: 'lemlist', label: 'Lemlist' },
    { value: 'other', label: 'Other' },
  ];

  const getProviderIcon = (type: string) => {
    switch (type) {
      case 'gmail': return '📧';
      case 'instantly': return '⚡';
      case 'smartlead': return '🎯';
      case 'lemlist': return '🍋';
      default: return '📨';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
      case 'active':
        return (
          <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-50 dark:bg-green-950/20">
            <Check className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">
            <AlertCircle className="h-3 w-3 mr-1" />
            Disconnected
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-600/30 bg-amber-50 dark:bg-amber-950/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const gmailProvider = providers.find(p => p.provider_type === 'gmail');

  return (
    <div className="space-y-6">
      {/* Gmail Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Gmail
          </CardTitle>
          <CardDescription>
            Connect Google accounts to send emails directly through Gmail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {gmailProvider ? (
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">📧</div>
                <div>
                  <p className="font-medium">Gmail</p>
                  <p className="text-sm text-muted-foreground">
                    {gmailProvider.inboxes.map(i => i.email_address).join(', ')}
                  </p>
                </div>
                {getStatusBadge(gmailProvider.status)}
              </div>
              <div className="flex gap-1">
                {isOwner && (
                  <>
                    <Button variant="ghost" size="sm" onClick={handleConnectGmail} className="text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      Add Inbox
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDisconnectProvider(gmailProvider.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            isOwner && (
              <Button onClick={handleConnectGmail} disabled={connectingGmail} className="w-full">
                {connectingGmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                Connect Gmail
              </Button>
            )
          )}
          {!isOwner && !gmailProvider && (
            <p className="text-sm text-muted-foreground">Ask your agency owner to connect email providers.</p>
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
            Connect external providers. Each can have multiple inboxes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers.filter(p => p.provider_type !== 'gmail').map((prov) => (
            <div key={prov.id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                  {getProviderIcon(prov.provider_type)}
                </div>
                <div>
                  <p className="font-medium capitalize">{prov.provider_name || prov.provider_type}</p>
                  <p className="text-xs text-muted-foreground">{prov.inboxes.length} inbox{prov.inboxes.length !== 1 ? 'es' : ''}</p>
                </div>
                {getStatusBadge(prov.status)}
              </div>
              {isOwner && (
                <Button variant="ghost" size="icon" onClick={() => handleDisconnectProvider(prov.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          {isOwner && (
            showAddProvider ? (
              <Card className="border-dashed">
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select value={selectedProviderType} onValueChange={setSelectedProviderType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {providerTypes.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedProviderType === 'other' && (
                    <div className="space-y-2">
                      <Label>Provider Name</Label>
                      <Input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="e.g. Mailgun" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your API key" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleConnectProvider} disabled={saving || !selectedProviderType || !apiKey.trim()}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Connect
                    </Button>
                    <Button variant="outline" onClick={() => { setShowAddProvider(false); setSelectedProviderType(''); setApiKey(''); }}>
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
            )
          )}
        </CardContent>
      </Card>

      {/* Inbox Assignment Table */}
      {allInboxes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Inbox Assignments
            </CardTitle>
            <CardDescription>
              Assign one inbox per SDR. Each SDR sends from their assigned inbox only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Email Address</TableHead>
                    <TableHead>Assigned SDR</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allInboxes.map((inbox) => (
                    <TableRow key={inbox.id}>
                      <TableCell className="capitalize">{inbox.provider_name}</TableCell>
                      <TableCell className="font-medium">{inbox.email_address}</TableCell>
                      <TableCell>
                        {isOwner ? (
                          <Select
                            value={inbox.assigned_to || 'unassigned'}
                            onValueChange={(val) => handleAssignInbox(inbox.id, val === 'unassigned' ? null : val)}
                          >
                            <SelectTrigger className="w-[180px] h-8">
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {workspaceMembers.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.full_name || m.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {inbox.assigned_to
                              ? workspaceMembers.find(m => m.id === inbox.assigned_to)?.full_name || 'Assigned'
                              : 'Unassigned'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(inbox.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Domain volume warning */}
            {(() => {
              const domainCounts: Record<string, number> = {};
              allInboxes.forEach(i => {
                const domain = i.email_address.split('@')[1];
                if (domain) domainCounts[domain] = (domainCounts[domain] || 0) + 1;
              });
              const multiDomains = Object.entries(domainCounts).filter(([_, count]) => count > 1);
              if (multiDomains.length === 0) return null;
              return (
                <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Multiple senders on same domain ({multiDomains.map(([d]) => d).join(', ')}) may affect deliverability.</span>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
