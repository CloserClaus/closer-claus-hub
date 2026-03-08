import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, Check, Trash2, Loader2, Plus, Link2, User, AlertCircle, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DeleteConfirmDialog } from '@/components/crm/DeleteConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useEmailInbox, type EmailInbox } from '@/hooks/useEmailInbox';
import { supabase } from '@/integrations/supabase/client';

export function EmailAccountsTab() {
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [deleteProviderId, setDeleteProviderId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    const gmailConnected = searchParams.get('gmail_connected');
    const gmailError = searchParams.get('gmail_error');
    const errorEmail = searchParams.get('email');
    if (gmailConnected) {
      toast({ title: 'Gmail inbox connected', description: `${gmailConnected} has been added.` });
      refresh();
      searchParams.delete('gmail_connected');
      setSearchParams(searchParams, { replace: true });
    }
    if (gmailError) {
      let message = 'Failed to connect Gmail account.';
      if (gmailError === 'duplicate') message = `This inbox is already connected${errorEmail ? ` (${errorEmail})` : ''}.`;
      else if (gmailError === 'access_denied') message = 'Google account access was denied.';
      else if (gmailError === 'token_exchange_failed') message = 'Failed to authenticate with Google. Please try again.';
      toast({ variant: 'destructive', title: 'Gmail connection failed', description: message });
      searchParams.delete('gmail_error');
      searchParams.delete('email');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  useEffect(() => {
    if (currentWorkspace && isOwner) fetchMembers();
  }, [currentWorkspace, isOwner]);

  const fetchMembers = async () => {
    if (!currentWorkspace) return;
    const { data: members } = await supabase
      .from('workspace_members').select('user_id')
      .eq('workspace_id', currentWorkspace.id).is('removed_at', null);
    const memberIds = [currentWorkspace.owner_id, ...((members as any[]) || []).map(m => m.user_id)];
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, email').in('id', [...new Set(memberIds)]);
    setWorkspaceMembers((profiles as any[]) || []);
  };

  const handleConnectGmail = async () => {
    if (!currentWorkspace || !user) return;
    setConnectingGmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('gmail-oauth-callback', {
        method: 'POST',
        body: { workspace_id: currentWorkspace.id, user_id: user.id, origin: window.location.origin },
      });
      if (error) throw error;
      if (!data?.auth_url) throw new Error('No auth URL returned');
      window.location.href = data.auth_url;
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Connection failed', description: error.message });
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
          workspace_id: currentWorkspace.id, provider_type: selectedProviderType,
          provider_name: providerName || selectedProviderType, api_key: apiKey.trim(),
          status: 'connected', created_by: user.id, last_validated_at: new Date().toISOString(),
        } as any).select('id').single();
      if (provError) throw provError;
      await supabase.from('email_inboxes').insert({
        provider_id: provider.id, workspace_id: currentWorkspace.id,
        email_address: `inbox@${selectedProviderType}.connected`, external_inbox_id: 'default', status: 'active',
      } as any);
      toast({ title: 'Provider connected' });
      setShowAddProvider(false); setSelectedProviderType(''); setApiKey(''); setProviderName('');
      refresh();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Connection failed', description: error.message });
    } finally { setSaving(false); }
  };

  const handleDisconnectProvider = (providerId: string) => {
    setDeleteProviderId(providerId);
  };

  const confirmDisconnect = async () => {
    if (!deleteProviderId) return;
    setDisconnecting(true);
    try {
      // Get all inboxes for this provider
      const { data: inboxes } = await supabase
        .from('email_inboxes')
        .select('id')
        .eq('provider_id', deleteProviderId);

      if (inboxes && inboxes.length > 0) {
        const inboxIds = inboxes.map((i: any) => i.id);

        // Complete any active follow-ups using these inboxes
        await supabase
          .from('active_follow_ups')
          .update({ status: 'completed', completed_at: new Date().toISOString() } as any)
          .in('sender_inbox_id', inboxIds)
          .in('status', ['active', 'paused']);

        // Reset affected leads' sending state
        const { data: affectedFollowUps } = await supabase
          .from('active_follow_ups')
          .select('lead_id')
          .in('sender_inbox_id', inboxIds);

        if (affectedFollowUps && affectedFollowUps.length > 0) {
          const leadIds = [...new Set(affectedFollowUps.map((f: any) => f.lead_id))];
          for (const leadId of leadIds) {
            await supabase.from('leads').update({ email_sending_state: 'idle' } as any).eq('id', leadId);
          }
        }
      }

      // Delete the provider (cascades to inboxes)
      const { error } = await supabase.from('email_providers').delete().eq('id', deleteProviderId);
      if (!error) { toast({ title: 'Provider disconnected' }); refresh(); }
      else { toast({ variant: 'destructive', title: 'Failed to disconnect', description: error.message }); }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setDisconnecting(false);
      setDeleteProviderId(null);
    }
  };

  const handleAssignInbox = async (inboxId: string, userId: string | null) => {
    const { error } = await supabase.from('email_inboxes').update({ assigned_to: userId } as any).eq('id', inboxId);
    if (!error) {
      await supabase.from('email_audit_log').insert({
        workspace_id: currentWorkspace!.id, action_type: 'inbox_assigned',
        actor_id: user!.id, inbox_id: inboxId, metadata: { assigned_to: userId },
      } as any);
      toast({ title: userId ? 'Inbox assigned' : 'Inbox unassigned' }); refresh();
    }
  };

  const handleUpdateDailyLimit = async (inboxId: string, limit: number) => {
    await supabase.from('email_inboxes').update({ daily_send_limit: limit } as any).eq('id', inboxId);
    refresh();
  };

  const handleToggleWarmup = async (inboxId: string, enabled: boolean) => {
    await supabase.from('email_inboxes').update({ warmup_enabled: enabled } as any).eq('id', inboxId);
    refresh();
  };

  const providerTypes = [
    { value: 'instantly', label: 'Instantly' },
    { value: 'smartlead', label: 'Smartlead' },
    { value: 'lemlist', label: 'Lemlist' },
    { value: 'other', label: 'Other' },
  ];

  const getProviderIcon = (type: string) => {
    switch (type) {
      case 'gmail': return '📧'; case 'instantly': return '⚡';
      case 'smartlead': return '🎯'; case 'lemlist': return '🍋'; default: return '📨';
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'connected' || status === 'active') return (
      <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-50 dark:bg-green-950/20">
        <Check className="h-3 w-3 mr-1" />Connected
      </Badge>
    );
    if (status === 'disconnected') return (
      <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">
        <AlertCircle className="h-3 w-3 mr-1" />Disconnected
      </Badge>
    );
    return <Badge variant="secondary">{status}</Badge>;
  };

  const gmailProvider = providers.find(p => p.provider_type === 'gmail');

  return (
    <div className="space-y-6">
      {/* Gmail Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Gmail</CardTitle>
          <CardDescription>Connect Google accounts to send emails directly through Gmail.</CardDescription>
        </CardHeader>
        <CardContent>
          {gmailProvider ? (
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">📧</div>
                <div>
                  <p className="font-medium">Gmail</p>
                  <p className="text-sm text-muted-foreground">{gmailProvider.inboxes.map(i => i.email_address).join(', ')}</p>
                </div>
                {getStatusBadge(gmailProvider.status)}
              </div>
              <div className="flex gap-1">
                {isOwner && (
                  <>
                    <Button variant="ghost" size="sm" onClick={handleConnectGmail} className="text-xs">
                      <Plus className="h-3 w-3 mr-1" />Add Inbox
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDisconnectProvider(gmailProvider.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : isOwner ? (
            <Button onClick={handleConnectGmail} disabled={connectingGmail} className="w-full">
              {connectingGmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
              Connect Gmail
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Ask your agency owner to connect email providers.</p>
          )}
        </CardContent>
      </Card>

      {/* Other Providers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" />Email Sending Providers</CardTitle>
          <CardDescription>Connect external providers. Each can have multiple inboxes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers.filter(p => p.provider_type !== 'gmail').map((prov) => (
            <div key={prov.id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">{getProviderIcon(prov.provider_type)}</div>
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
                      <SelectTrigger><SelectValue placeholder="Select a provider" /></SelectTrigger>
                      <SelectContent>
                        {providerTypes.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}
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
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Connect
                    </Button>
                    <Button variant="outline" onClick={() => { setShowAddProvider(false); setSelectedProviderType(''); setApiKey(''); }}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Button variant="outline" onClick={() => setShowAddProvider(true)} className="w-full border-dashed">
                <Plus className="h-4 w-4 mr-2" />Connect Email Provider
              </Button>
            )
          )}
        </CardContent>
      </Card>

      {/* Inbox Management Table */}
      {allInboxes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Inbox Management</CardTitle>
            <CardDescription>Assign inboxes to SDRs, set daily limits, and control warmup status.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Email Address</TableHead>
                    <TableHead>Assigned SDR</TableHead>
                    <TableHead>Daily Limit</TableHead>
                    <TableHead>Sent Today</TableHead>
                    <TableHead>Warmup</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allInboxes.map((inbox: any) => (
                    <TableRow key={inbox.id}>
                      <TableCell className="capitalize">{inbox.provider_name}</TableCell>
                      <TableCell className="font-medium">{inbox.email_address}</TableCell>
                      <TableCell>
                        {isOwner ? (
                          <Select value={inbox.assigned_to || 'unassigned'} onValueChange={(val) => handleAssignInbox(inbox.id, val === 'unassigned' ? null : val)}>
                            <SelectTrigger className="w-[160px] h-8"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {workspaceMembers.map((m) => (<SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {inbox.assigned_to ? workspaceMembers.find(m => m.id === inbox.assigned_to)?.full_name || 'Assigned' : 'Unassigned'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isOwner ? (
                          <Input
                            type="number" min={1} max={500}
                            value={inbox.daily_send_limit ?? 50}
                            onChange={(e) => handleUpdateDailyLimit(inbox.id, parseInt(e.target.value) || 50)}
                            className="w-20 h-8"
                          />
                        ) : (
                          <span className="text-sm">{inbox.daily_send_limit ?? 50}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {inbox.sends_today ?? 0} / {inbox.daily_send_limit ?? 50}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={inbox.warmup_enabled ?? false}
                          onCheckedChange={(v) => handleToggleWarmup(inbox.id, v)}
                          disabled={!isOwner}
                        />
                      </TableCell>
                      <TableCell>{getStatusBadge(inbox.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <DeleteConfirmDialog
        open={!!deleteProviderId}
        onOpenChange={(open) => { if (!open) setDeleteProviderId(null); }}
        title="Disconnect Email Provider"
        description="This will disconnect the provider and stop all active email sequences using its inboxes. Affected leads will be reset to idle. This action cannot be undone."
        onConfirm={confirmDisconnect}
        isProcessing={disconnecting}
      />
    </div>
  );
}
