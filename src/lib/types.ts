// OfferReady Type Definitions

export type ConnectionType = 'cold' | 'alumni' | 'friend' | 'referral';

export type ContactStage = 
  | 'researching' 
  | 'messaged' 
  | 'scheduled' 
  | 'call_done' 
  | 'strong_connection' 
  | 'referral_requested' 
  | 'interview' 
  | 'offer';

export type InteractionType = 'email' | 'call' | 'coffee_chat';

export type CallEventStatus = 'scheduled' | 'completed' | 'canceled';

export interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  school: string | null;
  graduation_year: number | null;
  recruiting_goal: string | null;
  weekly_interactions_goal: number | null;
  weekly_flashcards_goal: number | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  firm: string | null;
  group_name: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  connection_type: ConnectionType;
  relationship_strength: number;
  stage: ContactStage;
  last_contacted_at: string | null;
  next_followup_at: string | null;
  notes_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  contact_id: string;
  user_id: string;
  type: InteractionType;
  date: string;
  notes: string | null;
  created_at: string;
}

export type TaskType = 'manual' | 'thank_you';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
  contact_id: string | null;
  task_type: TaskType;
  call_event_id: string | null;
  created_at: string;
  updated_at: string;
  contact?: { id: string; name: string; firm: string | null };
}

export interface CallEvent {
  id: string;
  user_id: string;
  contact_id: string;
  title: string;
  start_at: string;
  end_at: string;
  location: string | null;
  notes: string | null;
  status: CallEventStatus;
  external_provider: string | null;
  external_event_id: string | null;
  created_at: string;
  updated_at: string;
  contact?: Contact;
}

// Stage configuration for UI
export const STAGE_CONFIG: Record<ContactStage, { label: string; className: string }> = {
  researching: { label: 'Researching', className: 'stage-researching' },
  messaged: { label: 'Messaged', className: 'stage-messaged' },
  scheduled: { label: 'Scheduled', className: 'stage-scheduled' },
  call_done: { label: 'Call Done', className: 'stage-call-done' },
  strong_connection: { label: 'Strong Connection', className: 'stage-strong-connection' },
  referral_requested: { label: 'Referral Requested', className: 'stage-referral-requested' },
  interview: { label: 'Interview', className: 'stage-interview' },
  offer: { label: 'Offer', className: 'stage-offer' },
};

export const PIPELINE_STAGES: ContactStage[] = [
  'researching',
  'messaged',
  'scheduled',
  'call_done',
  'strong_connection',
  'referral_requested',
  'interview',
  'offer',
];

export const CONNECTION_TYPES: { value: ConnectionType; label: string }[] = [
  { value: 'cold', label: 'Cold Outreach' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'friend', label: 'Friend' },
  { value: 'referral', label: 'Referral' },
];

export const INTERACTION_TYPES: { value: InteractionType; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'call', label: 'Phone Call' },
  { value: 'coffee_chat', label: 'Coffee Chat' },
];

export const CALL_EVENT_STATUSES: { value: CallEventStatus; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'canceled', label: 'Canceled' },
];
