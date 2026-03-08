import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Copy, Loader2, FileText, ChevronDown } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/crm/DeleteConfirmDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  is_default: boolean;
  created_at: string;
}

const VARIABLES = [
  { key: '{{first_name}}', label: 'First Name' },
  { key: '{{last_name}}', label: 'Last Name' },
  { key: '{{company}}', label: 'Company' },
  { key: '{{title}}', label: 'Title' },
  { key: '{{email}}', label: 'Email' },
  { key: '{{phone}}', label: 'Phone' },
];

export function EmailTemplatesTab() {
  const { user } = useAuth();
  const { currentWorkspace, isOwner } = useWorkspace();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (currentWorkspace) fetchTemplates();
  }, [currentWorkspace]);

  const fetchTemplates = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const { data } = await supabase
      .from('email_templates')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false });
    setTemplates((data as EmailTemplate[]) || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setName('');
    setSubject('');
    setBody('');
    setShowEditor(true);
  };

  const openEdit = (t: EmailTemplate) => {
    setEditing(t);
    setName(t.name);
    setSubject(t.subject);
    setBody(t.body);
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!currentWorkspace || !user || !name.trim() || !subject.trim() || !body.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await supabase.from('email_templates').update({ name, subject, body } as any).eq('id', editing.id);
      } else {
        await supabase.from('email_templates').insert({
          workspace_id: currentWorkspace.id,
          created_by: user.id,
          name,
          subject,
          body,
        } as any);
      }
      toast({ title: editing ? 'Template updated' : 'Template created' });
      setShowEditor(false);
      fetchTemplates();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (t: EmailTemplate) => {
    if (!currentWorkspace || !user) return;
    try {
      await supabase.from('email_templates').insert({
        workspace_id: currentWorkspace.id,
        created_by: user.id,
        name: `${t.name} (Copy)`,
        subject: t.subject,
        body: t.body,
      } as any);
      toast({ title: 'Template duplicated' });
      fetchTemplates();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    await supabase.from('email_templates').delete().eq('id', id);
    toast({ title: 'Template deleted' });
    setDeleteConfirmId(null);
    fetchTemplates();
  };

  const previewBody = (text: string) => {
    return text
      .replace(/\{\{first_name\}\}/g, 'John')
      .replace(/\{\{last_name\}\}/g, 'Smith')
      .replace(/\{\{company\}\}/g, 'Acme Corp')
      .replace(/\{\{title\}\}/g, 'CEO')
      .replace(/\{\{email\}\}/g, 'john@acme.com')
      .replace(/\{\{phone\}\}/g, '(555) 123-4567');
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Email Templates</h2>
          <p className="text-sm text-muted-foreground">Create reusable templates with dynamic variables for faster outreach</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No templates created yet</p>
            <p className="text-xs text-muted-foreground mt-1">Templates are available in the email composer when sending to leads</p>
            <Button onClick={openCreate} className="mt-4" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium">{t.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Subject: {t.subject}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicate(t)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 whitespace-pre-wrap line-clamp-4">
                  {previewBody(t.body)}
                </div>
                {t.is_default && <Badge variant="secondary" className="mt-2 text-xs">Default</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Template Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Template' : 'Create Template'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cold Outreach V1" />
            </div>

            <div className="space-y-2">
              <Label>Subject Line</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Quick question, {{first_name}}" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Body</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-xs h-7">
                      Insert Variable
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {VARIABLES.map((v) => (
                      <DropdownMenuItem key={v.key} onClick={() => setBody(prev => prev + v.key)}>
                        {v.label} <span className="ml-auto text-xs text-muted-foreground">{v.key}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your email template..." className="min-h-[200px]" />
            </div>

            {/* Live Preview */}
            {body.trim() && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Preview (with sample data)</Label>
                <div className="text-sm bg-muted/50 rounded-md p-4 border whitespace-pre-wrap">
                  <p className="font-medium mb-2">{previewBody(subject)}</p>
                  <p className="text-muted-foreground">{previewBody(body)}</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim() || !subject.trim() || !body.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
