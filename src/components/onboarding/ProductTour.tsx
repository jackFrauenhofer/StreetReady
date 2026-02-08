import { useMemo, useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import Joyride, { CallBackProps, STATUS, ACTIONS, EVENTS, Step } from 'react-joyride';
import { useTour, type TourPhase } from '@/hooks/useTour';

// Inline tour card rendered inside a dialog (no joyride overlay)
function DialogTourCard({ config, phaseDisplay, onNext, onSkip }: {
  config: { target: string; title: string; content: string; buttonLabel: string; onButtonClick?: () => void };
  phaseDisplay: { current: number; total: number };
  onNext: () => void;
  onSkip: () => void;
}) {
  const [container, setContainer] = useState<Element | null>(null);

  useEffect(() => {
    // Wait for the dialog to be in the DOM, then find it
    const timer = setTimeout(() => {
      const el = document.querySelector(config.target);
      setContainer(el);
    }, 300);
    return () => clearTimeout(timer);
  }, [config.target]);

  if (!container) return null;

  return createPortal(
    <div className="border-t border-border mt-4 pt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground">
            Step {phaseDisplay.current} of {phaseDisplay.total}
          </span>
        </div>
      </div>
      <h4 className="text-sm font-semibold mb-1">{config.title}</h4>
      <p className="text-sm text-muted-foreground mb-3">{config.content}</p>
      <div className="flex items-center justify-between">
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip Tour
        </button>
        <button
          onClick={() => {
            if (config.onButtonClick) {
              config.onButtonClick();
              return;
            }
            // Close the dialog by clicking its Radix close button
            const dialog = document.querySelector('[role="dialog"]');
            if (dialog) {
              const closeBtn = Array.from(dialog.querySelectorAll('button')).find(
                (btn) => btn.querySelector('.sr-only')?.textContent === 'Close'
              ) as HTMLElement;
              if (closeBtn) closeBtn.click();
            }
            setTimeout(onNext, 150);
          }}
          className="px-4 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
        >
          {config.buttonLabel}
        </button>
      </div>
    </div>,
    container
  );
}

// Custom tooltip component
function TourTooltip({
  continuous,
  index,
  step,
  backProps,
  primaryProps,
  skipProps,
  tooltipProps,
  isLastStep,
  phaseDisplay,
  onSkipTour,
  onAdvance,
  onConnectGcal,
  suppressAdvanceRef,
}: any) {
  return (
    <div
      {...tooltipProps}
      className="bg-background border border-border rounded-xl shadow-2xl p-5 max-w-sm"
    >
      {/* Phase indicator */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground">
            Step {phaseDisplay.current} of {phaseDisplay.total}
          </span>
        </div>
      </div>

      {/* Title */}
      {step.title && (
        <h3 className="text-base font-semibold text-foreground mb-2">
          {step.title}
        </h3>
      )}

      {/* Content */}
      <div className="text-sm text-muted-foreground leading-relaxed mb-4">
        {step.content}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-1.5 mb-4">
        <div
          className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(phaseDisplay.current / phaseDisplay.total) * 100}%` }}
        />
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={onSkipTour}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip tour
        </button>
        <div className="flex gap-2">
          {step.showSkipAction && (
            <button
              {...(step.onSkipAction ? { onClick: step.onSkipAction } : primaryProps)}
              className="px-3 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:bg-accent transition-colors"
            >
              {step.skipActionLabel || 'Skip'}
            </button>
          )}
          {!step.hideFooterActions && (
            <button
              {...primaryProps}
              onClick={(e) => {
                // Connect Google Calendar flow — redirect to OAuth
                if (onConnectGcal && step.primaryLabel === 'Connect Google Calendar') {
                  onConnectGcal();
                  return;
                }
                // Upload Resume — click the upload area directly to open file picker
                if (step.primaryLabel === 'Upload Resume') {
                  suppressAdvanceRef.current = true;
                  const uploadArea = document.querySelector(step.target as string);
                  if (uploadArea instanceof HTMLElement) uploadArea.click();
                  return;
                }
                // If step wants to click a target element, do that
                if (step.clickTarget) {
                  const targetEl = document.querySelector(step.target as string);
                  const btn = targetEl?.querySelector('button') || targetEl;
                  if (btn instanceof HTMLElement) btn.click();
                  // Advance unless waiting for async detection (e.g. email dialog)
                  if (!step.waitForDetection && onAdvance) onAdvance();
                  return;
                }
                // Directly advance the tour phase (for steps targeting dialogs/modals)
                // Close any open dialog first, then advance after it unmounts
                if (step.directAdvance && onAdvance) {
                  // Close all open Radix dialogs by clicking their overlay
                  const overlays = document.querySelectorAll('[data-radix-dialog-overlay]');
                  overlays.forEach((el) => (el as HTMLElement).click());
                  // Also try clicking close buttons inside dialogs
                  const dialogs = document.querySelectorAll('[role="dialog"]');
                  dialogs.forEach((dialog) => {
                    const closeBtn = dialog.querySelector('[data-radix-dialog-close]') as HTMLElement
                      || Array.from(dialog.querySelectorAll('button')).find(
                        (btn) => btn.querySelector('.sr-only')?.textContent === 'Close'
                      ) as HTMLElement;
                    if (closeBtn) closeBtn.click();
                  });
                  setTimeout(() => onAdvance(), 200);
                  return;
                }
                primaryProps.onClick(e);
              }}
              className="px-4 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              {step.primaryLabel || (isLastStep ? 'Finish' : 'Next')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type TourStep = Step & {
  primaryLabel?: string;
  showSkipAction?: boolean;
  skipActionLabel?: string;
  onSkipAction?: () => void;
  clickTarget?: boolean;
  waitForDetection?: boolean;
  hideFooterActions?: boolean;
  directAdvance?: boolean;
};

// Build steps for each phase
function getStepsForPhase(phase: TourPhase): TourStep[] {
  switch (phase) {
    case 'welcome':
      return [{
        target: '[data-tour="dashboard-hero"]',
        title: 'Welcome to OfferReady! 🎉',
        content: "Let's take a quick tour of the platform. We'll walk you through the key features — creating contacts, generating emails, scheduling calls, reviewing your resume, and practicing interviews.",
        placement: 'center' as const,
        disableBeacon: true,
        primaryLabel: "Let's go!",
      }];

    case 'connect-gcal':
      return [{
        target: '[data-tour="dashboard-hero"]',
        title: 'Connect Google Calendar 📅',
        content: "Before we dive in, connect your Google Calendar to unlock the full power of OfferReady. It lets us check your availability and suggest time windows in outreach emails — and send calendar invites directly to contacts. This makes the tour much more impactful!",
        placement: 'bottom' as const,
        disableBeacon: true,
        primaryLabel: 'Connect Google Calendar',
        showSkipAction: true,
        skipActionLabel: 'Skip for now',
      }];

    case 'create-contact':
      return [{
        target: '[data-tour="add-contact-btn"]',
        title: 'Add Your First Contact',
        content: "Your pipeline is where you manage all your networking contacts. Click 'Add Contact' below to create your first one.",
        placement: 'bottom' as const,
        disableBeacon: true,
        primaryLabel: 'Add Contact',
        spotlightClicks: true,
        clickTarget: true,
      }];

    case 'filling-contact':
      // No joyride steps — overlay is hidden so user can fill out the modal
      return [];

    case 'contact-created':
      return [{
        target: '[data-tour="researching-column"]',
        title: 'Contact Created! 🎯',
        content: "Your new contact is in the 'Researching' column. Click on their name to see their detail page, or hit 'View Contact' below — that's where the magic happens.",
        placement: 'right' as const,
        disableBeacon: true,
        spotlightClicks: true,
        primaryLabel: 'View Contact',
      }];

    case 'contact-email':
      return [{
        target: '[data-tour="generate-email-btn"]',
        title: 'AI-Powered Email Generation ✉️',
        content: "OfferReady drafts personalized outreach emails using your resume and Google Calendar availability — so you can suggest time windows without checking your calendar. Click 'Generate Email' to try it!",
        placement: 'bottom' as const,
        disableBeacon: true,
        spotlightClicks: true,
        primaryLabel: 'Generate Email',
        clickTarget: true,
        waitForDetection: true,
      }];

    case 'email-generated':
      // Rendered as inline card inside the dialog — no joyride overlay
      return [];

    case 'contact-questions':
      return [{
        target: '[data-tour="prep-questions-section"]',
        title: 'AI-Generated Call Prep Questions 🧠',
        content: "Before every call, OfferReady can generate tailored questions based on the contact's firm, role, and background. You can also add your own questions to build a personal question store — everything you need to prepare, in one place.",
        placement: 'top' as const,
        disableBeacon: true,
        primaryLabel: 'Next',
      }];

    case 'contact-notes':
      return [{
        target: '[data-tour="call-notes-section"]',
        title: 'Call Notes — Your One-Stop Shop 📝',
        content: "Take notes during or after every call, right here on the contact page. Combined with AI emails, prep questions, and calendar integration, this is your single hub for managing every relationship — drastically reducing the time spent juggling tools.",
        placement: 'top' as const,
        disableBeacon: true,
        primaryLabel: 'Next',
      }];

    case 'schedule-call':
      return [{
        target: '[data-tour="messaged-scheduled-columns"]',
        title: 'Schedule Calls & Send Invites 📅',
        content: "Your contact is now in the 'Messaged' column. Once they respond, drag them over to 'Scheduled' to set up a call. Try it now — drag your contact from Messaged to Scheduled!",
        placement: 'right' as const,
        disableBeacon: true,
        spotlightClicks: true,
        hideFooterActions: true,
      }];

    case 'scheduling-call':
      // No joyride steps — overlay is hidden so user can fill out the schedule call modal
      return [];

    case 'schedule-modal':
      // Rendered as inline card inside the dialog — no joyride overlay
      return [];

    case 'tasks-prepare':
      return [{
        target: '[data-tour="prepare-for-calls"]',
        title: 'Prepare for Upcoming Calls 📞',
        content: "Remember that call you just scheduled? It now appears here with a prep checklist, AI-generated questions, and a place to add your own. Try clicking 'AI Generate' to create tailored questions for your call!",
        placement: 'right' as const,
        disableBeacon: true,
        spotlightClicks: true,
        primaryLabel: 'Next',
      }];

    case 'tasks-thankyou':
      return [{
        target: '[data-tour="thank-you-notes"]',
        title: 'Thank You Notes — Don\'t Drop the Ball 💌',
        content: "After every call, OfferReady automatically creates a reminder to send a thank you note. These are critical — a timely, thoughtful follow-up can be the difference between a warm connection and a missed opportunity. We track them so you never forget.",
        placement: 'right' as const,
        disableBeacon: true,
        primaryLabel: 'Next',
      }];

    case 'tasks-custom':
      return [{
        target: '[data-tour="my-tasks"]',
        title: 'Your Personal To-Do List ✅',
        content: "Beyond auto-generated tasks, you can create your own — follow-up reminders, application deadlines, research notes, anything. Hit 'Add Task' to stay organized and on top of your recruiting process.",
        placement: 'right' as const,
        disableBeacon: true,
        primaryLabel: 'Next',
      }];

    case 'learning':
      return [{
        target: '[data-tour="learning-flashcards"]',
        title: '1,000+ Flashcards 🃏',
        content: "We've loaded over 1,000 technical and behavioral flashcards — completely over the top, but that's the point. Enough practice here to make the actual interview feel like a walk in the park. Drill DCFs, LBO mechanics, valuation comps, behavioral frameworks, and more.",
        placement: 'bottom' as const,
        disableBeacon: true,
        primaryLabel: 'Next',
      }];

    case 'resume-review':
      return [{
        target: '[data-tour="resume-upload"]',
        title: 'AI Resume Review 📄',
        content: "Upload your resume to get AI-powered feedback with section-by-section scoring. Drag and drop a PDF or click to browse. You can skip this for now if you'd like.",
        placement: 'bottom' as const,
        disableBeacon: true,
        spotlightClicks: true,
        showSkipAction: true,
        skipActionLabel: 'Skip',
        primaryLabel: 'Upload Resume',
      }];

    case 'resume-uploaded':
      return [{
        target: '[data-tour="review-resume-btn"]',
        title: 'Resume Uploaded! 🎉',
        content: "Great! Now click 'Review Resume' to get your personalized AI feedback, or continue to the next feature.",
        placement: 'bottom' as const,
        disableBeacon: true,
        spotlightClicks: true,
        showSkipAction: true,
        skipActionLabel: 'Skip',
        primaryLabel: 'Review it!',
        clickTarget: true,
        waitForDetection: true,
      }];

    case 'resume-reviewed':
      return [{
        target: '[data-tour="resume-feedback"]',
        title: 'AI-Powered Resume Feedback 📊',
        content: "Here's your personalized resume review with section-by-section scoring, strengths, and improvement suggestions. Your resume is now incorporated into the platform — it powers personalized feedback in the Mock Interview section, making your practice sessions tailored to your actual experience.",
        placement: 'top' as const,
        disableBeacon: true,
        primaryLabel: 'Next',
      }];

    case 'mock-interview':
      return [{
        target: '[data-tour="mock-interview-setup"]',
        title: 'Mock Interviews with AI Scoring 🎤',
        content: "Practice behavioral and technical interview questions with timed responses. Get AI-scored feedback on structure, clarity, and confidence. Start a session whenever you're ready!",
        placement: 'right' as const,
        disableBeacon: true,
        primaryLabel: 'Finish Tour',
      }];

    case 'complete':
      return [{
        target: '[data-tour="dashboard-hero"]',
        title: "You're All Set! 🚀",
        content: "You now know the key features of OfferReady. Explore at your own pace — you can replay this tour anytime from Settings.",
        placement: 'center' as const,
        disableBeacon: true,
        primaryLabel: 'Get Started',
      }];

    default:
      return [];
  }
}

interface ProductTourProps {
  tourActive: boolean;
  phase: TourPhase;
  onNext: () => void;
  onSkip: () => void;
  onEnd: () => void;
  onSkipToPhase: (phase: TourPhase) => void;
  phaseDisplay: { current: number; total: number };
  onConnectGcal?: () => void;
}

export function ProductTour({
  tourActive,
  phase,
  onNext,
  onSkip,
  onEnd,
  onSkipToPhase,
  phaseDisplay,
  onConnectGcal,
}: ProductTourProps) {
  const [run, setRun] = useState(false);
  const suppressAdvanceRef = useRef(false);
  const steps = useMemo(() => getStepsForPhase(phase), [phase]);

  // When phase changes, restart joyride
  useEffect(() => {
    if (tourActive && steps.length > 0) {
      setRun(false);
      // Small delay to let the DOM update after navigation
      const timer = setTimeout(() => setRun(true), 600);
      return () => clearTimeout(timer);
    } else {
      setRun(false);
    }
  }, [tourActive, phase, steps.length]);

  const handleCallback = (data: CallBackProps) => {
    const { status, action, type } = data;

    if (status === STATUS.FINISHED) {
      if (suppressAdvanceRef.current) {
        suppressAdvanceRef.current = false;
        return;
      }
      if (phase === 'complete') {
        onEnd();
      } else {
        onNext();
      }
    }

    if (status === STATUS.SKIPPED || action === ACTIONS.CLOSE) {
      onSkip();
    }
  };

  // For dialog-based phases, render an inline card inside the dialog instead of joyride
  const isDialogPhase = phase === 'email-generated' || phase === 'schedule-modal';
  const dialogTourConfig = isDialogPhase ? {
    'email-generated': {
      target: '[data-tour="email-dialog"]',
      title: 'Done \u2014 Just Like That! \ud83d\ude80',
      content: "Candidates spend hours every day checking their calendar for open slots, writing polished outreach emails, and going back and forth on scheduling. You just did all of that with a single click. Copy it, tweak it, or send it straight from here.",
      buttonLabel: 'Continue Tour',
    },
    'schedule-modal': {
      target: '[data-tour="schedule-call-modal"]',
      title: 'Google Calendar Integration \ud83d\udcc6',
      content: "Fill in the call details and hit 'Schedule'. If you've connected Google Calendar, OfferReady will automatically create a calendar event and send an invite to your contact \u2014 no switching between apps.",
      buttonLabel: 'Schedule Call',
      onButtonClick: () => {
        // Click the form's submit button to actually schedule the call
        const dialog = document.querySelector('[data-tour="schedule-call-modal"]');
        if (dialog) {
          const submitBtn = dialog.querySelector('button[type="submit"]') as HTMLElement;
          if (submitBtn) submitBtn.click();
        }
      },
    },
  }[phase] : null;

  if (!tourActive) return null;

  if (isDialogPhase && dialogTourConfig) {
    return (
      <DialogTourCard
        config={dialogTourConfig}
        phaseDisplay={phaseDisplay}
        onNext={onNext}
        onSkip={onSkip}
      />
    );
  }

  if (steps.length === 0) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton={false}
      showProgress={false}
      disableOverlayClose
      disableCloseOnEsc={false}
      disableScrolling
      spotlightPadding={8}
      callback={handleCallback}
      tooltipComponent={(props: any) => (
        <TourTooltip
          {...props}
          phaseDisplay={phaseDisplay}
          onSkipTour={onSkip}
          onAdvance={onNext}
          onConnectGcal={onConnectGcal}
          suppressAdvanceRef={suppressAdvanceRef}
        />
      )}
      styles={{
        options: {
          zIndex: 10000,
          arrowColor: 'hsl(var(--background))',
        },
        overlay: {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        },
        spotlight: {
          borderRadius: '12px',
        },
      }}
      floaterProps={{
        disableAnimation: true,
      }}
    />
  );
}
