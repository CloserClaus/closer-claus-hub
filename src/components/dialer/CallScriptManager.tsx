import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FileText, Plus, Edit2, Trash2, Star, Info } from "lucide-react";
import { toast } from "sonner";

interface CallScript {
  id: string;
  title: string;
  content: string;
  is_default: boolean;
  created_at: string;
}

interface CallScriptManagerProps {
  workspaceId: string;
}

const PLACEHOLDER_HINTS = [
  { placeholder: "{{first_name}}", description: "Prospect's first name" },
  { placeholder: "{{last_name}}", description: "Prospect's last name" },
  { placeholder: "{{company}}", description: "Company name" },
  { placeholder: "{{title}}", description: "Prospect's job title" },
  { placeholder: "{{email}}", description: "Prospect's email" },
  { placeholder: "{{phone}}", description: "Prospect's phone number" },
];

export function CallScriptManager({ workspaceId }: CallScriptManagerProps) {
  const { user } = useAuth();
  const [scripts, setScripts] = useState<CallScript[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<CallScript | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchScripts = async () => {
    const { data, error } = await supabase
      .from('call_scripts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching scripts:', error);
      return;
    }

    setScripts(data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchScripts();
  }, [workspaceId]);

  const resetForm = () => {
    setFormTitle("");
    setFormContent("");
    setFormIsDefault(false);
    setEditingScript(null);
  };

  const openNewDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (script: CallScript) => {
    setEditingScript(script);
    setFormTitle(script.title);
    setFormContent(script.content);
    setFormIsDefault(script.is_default);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) {
      toast.error("Please fill in title and content");
      return;
    }

    setIsSaving(true);

    try {
      // If setting as default, first unset any existing default
      if (formIsDefault) {
        await supabase
          .from('call_scripts')
          .update({ is_default: false })
          .eq('workspace_id', workspaceId)
          .eq('is_default', true);
      }

      if (editingScript) {
        const { error } = await supabase
          .from('call_scripts')
          .update({
            title: formTitle.trim(),
            content: formContent.trim(),
            is_default: formIsDefault,
          })
          .eq('id', editingScript.id);

        if (error) throw error;
        toast.success("Script updated");
      } else {
        const { error } = await supabase
          .from('call_scripts')
          .insert({
            workspace_id: workspaceId,
            title: formTitle.trim(),
            content: formContent.trim(),
            is_default: formIsDefault,
            created_by: user?.id,
          });

        if (error) throw error;
        toast.success("Script created");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchScripts();
    } catch (error) {
      console.error('Error saving script:', error);
      toast.error("Failed to save script");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (scriptId: string) => {
    try {
      const { error } = await supabase
        .from('call_scripts')
        .delete()
        .eq('id', scriptId);

      if (error) throw error;
      toast.success("Script deleted");
      fetchScripts();
    } catch (error) {
      console.error('Error deleting script:', error);
      toast.error("Failed to delete script");
    }
  };

  const handleSetDefault = async (script: CallScript) => {
    try {
      // Unset current default
      await supabase
        .from('call_scripts')
        .update({ is_default: false })
        .eq('workspace_id', workspaceId)
        .eq('is_default', true);

      // Set new default
      const { error } = await supabase
        .from('call_scripts')
        .update({ is_default: true })
        .eq('id', script.id);

      if (error) throw error;
      toast.success(`"${script.title}" set as default script`);
      fetchScripts();
    } catch (error) {
      console.error('Error setting default:', error);
      toast.error("Failed to set default script");
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    setFormContent(prev => prev + placeholder);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Call Scripts
            </CardTitle>
            <CardDescription>
              Create scripts with dynamic placeholders for personalized calls
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog} className="gap-2">
                <Plus className="h-4 w-4" />
                New Script
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingScript ? "Edit Script" : "Create New Script"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Script Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Cold Call Introduction"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Available Placeholders</Label>
                  <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                    {PLACEHOLDER_HINTS.map((hint) => (
                      <button
                        key={hint.placeholder}
                        type="button"
                        onClick={() => insertPlaceholder(hint.placeholder)}
                        className="px-2 py-1 text-xs font-mono rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        title={hint.description}
                      >
                        {hint.placeholder}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Click to insert placeholder at cursor position
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Script Content</Label>
                  <Textarea
                    id="content"
                    placeholder={`Hi {{first_name}}, this is [Your Name] from [Your Company].\n\nI'm calling because I noticed {{company}} might benefit from...\n\nIs now a good time to chat about how we can help?`}
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="default"
                    checked={formIsDefault}
                    onCheckedChange={setFormIsDefault}
                  />
                  <Label htmlFor="default">Set as default script</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : editingScript ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading scripts...</div>
        ) : scripts.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No scripts yet</p>
            <p className="text-sm text-muted-foreground">Create a script to help guide your calls</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {scripts.map((script) => (
                <div
                  key={script.id}
                  className="p-4 rounded-lg border border-border hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{script.title}</h4>
                        {script.is_default && (
                          <Badge variant="secondary" className="gap-1">
                            <Star className="h-3 w-3" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {script.content.substring(0, 150)}...
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!script.is_default && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleSetDefault(script)}
                          title="Set as default"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(script)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Script</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{script.title}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(script.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
