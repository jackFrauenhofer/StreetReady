import { useState } from 'react';
import { FileText, Upload, Trash2, Check, Loader2, RefreshCw, Star, AlertTriangle, TrendingUp, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useResume, type ResumeReview } from '@/hooks/useResume';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useRef } from 'react';

export function ResumeReviewerPage() {
  const { user } = useAuth();
  const { resume, isLoading, isProcessing, isReviewing, uploadResume, deleteResume, reviewResume } = useResume(user?.id);
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

  const handleReview = async () => {
    if (!resume) return;
    try {
      await reviewResume.mutateAsync(resume.id);
      toast.success('Resume reviewed successfully!');
    } catch (error) {
      console.error('Review error:', error);
      toast.error('Failed to review resume');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const review = resume?.review_json as ResumeReview | null;

  const scoreColor = (score: number, max: number = 10) => {
    const pct = (score / max) * 100;
    if (pct >= 80) return 'text-green-600';
    if (pct >= 60) return 'text-yellow-600';
    return 'text-red-500';
  };

  const scoreBarColor = (score: number) => {
    if (score >= 8) return 'bg-green-500';
    if (score >= 6) return 'bg-yellow-500';
    return 'bg-red-400';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Resume Reviewer</h1>
        <p className="text-muted-foreground mt-1">
          Upload your resume and get AI-powered feedback tailored for investment banking recruiting.
        </p>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Your Resume
          </CardTitle>
        </CardHeader>
        <CardContent>
          {resume ? (
            <div className="space-y-4">
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
                      Processing your resume...
                    </p>
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

              {/* Review Button */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleReview}
                  disabled={isReviewing || isProcessing}
                  className="gap-2"
                >
                  {isReviewing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Reviewing...
                    </>
                  ) : review ? (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Re-Review Resume
                    </>
                  ) : (
                    <>
                      <Star className="h-4 w-4" />
                      Review My Resume
                    </>
                  )}
                </Button>
                {!review && !isReviewing && (
                  <p className="text-xs text-muted-foreground">
                    Get AI-powered scoring, strengths, weaknesses, and improvement suggestions.
                  </p>
                )}
              </div>
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
        </CardContent>
      </Card>

      {/* Review Results */}
      {isReviewing && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium text-foreground">Analyzing your resume...</p>
              <p className="text-sm text-muted-foreground mt-1">
                This may take 15-30 seconds. We're reviewing formatting, experience, education, skills, and impact.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {review && !isReviewing && (
        <div className="space-y-6">
          {/* Overall Score */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-8">
                {/* Score Circle */}
                <div className="relative flex-shrink-0">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                    <circle
                      cx="60" cy="60" r="52"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="text-muted/30"
                    />
                    <circle
                      cx="60" cy="60" r="52"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${(review.overall_score / 100) * 327} 327`}
                      className={scoreColor(review.overall_score, 100)}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={cn('text-3xl font-bold', scoreColor(review.overall_score, 100))}>
                      {review.overall_score}
                    </span>
                    <span className="text-xs text-muted-foreground">/100</span>
                  </div>
                </div>

                {/* Summary */}
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-foreground mb-2">Overall Assessment</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {review.summary}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section Scores */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Section Scores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Formatting', key: 'formatting' as const },
                { label: 'Experience', key: 'experience' as const },
                { label: 'Education', key: 'education' as const },
                { label: 'Skills', key: 'skills' as const },
                { label: 'Impact & Quantification', key: 'impact_quantification' as const },
              ].map(({ label, key }) => {
                const score = review.section_scores[key];
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{label}</span>
                      <span className={cn('text-sm font-semibold', scoreColor(score))}>
                        {score}/10
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', scoreBarColor(score))}
                        style={{ width: `${score * 10}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Strengths & Weaknesses */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Strengths */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {review.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
                      <span className="text-sm text-foreground leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Weaknesses */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Weaknesses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {review.weaknesses.map((w, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                      <span className="text-sm text-foreground leading-relaxed">{w}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Improvement Suggestions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Where to Improve
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {review.improvements.map((imp, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 flex-shrink-0 mt-0.5">
                      <ChevronRight className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">
                        {imp.section}
                      </p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {imp.suggestion}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
