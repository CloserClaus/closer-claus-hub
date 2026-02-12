import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BookOpen,
  FileText,
  Video,
  Link as LinkIcon,
  Plus,
  Upload,
  Trash2,
  Download,
  ExternalLink,
  Search,
  GraduationCap,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface TrainingMaterial {
  id: string;
  title: string;
  description: string | null;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
  content_type: string;
  video_url: string | null;
  created_at: string;
}

export default function Training() {
  const { currentWorkspace, isOwner, loading: workspaceLoading } = useWorkspace();
  const { user } = useAuth();
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  // Form state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contentType, setContentType] = useState("document");
  const [videoUrl, setVideoUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<TrainingMaterial | null>(null);

  useEffect(() => {
    fetchMaterials();
  }, [currentWorkspace?.id]);

  const fetchMaterials = async () => {
    if (!currentWorkspace?.id) return;

    setIsLoading(true);
    const { data, error } = await supabase
      .from('training_materials')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching training materials:', error);
      toast.error("Failed to load training materials");
    } else {
      setMaterials(data || []);
    }
    setIsLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error("File size must be less than 50MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (!currentWorkspace?.id || !user?.id) return;

    setIsSubmitting(true);

    try {
      let fileUrl = null;
      let fileType = null;
      let fileSize = null;

      // Upload file if selected
      if (selectedFile && contentType === 'document') {
        const fileName = `${currentWorkspace.id}/${Date.now()}_${selectedFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('training-files')
          .upload(fileName, selectedFile);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error("Failed to upload file");
          setIsSubmitting(false);
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('training-files')
          .getPublicUrl(fileName);

        fileUrl = publicUrl;
        fileType = selectedFile.type;
        fileSize = selectedFile.size;
      }

      // Insert training material
      const { error: insertError } = await supabase
        .from('training_materials')
        .insert({
          workspace_id: currentWorkspace.id,
          title: title.trim(),
          description: description.trim() || null,
          content_type: contentType,
          file_url: fileUrl,
          file_type: fileType,
          file_size: fileSize,
          video_url: contentType === 'video' ? videoUrl.trim() : null,
          created_by: user.id,
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        toast.error("Failed to create training material");
        return;
      }

      toast.success("Training material added successfully");
      setIsDialogOpen(false);
      resetForm();
      fetchMaterials();
    } catch (error) {
      console.error('Error:', error);
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!materialToDelete) return;

    try {
      // Delete file from storage if exists
      if (materialToDelete.file_url) {
        const pathMatch = materialToDelete.file_url.match(/training-files\/(.+)$/);
        if (pathMatch) {
          await supabase.storage.from('training-files').remove([pathMatch[1]]);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('training_materials')
        .delete()
        .eq('id', materialToDelete.id);

      if (error) {
        toast.error("Failed to delete training material");
        return;
      }

      toast.success("Training material deleted");
      setMaterials(prev => prev.filter(m => m.id !== materialToDelete.id));
    } catch (error) {
      console.error('Delete error:', error);
      toast.error("An error occurred");
    } finally {
      setDeleteDialogOpen(false);
      setMaterialToDelete(null);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setContentType("document");
    setVideoUrl("");
    setSelectedFile(null);
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="h-5 w-5" />;
      case 'link':
        return <LinkIcon className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getContentBadge = (type: string) => {
    switch (type) {
      case 'video':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Video</Badge>;
      case 'link':
        return <Badge variant="outline" className="bg-secondary/50 text-secondary-foreground">Link</Badge>;
      default:
        return <Badge variant="outline" className="bg-muted text-muted-foreground">Document</Badge>;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      material.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || material.content_type === filterType;
    return matchesSearch && matchesType;
  });

  if (workspaceLoading) {
    return (
      <DashboardLayout>
        <DashboardHeader title="Training" />
        <main className="flex-1 p-3 md:p-6">
          <div className="flex items-center justify-center h-96">
            <div className="animate-pulse text-muted-foreground">Loading workspace...</div>
          </div>
        </main>
      </DashboardLayout>
    );
  }

  if (!currentWorkspace) {
    return (
      <DashboardLayout>
        <DashboardHeader title="Training" />
        <main className="flex-1 p-3 md:p-6">
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Workspace Selected</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              {isOwner 
                ? "Please select a workspace from the sidebar to manage training materials."
                : "Join a company first to access their training materials. Browse jobs to find opportunities."}
            </p>
            {!isOwner && (
              <Button onClick={() => window.location.href = '/jobs'}>
                <Briefcase className="h-4 w-4 mr-2" />
                Browse Jobs
              </Button>
            )}
          </div>
        </main>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardHeader title="Training" />
      <main className="flex-1 p-3 md:p-6">
        <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <GraduationCap className="h-8 w-8" />
            Training
          </h1>
          <p className="text-muted-foreground">
            {isOwner ? "Manage training materials for your SDRs" : "Access your training materials"}
          </p>
        </div>

        {isOwner && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Material
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add Training Material</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    placeholder="e.g., Sales Script Guide"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Brief description of this material..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Content Type</label>
                  <Select value={contentType} onValueChange={setContentType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="document">Document / File</SelectItem>
                      <SelectItem value="video">Video Link</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {contentType === 'document' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Upload File</label>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                      <input
                        type="file"
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-upload"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        {selectedFile ? (
                          <p className="text-sm">
                            <span className="font-medium">{selectedFile.name}</span>
                            <br />
                            <span className="text-muted-foreground">
                              {formatFileSize(selectedFile.size)}
                            </span>
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Click to upload a file (max 50MB)
                          </p>
                        )}
                      </label>
                    </div>
                  </div>
                )}

                {contentType === 'video' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Video URL</label>
                    <Input
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      YouTube, Vimeo, or Loom links supported
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? "Uploading..." : "Add Material"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search training materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Materials Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredMaterials.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No training materials</h3>
            <p className="text-muted-foreground mb-4">
              {isOwner
                ? "Upload documents, videos, or links for your team to learn from."
                : "No training materials have been added yet."}
            </p>
            {isOwner && (
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Material
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMaterials.map((material) => (
            <Card key={material.id} className="group hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      {getContentIcon(material.content_type)}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{material.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(material.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  {getContentBadge(material.content_type)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {material.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {material.description}
                  </p>
                )}

                {material.file_size && (
                  <p className="text-xs text-muted-foreground">
                    Size: {formatFileSize(material.file_size)}
                  </p>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  {material.content_type === 'video' && material.video_url ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={material.video_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Watch Video
                      </a>
                    </Button>
                  ) : material.file_url ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={material.file_url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </a>
                    </Button>
                  ) : (
                    <span />
                  )}

                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setMaterialToDelete(material);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Training Material</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{materialToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </div>
      </main>
    </DashboardLayout>
  );
}