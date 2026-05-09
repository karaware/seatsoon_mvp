export type PostType = "offer" | "request";
export type PostStatus = "active" | "matched" | "cancelled";
export type MatchStatus = "pending" | "completed" | "cancelled";

export type FoodCourt = {
  id: string;
  name: string;
  slug: string | null;
  area: string | null;
  created_at: string;
};

export type SeatPost = {
  id: string;
  food_court_id: string;
  post_type: PostType;
  people_count: number;
  location_note: string;
  scheduled_time: string | null;
  comment: string | null;
  status: PostStatus;
  anonymous_user_id: string | null;
  created_at: string;
  expires_at: string;
};

export type SeatMatch = {
  id: string;
  food_court_id: string;
  offer_post_id: string;
  request_post_id: string | null;
  matched_by_anonymous_user_id: string;
  status: MatchStatus;
  created_at: string;
  completed_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      food_courts: {
        Row: FoodCourt;
        Insert: Omit<FoodCourt, "id" | "created_at" | "slug"> & {
          id?: string;
          slug?: string | null;
          created_at?: string;
        };
        Update: Partial<Omit<FoodCourt, "id">>;
        Relationships: [];
      };
      seat_posts: {
        Row: SeatPost;
        Insert: Omit<SeatPost, "id" | "created_at" | "expires_at" | "status"> & {
          id?: string;
          created_at?: string;
          expires_at?: string;
          status?: PostStatus;
        };
        Update: Partial<Omit<SeatPost, "id" | "created_at">>;
        Relationships: [
          {
            foreignKeyName: "seat_posts_food_court_id_fkey";
            columns: ["food_court_id"];
            isOneToOne: false;
            referencedRelation: "food_courts";
            referencedColumns: ["id"];
          }
        ];
      };
      seat_matches: {
        Row: SeatMatch;
        Insert: Omit<SeatMatch, "id" | "created_at" | "completed_at" | "status" | "request_post_id"> & {
          id?: string;
          request_post_id?: string | null;
          status?: MatchStatus;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<Omit<SeatMatch, "id" | "created_at">>;
        Relationships: [
          {
            foreignKeyName: "seat_matches_food_court_id_fkey";
            columns: ["food_court_id"];
            isOneToOne: false;
            referencedRelation: "food_courts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seat_matches_offer_post_id_fkey";
            columns: ["offer_post_id"];
            isOneToOne: false;
            referencedRelation: "seat_posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seat_matches_request_post_id_fkey";
            columns: ["request_post_id"];
            isOneToOne: false;
            referencedRelation: "seat_posts";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
