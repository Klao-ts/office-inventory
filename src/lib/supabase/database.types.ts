// NOTE: This file is normally auto-generated via:
//   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
// A hand-written version matching schema.sql is provided here so the project
// type-checks out of the box. Regenerate after any schema change.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      items: {
        Row: {
          id: string;
          name: string;
          category: string;
          sku: string | null;
          unit_price: number;
          current_stock: number;
          minimum_threshold: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category?: string;
          sku?: string | null;
          unit_price?: number;
          current_stock?: number;
          minimum_threshold?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["items"]["Insert"]>;
      };
      withdrawals: {
        Row: {
          id: string;
          item_id: string;
          employee_name: string;
          employee_id: string | null;
          department: string;
          quantity: number;
          status: "pending" | "completed" | "cancelled";
          requested_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          employee_name: string;
          employee_id?: string | null;
          department: string;
          quantity: number;
          status?: "pending" | "completed" | "cancelled";
          requested_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["withdrawals"]["Insert"]>;
      };
      restocks: {
        Row: {
          id: string;
          item_id: string;
          added_quantity: number;
          supplier: string | null;
          note: string | null;
          unit_price: number | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          added_quantity: number;
          supplier?: string | null;
          note?: string | null;
          unit_price?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["restocks"]["Insert"]>;
      };
    };
    Views: {
      low_stock_items: {
        Row: Database["public"]["Tables"]["items"]["Row"];
      };
    };
    Functions: {
      withdraw_item: {
        Args: {
          p_item_id: string;
          p_employee_name: string;
          p_employee_id: string | null;
          p_department: string;
          p_quantity: number;
        };
        Returns: Database["public"]["Tables"]["withdrawals"]["Row"];
      };
      restock_item: {
        Args: {
          p_item_id: string;
          p_added_quantity: number;
          p_supplier: string | null;
          p_note: string | null;
          p_unit_price: number | null;
        };
        Returns: Database["public"]["Tables"]["items"]["Row"];
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
  };
}

export type Item = Database["public"]["Tables"]["items"]["Row"];
export type Withdrawal = Database["public"]["Tables"]["withdrawals"]["Row"];
export type Restock = Database["public"]["Tables"]["restocks"]["Row"];
