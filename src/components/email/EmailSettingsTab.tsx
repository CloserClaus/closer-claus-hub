import { useState, useEffect } from 'react';
import { Loader2, Save, Shield, Clock, Zap, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';

interface CampaignSettings {
  id?: string;
  default_daily_send_limit: number;
  sending_window_start: string;
  sending_window_end: string;
  sending_timezone: string;
  random_delay_min_seconds: number;
  random_delay_max_seconds: number;
  max_concurrent_sends: number;
  bounce_threshold_percent: number;
  auto_pause_on_bounce_threshold: boolean;
}

const DEFAULT_SETTINGS: CampaignSettings = {
  default_daily_send_limit: 50,
  sending_window_start: '08:00',
  sending_window_end: '18:00',
  sending_timezone: 'America/New_York',
  random_delay_min_seconds: 45,
  random_delay_max_seconds: 120,
  max_concurrent_sends: 3,
  bounce_threshold_percent: 5,
  auto_pause_on_bounce_threshold: true,
};

export function EmailSettingsTab() {
  const { currentWorkspace, isOwner } = useWorkspace();
  const { toast } = useToast();
  const [settings, setSettings] = useState<CampaignSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentWorkspace) fetchSettings();
  }, [currentWorkspace]);

  const fetchSettings = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const { data } = await supabase
      .from('email_campaign_settings')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .maybeSingle();

    if (data) {
      setSettings(data as any);
    } else {
      setSettings(DEFAULT_SETTINGS);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!currentWorkspace) return;
    setSaving(true);
    try {
      const payload = {
        workspace_id: currentWorkspace.id,
        default_daily_send_limit: settings.default_daily_send_limit,
        sending_window_start: settings.sending_window_start,
        sending_window_end: settings.sending_window_end,
        sending_timezone: settings.sending_timezone,
        random_delay_min_seconds: settings.random_delay_min_seconds,
        random_delay_max_seconds: settings.random_delay_max_seconds,
        max_concurrent_sends: settings.max_concurrent_sends,
        bounce_threshold_percent: settings.bounce_threshold_percent,
        auto_pause_on_bounce_threshold: settings.auto_pause_on_bounce_threshold,
      };

      if (settings.id) {
        await supabase.from('email_campaign_settings').update(payload as any).eq('id', settings.id);
      } else {
        await supabase.from('email_campaign_settings').insert(payload as any);
      }

      toast({ title: 'Settings saved' });
      fetchSettings();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally { setSaving(false); }
  };

  const update = (field: keyof CampaignSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!isOwner) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground">Only workspace owners can configure email settings.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Delivery Safety Controls</h2>
        <p className="text-sm text-muted-foreground">Configure workspace-wide email sending limits and safety measures</p>
      </div>

      {/* Sending Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Zap className="h-4 w-4" />Sending Limits</CardTitle>
          <CardDescription>Control how many emails are sent per day and concurrently</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Default Daily Send Limit</Label>
              <Input type="number" min={1} max={1000} value={settings.default_daily_send_limit}
                onChange={(e) => update('default_daily_send_limit', parseInt(e.target.value) || 50)} />
              <p className="text-xs text-muted-foreground">Applied to new inboxes by default</p>
            </div>
            <div className="space-y-2">
              <Label>Max Concurrent Sends</Label>
              <Input type="number" min={1} max={10} value={settings.max_concurrent_sends}
                onChange={(e) => update('max_concurrent_sends', parseInt(e.target.value) || 3)} />
              <p className="text-xs text-muted-foreground">How many emails can send simultaneously</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sending Window */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" />Sending Window</CardTitle>
          <CardDescription>Emails will only be sent during this time window</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Window Start</Label>
              <Input type="time" value={settings.sending_window_start}
                onChange={(e) => update('sending_window_start', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Window End</Label>
              <Input type="time" value={settings.sending_window_end}
                onChange={(e) => update('sending_window_end', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={settings.sending_timezone} onValueChange={(v) => update('sending_timezone', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'UTC', 'Europe/London'].map(tz => (
                    <SelectItem key={tz} value={tz}>{tz.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Randomization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Zap className="h-4 w-4" />Send Timing Randomization</CardTitle>
          <CardDescription>Stagger sends with random delays to appear more human</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Min Delay (seconds)</Label>
              <Input type="number" min={0} value={settings.random_delay_min_seconds}
                onChange={(e) => update('random_delay_min_seconds', parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Max Delay (seconds)</Label>
              <Input type="number" min={0} value={settings.random_delay_max_seconds}
                onChange={(e) => update('random_delay_max_seconds', parseInt(e.target.value) || 0)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bounce Protection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4" />Bounce Protection</CardTitle>
          <CardDescription>Automatically pause campaigns when bounce rates exceed threshold</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-pause on high bounce rate</Label>
              <p className="text-xs text-muted-foreground">Pauses all campaigns if bounce rate exceeds threshold</p>
            </div>
            <Switch checked={settings.auto_pause_on_bounce_threshold}
              onCheckedChange={(v) => update('auto_pause_on_bounce_threshold', v)} />
          </div>
          {settings.auto_pause_on_bounce_threshold && (
            <div className="space-y-2">
              <Label>Bounce Threshold (%)</Label>
              <Input type="number" min={1} max={100} value={settings.bounce_threshold_percent}
                onChange={(e) => update('bounce_threshold_percent', parseFloat(e.target.value) || 5)} className="w-32" />
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Save Settings
      </Button>
    </div>
  );
}
