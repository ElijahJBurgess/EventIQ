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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action_type: string
          context: Json
          created_at: string
          id: string
          label: string
        }
        Insert: {
          action_type: string
          context?: Json
          created_at?: string
          id?: string
          label: string
        }
        Update: {
          action_type?: string
          context?: Json
          created_at?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          checked_in_at: string | null
          event_id: string | null
          id: string
          last_active_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          checked_in_at?: string | null
          event_id?: string | null
          id?: string
          last_active_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          checked_in_at?: string | null
          event_id?: string | null
          id?: string
          last_active_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      concierge_logs: {
        Row: {
          context: Json
          created_at: string
          id: string
          prompt: string
          recommended_matches: string[]
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          prompt: string
          recommended_matches?: string[]
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          prompt?: string
          recommended_matches?: string[]
        }
        Relationships: []
      }
      connection_actions: {
        Row: {
          action_type: string
          context: Json
          created_at: string
          id: string
          match_company: string | null
          match_name: string
        }
        Insert: {
          action_type: string
          context?: Json
          created_at?: string
          id?: string
          match_company?: string | null
          match_name: string
        }
        Update: {
          action_type?: string
          context?: Json
          created_at?: string
          id?: string
          match_company?: string | null
          match_name?: string
        }
        Relationships: []
      }
      event_analytics: {
        Row: {
          created_at: string
          event_name: string
          id: string
          label: string | null
          metadata: Json
          screen: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          label?: string | null
          metadata?: Json
          screen?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          label?: string | null
          metadata?: Json
          screen?: string | null
        }
        Relationships: []
      }
      event_registrations: {
        Row: {
          career_stage: string | null
          city: string | null
          company: string | null
          created_at: string
          email: string | null
          event_code: string | null
          event_id: string | null
          full_name: string | null
          goals: string[]
          id: string
          job_title: string | null
          linkedin_url: string | null
          looking_for: string | null
          offering: string | null
          phone_number: string | null
          profile_id: string | null
          profile_photo_url: string | null
          registered_at: string | null
          registration_type: string | null
          role_details: Json
          role_type: string | null
          selected_event: string | null
          source_screen: string
          status: string | null
        }
        Insert: {
          career_stage?: string | null
          city?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          event_code?: string | null
          event_id?: string | null
          full_name?: string | null
          goals?: string[]
          id?: string
          job_title?: string | null
          linkedin_url?: string | null
          looking_for?: string | null
          offering?: string | null
          phone_number?: string | null
          profile_id?: string | null
          profile_photo_url?: string | null
          registered_at?: string | null
          registration_type?: string | null
          role_details?: Json
          role_type?: string | null
          selected_event?: string | null
          source_screen?: string
          status?: string | null
        }
        Update: {
          career_stage?: string | null
          city?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          event_code?: string | null
          event_id?: string | null
          full_name?: string | null
          goals?: string[]
          id?: string
          job_title?: string | null
          linkedin_url?: string | null
          looking_for?: string | null
          offering?: string | null
          phone_number?: string | null
          profile_id?: string | null
          profile_photo_url?: string | null
          registered_at?: string | null
          registration_type?: string | null
          role_details?: Json
          role_type?: string | null
          selected_event?: string | null
          source_screen?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          cover_image_url: string | null
          created_at: string | null
          date: string | null
          description: string | null
          end_time: string | null
          event_goals: string[] | null
          event_type: string | null
          id: string
          is_demo: boolean | null
          is_published: boolean | null
          location: string | null
          max_capacity: number | null
          name: string
          organizer_company: string | null
          organizer_id: string | null
          start_time: string | null
          updated_at: string | null
          venue: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          end_time?: string | null
          event_goals?: string[] | null
          event_type?: string | null
          id?: string
          is_demo?: boolean | null
          is_published?: boolean | null
          location?: string | null
          max_capacity?: number | null
          name: string
          organizer_company?: string | null
          organizer_id?: string | null
          start_time?: string | null
          updated_at?: string | null
          venue?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          end_time?: string | null
          event_goals?: string[] | null
          event_type?: string | null
          id?: string
          is_demo?: boolean | null
          is_published?: boolean | null
          location?: string | null
          max_capacity?: number | null
          name?: string
          organizer_company?: string | null
          organizer_id?: string | null
          start_time?: string | null
          updated_at?: string | null
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          event_id: string | null
          highlights: string | null
          id: string
          improvements: string | null
          matching_rating: number | null
          networking_quality: number | null
          overall_rating: number | null
          submitted_at: string | null
          user_id: string | null
          would_return: boolean | null
        }
        Insert: {
          event_id?: string | null
          highlights?: string | null
          id?: string
          improvements?: string | null
          matching_rating?: number | null
          networking_quality?: number | null
          overall_rating?: number | null
          submitted_at?: string | null
          user_id?: string | null
          would_return?: boolean | null
        }
        Update: {
          event_id?: string | null
          highlights?: string | null
          id?: string
          improvements?: string | null
          matching_rating?: number | null
          networking_quality?: number | null
          overall_rating?: number | null
          submitted_at?: string | null
          user_id?: string | null
          would_return?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_actions: {
        Row: {
          action_type: string | null
          created_at: string | null
          id: string
          match_id: string | null
          user_id: string | null
        }
        Insert: {
          action_type?: string | null
          created_at?: string | null
          id?: string
          match_id?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string | null
          created_at?: string | null
          id?: string
          match_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_actions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          ai_explanation: string | null
          conversation_starters: string[] | null
          event_id: string | null
          generated_at: string | null
          id: string
          match_reason: string | null
          match_score: number | null
          recommended_next_step: string | null
          score_breakdown: Json | null
          shared_communities: string[] | null
          shared_goals: string[] | null
          shared_industries: string[] | null
          shared_interests: string[] | null
          user_a_id: string | null
          user_b_id: string | null
        }
        Insert: {
          ai_explanation?: string | null
          conversation_starters?: string[] | null
          event_id?: string | null
          generated_at?: string | null
          id?: string
          match_reason?: string | null
          match_score?: number | null
          recommended_next_step?: string | null
          score_breakdown?: Json | null
          shared_communities?: string[] | null
          shared_goals?: string[] | null
          shared_industries?: string[] | null
          shared_interests?: string[] | null
          user_a_id?: string | null
          user_b_id?: string | null
        }
        Update: {
          ai_explanation?: string | null
          conversation_starters?: string[] | null
          event_id?: string | null
          generated_at?: string | null
          id?: string
          match_reason?: string | null
          match_score?: number | null
          recommended_next_step?: string | null
          score_breakdown?: Json | null
          shared_communities?: string[] | null
          shared_goals?: string[] | null
          shared_industries?: string[] | null
          shared_interests?: string[] | null
          user_a_id?: string | null
          user_b_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_user_a_id_fkey"
            columns: ["user_a_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_user_b_id_fkey"
            columns: ["user_b_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          calendar_export_token: string | null
          confirmed_time: string | null
          created_at: string | null
          duration_minutes: number | null
          event_id: string | null
          id: string
          location_note: string | null
          match_id: string | null
          meeting_notes: string | null
          proposed_time: string | null
          recipient_id: string | null
          requester_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          calendar_export_token?: string | null
          confirmed_time?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          event_id?: string | null
          id?: string
          location_note?: string | null
          match_id?: string | null
          meeting_notes?: string | null
          proposed_time?: string | null
          recipient_id?: string | null
          requester_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          calendar_export_token?: string | null
          confirmed_time?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          event_id?: string | null
          id?: string
          location_note?: string | null
          match_id?: string | null
          meeting_notes?: string | null
          proposed_time?: string | null
          recipient_id?: string | null
          requester_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          event_id: string | null
          id: string
          match_id: string | null
          message_type: string | null
          read_at: string | null
          recipient_id: string | null
          sender_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          event_id?: string | null
          id?: string
          match_id?: string | null
          message_type?: string | null
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          event_id?: string | null
          id?: string
          match_id?: string | null
          message_type?: string | null
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      points: {
        Row: {
          action: string
          created_at: string | null
          event_id: string | null
          id: string
          points_earned: number
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          event_id?: string | null
          id?: string
          points_earned: number
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          event_id?: string | null
          id?: string
          points_earned?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "points_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activities: string[] | null
          areas_of_expertise: string[] | null
          avatar_url: string | null
          bio: string | null
          candidate_level: string | null
          check_size: string | null
          communities: string[] | null
          company: string | null
          company_stage: string | null
          created_at: string | null
          desired_outcomes: string[] | null
          email: string
          favorite_cities: string[] | null
          favorite_conferences: string[] | null
          festivals: string[] | null
          full_name: string | null
          funding_raised: string | null
          hiring_priorities: string | null
          hiring_status: boolean | null
          hobbies: string[] | null
          id: string
          industry_focus: string[] | null
          interests: string[] | null
          investment_stage: string | null
          linkedin_url: string | null
          location: string | null
          looking_for_investors: boolean | null
          matching_goal: string | null
          music_interests: string[] | null
          open_roles: string[] | null
          profile_completed: boolean | null
          profile_completion_score: number | null
          role_details: Json | null
          role_type: string | null
          sports: string[] | null
          title: string | null
          total_points: number | null
          travel_interests: string[] | null
          twitter_url: string | null
          updated_at: string | null
          website_url: string | null
          who_to_meet: string[] | null
        }
        Insert: {
          activities?: string[] | null
          areas_of_expertise?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          candidate_level?: string | null
          check_size?: string | null
          communities?: string[] | null
          company?: string | null
          company_stage?: string | null
          created_at?: string | null
          desired_outcomes?: string[] | null
          email: string
          favorite_cities?: string[] | null
          favorite_conferences?: string[] | null
          festivals?: string[] | null
          full_name?: string | null
          funding_raised?: string | null
          hiring_priorities?: string | null
          hiring_status?: boolean | null
          hobbies?: string[] | null
          id: string
          industry_focus?: string[] | null
          interests?: string[] | null
          investment_stage?: string | null
          linkedin_url?: string | null
          location?: string | null
          looking_for_investors?: boolean | null
          matching_goal?: string | null
          music_interests?: string[] | null
          open_roles?: string[] | null
          profile_completed?: boolean | null
          profile_completion_score?: number | null
          role_details?: Json | null
          role_type?: string | null
          sports?: string[] | null
          title?: string | null
          total_points?: number | null
          travel_interests?: string[] | null
          twitter_url?: string | null
          updated_at?: string | null
          website_url?: string | null
          who_to_meet?: string[] | null
        }
        Update: {
          activities?: string[] | null
          areas_of_expertise?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          candidate_level?: string | null
          check_size?: string | null
          communities?: string[] | null
          company?: string | null
          company_stage?: string | null
          created_at?: string | null
          desired_outcomes?: string[] | null
          email?: string
          favorite_cities?: string[] | null
          favorite_conferences?: string[] | null
          festivals?: string[] | null
          full_name?: string | null
          funding_raised?: string | null
          hiring_priorities?: string | null
          hiring_status?: boolean | null
          hobbies?: string[] | null
          id?: string
          industry_focus?: string[] | null
          interests?: string[] | null
          investment_stage?: string | null
          linkedin_url?: string | null
          location?: string | null
          looking_for_investors?: boolean | null
          matching_goal?: string | null
          music_interests?: string[] | null
          open_roles?: string[] | null
          profile_completed?: boolean | null
          profile_completion_score?: number | null
          role_details?: Json | null
          role_type?: string | null
          sports?: string[] | null
          title?: string | null
          total_points?: number | null
          travel_interests?: string[] | null
          twitter_url?: string | null
          updated_at?: string | null
          website_url?: string | null
          who_to_meet?: string[] | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          event_id: string | null
          executive_summary: string | null
          generated_at: string | null
          generated_by: string | null
          id: string
          insights: string[] | null
          outcome_score: Json | null
          raw_metrics: Json | null
          recommendations: string[] | null
        }
        Insert: {
          event_id?: string | null
          executive_summary?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          insights?: string[] | null
          outcome_score?: Json | null
          raw_metrics?: Json | null
          recommendations?: string[] | null
        }
        Update: {
          event_id?: string | null
          executive_summary?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          insights?: string[] | null
          outcome_score?: Json | null
          raw_metrics?: Json | null
          recommendations?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_engagements: {
        Row: {
          created_at: string | null
          engagement_type: string | null
          event_id: string | null
          id: string
          notes: string | null
          sponsor_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          engagement_type?: string | null
          event_id?: string | null
          id?: string
          notes?: string | null
          sponsor_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          engagement_type?: string | null
          event_id?: string | null
          id?: string
          notes?: string | null
          sponsor_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_engagements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_engagements_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_engagements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          booth_location: string | null
          company_name: string
          contact_email: string | null
          contact_name: string | null
          created_at: string | null
          description: string | null
          event_id: string | null
          goals: string[] | null
          id: string
          logo_url: string | null
          tier: string | null
        }
        Insert: {
          booth_location?: string | null
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          description?: string | null
          event_id?: string | null
          goals?: string[] | null
          id?: string
          logo_url?: string | null
          tier?: string | null
        }
        Update: {
          booth_location?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          description?: string | null
          event_id?: string | null
          goals?: string[] | null
          id?: string
          logo_url?: string | null
          tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
