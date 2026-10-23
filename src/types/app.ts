import type { Enums } from "@/types/database";

/** Shape of public.get_my_context() */
export type MyContext = {
  profile: {
    full_name: string;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    platform_role: Enums<"platform_role">;
    preferred_locale: "bn" | "en";
    terms_accepted: boolean;
    is_deleted: boolean;
  } | null;
  membership: {
    id: string;
    mess_id: string;
    mess_name: string;
    role: Enums<"mess_role">;
    status: Enums<"member_status">;
    requested_at: string;
  } | null;
};

export type UpcomingMenu = {
  menu_id: string;
  date: string;
  slot: Enums<"meal_slot">;
  items: string;
  price: number;
  cutoff_at: string;
  is_open: boolean;
  my_status: Enums<"order_status"> | null;
  my_guests: number;
};

/** Shape of public.get_member_dashboard() for a member of a mess */
export type MemberDashboard = {
  has_mess: true;
  today: string;
  month: string;
  month_closed: boolean;
  mess: { id: string; name: string; address: string | null; area_bn: string | null; area_en: string | null; invite_code: string | null };
  membership: {
    id: string;
    role: Enums<"mess_role">;
    status: Enums<"member_status">;
    joined_at: string | null;
    seat: string | null;
    room: { label: string; flat: string | null; building: string | null; type: Enums<"room_type"> } | null;
  };
  settings: {
    meal_rate_mode: Enums<"meal_rate_mode">;
    low_balance_threshold: number;
    guest_meal_allowed: boolean;
    max_guests_per_meal: number;
    credit_limit: number;
  };
  wallet: {
    balance: number;
    total_deposits: number;
    total_spent: number;
    pending_count: number;
    pending_amount: number;
    estimated_balance: number;
    is_low: boolean;
  };
  meals: {
    my_units: number;
    my_meal_cost: number;
    meal_rate: number;
    is_estimate: boolean;
    mess_total_units: number;
    mess_meal_expense: number;
  };
  upcoming_menus: UpcomingMenu[];
  notices: { id: string; title: string; priority: Enums<"priority_level">; is_pinned: boolean; created_at: string }[];
  my_chores: { id: string; title: string; chore_type: Enums<"chore_type">; due_date: string; status: Enums<"chore_status"> }[];
  recent_transactions: { id: string; entry_type: Enums<"ledger_type">; amount: number; description: string | null; created_at: string }[];
  unread_notifications: number;
  care: {
    mood_today: Enums<"mood_level"> | null;
    active_checkin: { id: string; label: string; expected_by: string; status: Enums<"checkin_status"> } | null;
    water_today: { glasses: number; goal: number } | null;
    last_family_call: string | null;
    open_alerts_for_me: number;
  };
};

export type MessInvitePreview = {
  mess_id: string;
  name: string;
  area_name_bn: string | null;
  area_name_en: string | null;
  address: string | null;
  gender_policy: Enums<"gender_pref">;
  member_count: number;
  invite_enabled: boolean;
};
