import { useState, useRef } from 'react';
import { FileText, Upload, Trash2, Check, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useResume } from '@/hooks/useResume';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export function ResumeUploader() {
  const { user } = useAuth();
  const { resume, isLoading, isProcessing, uploadResume, deleteResume, processResume } = useResume(user?.id);

  const handleAnalyze = async () => {
    if (!resume) return;
    try {
      await processResume.mutateAsync(resume.id);
      toast.success('Resume analyzed successfully!');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze resume');
    }
  };
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    try {
      await uploadResume.mutateAsync(file);
      toast.success('Resume uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload resume');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDelete = async () => {
    try {
      await deleteResume.mutateAsync();
      toast.success('Resume deleted');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete resume');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Your Resume
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Your Resume
        </CardTitle>
      </CardHeader>
      <CardContent>
        {resume ? (
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary/10">
              <Check className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{resume.file_name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(resume.file_size)} • Uploaded {format(new Date(resume.uploaded_at), 'MMM d, yyyy')}
              </p>
              {isProcessing && (
                <p className="text-xs text-primary flex items-center gap-1 mt-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Analyzing your resume...
                </p>
              )}
              {!isProcessing && resume.parsed_resume_json && (
                <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                  <Check className="h-3 w-3" />
                  Resume analyzed — mock interviews will use your experience
                </p>
              )}
              {!isProcessing && !resume.parsed_resume_json && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                  onClick={handleAnalyze}
                >
                  <RefreshCw className="h-3 w-3" />
                  Analyze resume for personalized interviews
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadResume.isPending}
              >
                {uploadResume.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Replace'
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                disabled={deleteResume.isPending}
                className="text-destructive hover:text-destructive"
              >
                {deleteResume.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />
          </div>
        ) : (
          <div
            className={cn(
              'relative flex flex-col items-center justify-center gap-3 p-8 rounded-lg border-2 border-dashed transition-colors cursor-pointer',
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-muted">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                {uploadResume.isPending ? 'Uploading...' : 'Drop your resume here'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                or click to browse (PDF, max 10MB)
              </p>
            </div>
            {uploadResume.isPending && (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          Your resume will be used to personalize interview answers and networking outreach.
        </p>
      </CardContent>
    </Card>
  );
}
