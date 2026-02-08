export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      call_events: {
        Row: {
          contact_id: string
          created_at: string
          end_at: string
          external_event_id: string | null
          external_provider: string | null
          id: string
          location: string | null
          notes: string | null
          start_at: string
          status: Database["public"]["Enums"]["call_event_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          end_at: string
          external_event_id?: string | null
          external_provider?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["call_event_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          end_at?: string
          external_event_id?: string | null
          external_provider?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["call_event_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          connection_type: Database["public"]["Enums"]["connection_type"] | null
          created_at: string
          email: string | null
          firm: string | null
          group_name: string | null
          id: string
          last_contacted_at: string | null
          name: string
          next_followup_at: string | null
          notes_summary: string | null
          phone: string | null
          position: string | null
          prep_questions_json: unknown[] | null
          relationship_strength: number | null
          stage: Database["public"]["Enums"]["contact_stage"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_type?:
            | Database["public"]["Enums"]["connection_type"]
            | null
          created_at?: string
          email?: string | null
          firm?: string | null
          group_name?: string | null
          id?: string
          last_contacted_at?: string | null
          name: string
          next_followup_at?: string | null
          notes_summary?: string | null
          phone?: string | null
          position?: string | null
          prep_questions_json?: unknown[] | null
          relationship_strength?: number | null
          stage?: Database["public"]["Enums"]["contact_stage"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_type?:
            | Database["public"]["Enums"]["connection_type"]
            | null
          created_at?: string
          email?: string | null
          firm?: string | null
          group_name?: string | null
          id?: string
          last_contacted_at?: string | null
          name?: string
          next_followup_at?: string | null
          notes_summary?: string | null
          phone?: string | null
          position?: string | null
          prep_questions_json?: unknown[] | null
          relationship_strength?: number | null
          stage?: Database["public"]["Enums"]["contact_stage"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcard_decks: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          track: Database["public"]["Enums"]["flashcard_track"]
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          track: Database["public"]["Enums"]["flashcard_track"]
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          track?: Database["public"]["Enums"]["flashcard_track"]
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          answer: string
          category: string | null
          common_mistakes: string | null
          created_at: string
          deck_id: string | null
          difficulty: string
          id: string
          question: string
          source: string | null
          topic: string | null
          track: string | null
        }
        Insert: {
          answer: string
          category?: string | null
          common_mistakes?: string | null
          created_at?: string
          deck_id?: string | null
          difficulty?: string
          id?: string
          question: string
          source?: string | null
          topic?: string | null
          track?: string | null
        }
        Update: {
          answer?: string
          category?: string | null
          common_mistakes?: string | null
          created_at?: string
          deck_id?: string | null
          difficulty?: string
          id?: string
          question?: string
          source?: string | null
          topic?: string | null
          track?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "flashcard_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          contact_id: string
          created_at: string
          date: string
          id: string
          notes: string | null
          type: Database["public"]["Enums"]["interaction_type"]
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          type: Database["public"]["Enums"]["interaction_type"]
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          type?: Database["public"]["Enums"]["interaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_lessons: {
        Row: {
          content: string
          created_at: string
          estimated_minutes: number
          id: string
          order_index: number
          slug: string
          title: string
          topic_id: string
        }
        Insert: {
          content: string
          created_at?: string
          estimated_minutes?: number
          id?: string
          order_index?: number
          slug: string
          title: string
          topic_id: string
        }
        Update: {
          content?: string
          created_at?: string
          estimated_minutes?: number
          id?: string
          order_index?: number
          slug?: string
          title?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_lessons_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "learning_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_topics: {
        Row: {
          created_at: string
          description: string | null
          difficulty: Database["public"]["Enums"]["topic_difficulty"]
          id: string
          order_index: number
          slug: string
          title: string
          track_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          difficulty?: Database["public"]["Enums"]["topic_difficulty"]
          id?: string
          order_index?: number
          slug: string
          title: string
          track_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          difficulty?: Database["public"]["Enums"]["topic_difficulty"]
          id?: string
          order_index?: number
          slug?: string
          title?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_topics_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "learning_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_tracks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          slug: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          slug: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          slug?: string
          title?: string
        }
        Relationships: []
      }
      mock_interview_answers: {
        Row: {
          created_at: string
          feedback: string | null
          id: string
          question_id: string
          recording_url: string | null
          score_breakdown_json: Json | null
          score_overall: number | null
          session_id: string
          suggested_answer: string | null
          transcript: string | null
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          id?: string
          question_id: string
          recording_url?: string | null
          score_breakdown_json?: Json | null
          score_overall?: number | null
          session_id: string
          suggested_answer?: string | null
          transcript?: string | null
        }
        Update: {
          created_at?: string
          feedback?: string | null
          id?: string
          question_id?: string
          recording_url?: string | null
          score_breakdown_json?: Json | null
          score_overall?: number | null
          session_id?: string
          suggested_answer?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mock_interview_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "mock_interview_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_interview_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mock_interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_interview_questions: {
        Row: {
          created_at: string
          id: string
          order_index: number
          question_text: string
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_index?: number
          question_text: string
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          question_text?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_interview_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mock_interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_interview_sessions: {
        Row: {
          category: string
          created_at: string
          difficulty: Database["public"]["Enums"]["mock_interview_difficulty"]
          ended_at: string | null
          id: string
          session_length_minutes: number
          started_at: string
          track: Database["public"]["Enums"]["mock_interview_track"]
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["mock_interview_difficulty"]
          ended_at?: string | null
          id?: string
          session_length_minutes?: number
          started_at?: string
          track: Database["public"]["Enums"]["mock_interview_track"]
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["mock_interview_difficulty"]
          ended_at?: string | null
          id?: string
          session_length_minutes?: number
          started_at?: string
          track?: Database["public"]["Enums"]["mock_interview_track"]
          user_id?: string
        }
        Relationships: []
      }
      modelling_modules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          order_index: number
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      modelling_steps: {
        Row: {
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          module_id: string
          order_index: number
          title: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          module_id: string
          order_index?: number
          title: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          module_id?: string
          order_index?: number
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modelling_steps_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modelling_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          graduation_year: number | null
          id: string
          onboarding_completed: boolean | null
          recruiting_goal: string | null
          school: string | null
          tour_completed: boolean | null
          updated_at: string
          user_id: string
          weekly_flashcards_goal: number | null
          weekly_interactions_goal: number | null
          weekly_mock_interviews_goal: number | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          graduation_year?: number | null
          id?: string
          onboarding_completed?: boolean | null
          recruiting_goal?: string | null
          school?: string | null
          tour_completed?: boolean | null
          updated_at?: string
          user_id: string
          weekly_flashcards_goal?: number | null
          weekly_interactions_goal?: number | null
          weekly_mock_interviews_goal?: number | null
        }
        Update: {
          created_at?: string
          email?: string | null
          graduation_year?: number | null
          id?: string
          onboarding_completed?: boolean | null
          recruiting_goal?: string | null
          school?: string | null
          tour_completed?: boolean | null
          updated_at?: string
          user_id?: string
          weekly_flashcards_goal?: number | null
          weekly_interactions_goal?: number | null
          weekly_mock_interviews_goal?: number | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          call_event_id: string | null
          completed: boolean | null
          contact_id: string | null
          created_at: string
          due_date: string | null
          id: string
          task_type: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          call_event_id?: string | null
          completed?: boolean | null
          contact_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          task_type?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          call_event_id?: string | null
          completed?: boolean | null
          contact_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          task_type?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_call_event_id_fkey"
            columns: ["call_event_id"]
            isOneToOne: false
            referencedRelation: "call_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_flashcard_progress: {
        Row: {
          confidence: number | null
          created_at: string
          flashcard_id: string
          id: string
          last_reviewed_at: string | null
          next_review_at: string | null
          times_correct: number
          times_seen: number
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          flashcard_id: string
          id?: string
          last_reviewed_at?: string | null
          next_review_at?: string | null
          times_correct?: number
          times_seen?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          flashcard_id?: string
          id?: string
          last_reviewed_at?: string | null
          next_review_at?: string | null
          times_correct?: number
          times_seen?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_flashcard_progress_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_lesson_progress: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          last_viewed_at: string | null
          lesson_id: string
          status: Database["public"]["Enums"]["lesson_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          last_viewed_at?: string | null
          lesson_id: string
          status?: Database["public"]["Enums"]["lesson_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          last_viewed_at?: string | null
          lesson_id?: string
          status?: Database["public"]["Enums"]["lesson_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "learning_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_modelling_progress: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          last_watched_at: string | null
          step_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          last_watched_at?: string | null
          step_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          last_watched_at?: string | null
          step_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_modelling_progress_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "modelling_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      user_resumes: {
        Row: {
          extracted_text: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          parsed_resume_json: Record<string, unknown> | null
          review_json: Record<string, unknown> | null
          updated_at: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          extracted_text?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          parsed_resume_json?: Record<string, unknown> | null
          review_json?: Record<string, unknown> | null
          updated_at?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          extracted_text?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          parsed_resume_json?: Record<string, unknown> | null
          review_json?: Record<string, unknown> | null
          updated_at?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      call_event_status: "scheduled" | "completed" | "canceled"
      connection_type: "cold" | "alumni" | "friend" | "referral"
      contact_stage:
        | "researching"
        | "messaged"
        | "scheduled"
        | "call_done"
        | "strong_connection"
        | "referral_requested"
        | "interview"
        | "offer"
      flashcard_track: "technicals" | "behaviorals"
      interaction_type: "email" | "call" | "coffee_chat"
      lesson_status: "not_started" | "in_progress" | "complete"
      mock_interview_difficulty: "core" | "common" | "advanced"
      mock_interview_track: "technicals" | "behaviorals"
      topic_difficulty: "core" | "common" | "advanced"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      call_event_status: ["scheduled", "completed", "canceled"],
      connection_type: ["cold", "alumni", "friend", "referral"],
      contact_stage: [
        "researching",
        "messaged",
        "scheduled",
        "call_done",
        "strong_connection",
        "referral_requested",
        "interview",
        "offer",
      ],
      flashcard_track: ["technicals", "behaviorals"],
      interaction_type: ["email", "call", "coffee_chat"],
      lesson_status: ["not_started", "in_progress", "complete"],
      mock_interview_difficulty: ["core", "common", "advanced"],
      mock_interview_track: ["technicals", "behaviorals"],
      topic_difficulty: ["core", "common", "advanced"],
    },
  },
} as const
