export type Profile = {
  id: string;
  display_name: string;
  role: "owner" | "operator" | "developer";
  created_at: string;
  updated_at: string;
};
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
