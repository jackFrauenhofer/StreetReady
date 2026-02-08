import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { LandingPage } from "@/pages/LandingPage";
import { AuthPage } from "@/pages/AuthPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PipelinePage } from "@/pages/PipelinePage";
import { ContactDetailPage } from "@/pages/ContactDetailPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { LearningPage } from "@/pages/LearningPage";
import { ModellingModulePage } from "@/pages/ModellingModulePage";
import { FlashcardDeckPage } from "@/pages/FlashcardDeckPage";
import { FlashcardStudyPage } from "@/pages/FlashcardStudyPage";
import { MockInterviewPage } from "@/pages/MockInterviewPage";
import { MockInterviewSessionPage } from "@/pages/MockInterviewSessionPage";
import { MockInterviewSummaryPage } from "@/pages/MockInterviewSummaryPage";
import { TasksPage } from '@/pages/TasksPage';
import { ResumeReviewerPage } from '@/pages/ResumeReviewerPage';
import { PrivacyPage } from "@/pages/PrivacyPage";
import { TermsPage } from "@/pages/TermsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <PublicRoute>
                <LandingPage />
              </PublicRoute>
            }
          />
          <Route
            path="/auth"
            element={
              <PublicRoute>
                <AuthPage />
              </PublicRoute>
            }
          />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/pipeline" element={<PipelinePage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/contact/:id" element={<ContactDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/learning" element={<LearningPage />} />
            <Route path="/learning/flashcards/:deckId" element={<FlashcardDeckPage />} />
            <Route path="/learning/flashcards/:deckId/study" element={<FlashcardStudyPage />} />
            <Route path="/learning/modelling/:moduleId" element={<ModellingModulePage />} />
            <Route path="/resume-review" element={<ResumeReviewerPage />} />
            <Route path="/mock-interview" element={<MockInterviewPage />} />
            <Route path="/mock-interview/session/:sessionId" element={<MockInterviewSessionPage />} />
            <Route path="/mock-interview/session/:sessionId/summary" element={<MockInterviewSummaryPage />} />
          </Route>
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
