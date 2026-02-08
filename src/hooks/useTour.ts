import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useContacts } from '@/hooks/useContacts';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';

// Context so any component can call restartTour
interface TourContextValue {
  restartTour: () => Promise<void>;
}
export const TourContext = createContext<TourContextValue>({ restartTour: async () => {} });
export const useTourContext = () => useContext(TourContext);

function scrollToTop() {
  window.scrollTo(0, 0);
  // The <main> element is the actual scroll container (overflow-auto)
  document.querySelector('main')?.scrollTo(0, 0);
}

export type TourPhase =
  | 'idle'
  | 'welcome'           // Phase 1: Dashboard welcome
  | 'connect-gcal'      // Phase 1b: Prompt to connect Google Calendar
  | 'create-contact'    // Phase 2: Pipeline — add contact
  | 'filling-contact'   // Phase 2b: User is filling out the add contact form
  | 'contact-created'   // Phase 2c: Contact was created, prompt to click it
  | 'contact-email'     // Phase 3a: Contact detail — AI email generation
  | 'email-generated'   // Phase 3a2: Email dialog is showing
  | 'contact-questions' // Phase 3b: Contact detail — AI questions & question store
  | 'contact-notes'     // Phase 3c: Contact detail — call notes
  | 'schedule-call'     // Phase 4: Pipeline — highlight messaged+scheduled, prompt drag
  | 'scheduling-call'   // Phase 4b: User is filling out the schedule call modal
  | 'schedule-modal'    // Phase 4c: Highlight the schedule modal and explain gcal
  | 'tasks-prepare'     // Phase 5a: Tasks — prepare for calls section
  | 'tasks-thankyou'    // Phase 5b: Tasks — thank you notes
  | 'tasks-custom'      // Phase 5c: Tasks — custom tasks
  | 'learning'          // Phase 6: Learning — flashcards
  | 'resume-review'     // Phase 7: Resume review page
  | 'resume-uploaded'   // Phase 5b: Resume uploaded, prompt review
  | 'resume-reviewed'   // Phase 5c: Resume reviewed, highlight feedback
  | 'mock-interview'    // Phase 6: Mock interview page
  | 'complete';         // Phase 7: Done

const PHASE_ORDER: TourPhase[] = [
  'welcome',
  'connect-gcal',
  'create-contact',
  'filling-contact',
  'contact-created',
  'contact-email',
  'email-generated',
  'contact-questions',
  'contact-notes',
  'schedule-call',
  'scheduling-call',
  'schedule-modal',
  'tasks-prepare',
  'tasks-thankyou',
  'tasks-custom',
  'learning',
  'resume-review',
  'resume-uploaded',
  'resume-reviewed',
  'mock-interview',
  'complete',
];

// Which route each phase expects
const PHASE_ROUTES: Partial<Record<TourPhase, string>> = {
  'welcome': '/dashboard',
  'connect-gcal': '/dashboard',
  'create-contact': '/pipeline',
  'filling-contact': '/pipeline',
  'contact-created': '/pipeline',
  // contact-email, contact-questions, contact-notes use dynamic route — handled in nextPhase
  'schedule-call': '/pipeline',
  'scheduling-call': '/pipeline',
  'schedule-modal': '/pipeline',
  'tasks-prepare': '/tasks',
  'tasks-thankyou': '/tasks',
  'tasks-custom': '/tasks',
  'learning': '/learning',
  'resume-review': '/resume-review',
  'resume-uploaded': '/resume-review',
  'resume-reviewed': '/resume-review',
  'mock-interview': '/mock-interview',
  'complete': '/dashboard',
};

export function useTour() {
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile(user?.id);
  const { contacts, updateContact } = useContacts(user?.id);
  const { isConnected: gcalConnected, connectGoogleCalendar } = useGoogleCalendar();
  const navigate = useNavigate();
  const location = useLocation();

  const [phase, setPhase] = useState<TourPhase>('idle');
  const [tourActive, setTourActive] = useState(false);
  const [createdContactId, setCreatedContactId] = useState<string | null>(null);

  // Track contact count at tour start to detect new contact creation
  const contactCountRef = useRef<number>(0);
  // Prevent auto-restart after skip/end (guards against async race)
  const dismissedRef = useRef(false);

  // Resume tour after Google Calendar OAuth redirect
  useEffect(() => {
    const saved = localStorage.getItem('tour_resume_phase');
    if (saved && phase === 'idle' && !tourActive && profile) {
      localStorage.removeItem('tour_resume_phase');
      // Resume from create-contact (next phase after connect-gcal)
      contactCountRef.current = contacts.length;
      setCreatedContactId(null);
      setTourActive(true);
      setPhase('create-contact' as TourPhase);
      navigate('/pipeline');
      setTimeout(scrollToTop, 200);
    }
  }, [profile, phase, tourActive]);

  // Auto-start tour for new users after onboarding
  useEffect(() => {
    if (
      profile &&
      profile.onboarding_completed &&
      !profile.tour_completed &&
      !tourActive &&
      !dismissedRef.current &&
      phase === 'idle' &&
      location.pathname === '/dashboard'
    ) {
      // Small delay so the dashboard renders first
      const timer = setTimeout(() => {
        startTour();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [profile, tourActive, phase, location.pathname]);

  // Track contact count changes to detect creation
  useEffect(() => {
    if ((phase === 'create-contact' || phase === 'filling-contact') && contacts.length > contactCountRef.current) {
      // A new contact was created
      const newest = contacts[0]; // contacts are ordered by created_at desc
      if (newest) {
        setCreatedContactId(newest.id);
        setPhase('contact-created');
      }
    }
  }, [contacts, phase]);

  // Detect when AddContactModal opens during create-contact phase
  // so clicking the actual button also advances to filling-contact
  useEffect(() => {
    if (phase !== 'create-contact') return;
    const observer = new MutationObserver(() => {
      // Radix Dialog renders [role="dialog"] in a portal
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        setPhase('filling-contact');
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [phase]);

  // Detect when user clicks a contact card during contact-created phase
  // (navigates to /contact/:id) — advance to contact-email
  useEffect(() => {
    if (phase === 'contact-created' && location.pathname.startsWith('/contact/')) {
      setPhase('contact-email');
      setTimeout(scrollToTop, 100);
    }
  }, [phase, location.pathname]);

  // Detect when email dialog opens during contact-email phase → advance to email-generated
  useEffect(() => {
    if (phase !== 'contact-email') return;
    const observer = new MutationObserver(() => {
      const emailDialog = document.querySelector('[data-tour="email-dialog"]');
      if (emailDialog) {
        setPhase('email-generated');
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [phase]);

  // Detect when ScheduleCallModal opens during schedule-call phase → advance to scheduling-call
  useEffect(() => {
    if (phase !== 'schedule-call') return;
    const observer = new MutationObserver(() => {
      const modal = document.querySelector('[data-tour="schedule-call-modal"]');
      if (modal) {
        setPhase('schedule-modal');
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [phase]);

  // Detect when ScheduleCallModal closes during schedule-modal phase → advance tour
  useEffect(() => {
    if (phase !== 'schedule-modal') return;
    // Wait for the modal to be present first
    const modal = document.querySelector('[data-tour="schedule-call-modal"]');
    if (!modal) return;
    // Watch for the modal to be removed from the DOM
    const observer = new MutationObserver(() => {
      const stillThere = document.querySelector('[data-tour="schedule-call-modal"]');
      if (!stillThere) {
        const next = PHASE_ORDER[PHASE_ORDER.indexOf('schedule-modal') + 1];
        setPhase(next);
        const route = PHASE_ROUTES[next];
        if (route) navigate(route);
        setTimeout(scrollToTop, 100);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [phase]);

  // Auto-skip connect-gcal phase if already connected
  useEffect(() => {
    if (phase === 'connect-gcal' && gcalConnected) {
      setPhase('create-contact');
      navigate('/pipeline');
      setTimeout(scrollToTop, 100);
    }
  }, [phase, gcalConnected]);

  // Detect when resume is uploaded during resume-review phase → advance to resume-uploaded
  useEffect(() => {
    if (phase !== 'resume-review') return;
    const observer = new MutationObserver(() => {
      const reviewBtn = document.querySelector('[data-tour="review-resume-btn"]');
      if (reviewBtn) {
        setPhase('resume-uploaded');
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [phase]);

  // Detect when resume feedback appears during resume-uploaded phase → advance to resume-reviewed
  useEffect(() => {
    if (phase !== 'resume-uploaded') return;
    const observer = new MutationObserver(() => {
      const feedback = document.querySelector('[data-tour="resume-feedback"]');
      if (feedback) {
        setPhase('resume-reviewed');
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [phase]);

  // Auto-click the "Questions & Notes" tab when entering contact-questions or contact-notes
  useEffect(() => {
    if (phase === 'contact-questions' || phase === 'contact-notes') {
      const timer = setTimeout(() => {
        const prepTab = document.querySelector('[data-tour="prep-tab"]');
        if (prepTab instanceof HTMLElement) prepTab.click();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const startTour = useCallback(() => {
    contactCountRef.current = contacts.length;
    setCreatedContactId(null);
    setTourActive(true);
    setPhase('welcome');
    scrollToTop();
  }, [contacts.length]);

  const endTour = useCallback(async () => {
    dismissedRef.current = true;
    setTourActive(false);
    setPhase('idle');
    setCreatedContactId(null);
    try {
      await updateProfile.mutateAsync({ tour_completed: true });
    } catch {
      // Silently fail — tour state is cosmetic
    }
  }, [updateProfile]);

  const skipTour = useCallback(() => {
    endTour();
  }, [endTour]);

  const nextPhase = useCallback(() => {
    const currentIndex = PHASE_ORDER.indexOf(phase);
    if (currentIndex === -1 || currentIndex >= PHASE_ORDER.length - 1) {
      endTour();
      return;
    }
    const next = PHASE_ORDER[currentIndex + 1];
    setPhase(next);

    // Move created contact to 'messaged' when entering schedule-call
    if (next === 'schedule-call' && createdContactId) {
      const contact = contacts.find((c) => c.id === createdContactId);
      if (contact && contact.stage === 'researching') {
        updateContact.mutateAsync({ id: createdContactId, stage: 'messaged' }).catch(() => {});
      }
    }

    // Navigate to the correct route for the next phase
    if (next === 'contact-email' && createdContactId) {
      // Navigate to the created contact's detail page
      navigate(`/contact/${createdContactId}`);
    } else {
      const targetRoute = PHASE_ROUTES[next];
      if (targetRoute) {
        navigate(targetRoute);
      }
    }
    // Scroll to top after transition
    setTimeout(scrollToTop, 100);
  }, [phase, navigate, createdContactId, endTour]);

  // Skip to a specific phase (used for skipping resume upload etc.)
  const skipToPhase = useCallback((target: TourPhase) => {
    setPhase(target);
    const targetRoute = PHASE_ROUTES[target];
    if (targetRoute) {
      navigate(targetRoute);
    }
    setTimeout(scrollToTop, 100);
  }, [navigate]);

  // Manually restart tour (from Settings)
  const restartTour = useCallback(async () => {
    dismissedRef.current = false;
    try {
      await updateProfile.mutateAsync({ tour_completed: false });
    } catch {
      // ignore
    }
    navigate('/dashboard');
    // Small delay for navigation
    setTimeout(() => {
      startTour();
    }, 500);
  }, [updateProfile, navigate, startTour]);

  // Get the phase number for display (1-indexed, excluding sub-phases)
  const getPhaseDisplay = useCallback((): { current: number; total: number } => {
    const displayPhases: TourPhase[] = [
      'welcome', 'create-contact', 'contact-email',
      'schedule-call', 'tasks-prepare', 'learning', 'resume-review', 'mock-interview', 'complete',
    ];
    const mainPhase = phase === 'connect-gcal' ? 'welcome'
      : phase === 'contact-created' ? 'create-contact'
      : phase === 'filling-contact' ? 'create-contact'
      : phase === 'email-generated' ? 'contact-email'
      : phase === 'contact-questions' ? 'contact-email'
      : phase === 'contact-notes' ? 'contact-email'
      : phase === 'scheduling-call' ? 'schedule-call'
      : phase === 'schedule-modal' ? 'schedule-call'
      : phase === 'tasks-thankyou' ? 'tasks-prepare'
      : phase === 'tasks-custom' ? 'tasks-prepare'
      : phase === 'resume-uploaded' ? 'resume-review'
      : phase === 'resume-reviewed' ? 'resume-review'
      : phase;
    const idx = displayPhases.indexOf(mainPhase);
    return { current: Math.max(idx + 1, 1), total: displayPhases.length };
  }, [phase]);

  // Save tour state and trigger Google Calendar OAuth
  const connectGcalAndResume = useCallback(() => {
    localStorage.setItem('tour_resume_phase', 'create-contact');
    connectGoogleCalendar();
  }, [connectGoogleCalendar]);

  return {
    phase,
    tourActive,
    createdContactId,
    gcalConnected,
    connectGcalAndResume,
    startTour,
    endTour,
    skipTour,
    nextPhase,
    skipToPhase,
    restartTour,
    getPhaseDisplay,
  };
}
