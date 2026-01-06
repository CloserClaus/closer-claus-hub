import { useState, useRef } from "react";
import { ArrowLeft, Loader2, Upload, X, Image, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface BugReportFormProps {
  onClose: () => void;
  onBack: () => void;
}

interface FilePreview {
  file: File;
  preview: string;
  type: "image" | "video";
}

export function BugReportForm({ onClose, onBack }: BugReportFormProps) {
  const { user, userRole, profile } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const maxSize = 10 * 1024 * 1024; // 10MB

    const validFiles = selectedFiles.filter((file) => {
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large. Max size is 10MB.`);
        return false;
      }
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        toast.error(`${file.name} is not a valid image or video.`);
        return false;
      }
      return true;
    });

    const newPreviews = validFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith("image/") ? "image" as const : "video" as const,
    }));

    setFiles((prev) => [...prev, ...newPreviews].slice(0, 3)); // Max 3 files
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const uploadFiles = async (): Promise<string[]> => {
    if (!user || files.length === 0) return [];

    const urls: string[] = [];
    const totalFiles = files.length;

    for (let i = 0; i < files.length; i++) {
      const { file } = files[i];
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}-${i}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("bug-attachments")
        .upload(fileName, file);

      if (error) {
        console.error("Upload error:", error);
        throw error;
      }

      const { data: urlData } = supabase.storage
        .from("bug-attachments")
        .getPublicUrl(data.path);

      urls.push(urlData.publicUrl);
      setUploadProgress(((i + 1) / totalFiles) * 100);
    }

    return urls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userRole) return;

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      // Upload files first
      const attachmentUrls = await uploadFiles();

      const { error } = await supabase.from("bug_reports").insert({
        user_id: user.id,
        user_role: userRole,
        title,
        description,
        attachment_urls: attachmentUrls,
      });

      if (error) throw error;

      // Notify admins
      supabase.functions.invoke("notify-admin-feedback", {
        body: {
          type: "bug",
          title,
          description,
          userName: profile?.full_name || "Unknown User",
          userEmail: profile?.email || user.email,
          userRole,
          attachmentUrls,
        },
      }).catch(console.error);

      toast.success("Bug report submitted! We'll look into it.");
      onClose();
    } catch (error) {
      console.error("Error submitting bug report:", error);
      toast.error("Failed to submit bug report");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Button type="button" variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold">Report a Bug</h3>
      </div>

      <div className="space-y-2">
        <Input
          placeholder="Brief title for the bug"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Textarea
          placeholder="Describe what happened and what you expected..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          required
        />
      </div>

      {/* File Upload Section */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">
          Attachments (optional)
        </label>
        
        {files.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {files.map((file, index) => (
              <div
                key={index}
                className="relative w-16 h-16 rounded-md overflow-hidden border bg-muted"
              >
                {file.type === "image" ? (
                  <img
                    src={file.preview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {files.length < 3 && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
              multiple
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Add Image or Video
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Max 3 files, 10MB each
            </p>
          </>
        )}
      </div>

      {isSubmitting && uploadProgress > 0 && uploadProgress < 100 && (
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {uploadProgress > 0 && uploadProgress < 100
              ? `Uploading... ${Math.round(uploadProgress)}%`
              : "Submitting..."}
          </>
        ) : (
          "Submit Bug Report"
        )}
      </Button>
    </form>
  );
}
