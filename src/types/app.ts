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

/** Shape of public.get_manager_dashboard() */
export type ManagerDashboard = {
  month: string;
  month_closed: boolean;
  meal_rate_mode: Enums<"meal_rate_mode">;
  totals: { meal_units: number; meal_expense: number; meal_rate: number; shared_expense: number; bills_posted: number };
  collection: { deposits: number; pending_amount: number; total_due: number; total_advance: number };
  counts: {
    active_members: number;
    inactive_members: number;
    pending_requests: number;
    pending_deposits: number;
    open_complaints: number;
    draft_bills: number;
  };
  daily_meals: { date: string; breakfast: number; lunch: number; dinner: number; total: number }[];
  expense_breakdown: { category: Enums<"expense_category">; amount: number }[];
  balances: {
    user_id: string;
    full_name: string;
    avatar_url: string | null;
    role: Enums<"mess_role">;
    status: Enums<"member_status">;
    room_label: string | null;
    balance: number;
    month_units: number;
  }[];
  top_defaulters: ManagerDashboard["balances"];
  trend: { month: string; deposits: number; expenses: number; bills: number }[];
};

/** Shape of public.get_mess_report() */
export type MessReport = {
  month: string;
  closed: boolean;
  closed_at: string | null;
  estimated: boolean;
  meal_rate_mode: Enums<"meal_rate_mode">;
  meal_rate: number | null;
  totals: { meal_units: number; meal_expense: number; shared_expense: number; bills: number; deposits: number };
  members: {
    user_id: string;
    full_name: string;
    phone: string | null;
    room: string | null;
    status: Enums<"member_status"> | null;
    opening: number;
    deposits: number;
    meal_units: number;
    meal_cost: number;
    est_meal_cost: number;
    bill_cost: number;
    other_net: number;
    closing: number;
    balance_now: number;
  }[];
};

/** One row of public.get_activity_log() */
export type ActivityEntry = {
  id: number;
  created_at: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record_id: string | null;
  mess_id: string | null;
  mess_name: string | null;
  actor_id: string | null;
  actor_name: string | null;
  subject_id: string | null;
  subject_name: string | null;
  data: Record<string, unknown> | null;
  changes: Record<string, [unknown, unknown]> | null;
};

export const ACTIVITY_CATEGORIES = ["money", "members", "spending", "settings", "moderation"] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

/** Shape of public.get_platform_stats() */
export type PlatformStats = {
  users: number;
  messes: number;
  inactive_messes: number;
  active_members: number;
  listings: { pending: number; approved: number };
  services_pending: number;
  recipes_pending: number;
  events_pending: number;
  market_available: number;
  upcoming_events: number;
  open_jobs: number;
  feedback_new: number;
  signups_30d: { date: string; count: number }[];
  messes_by_area: { area_bn: string | null; area_en: string | null; count: number }[];
};

export type AdminPage<T> = { total: number; rows: T[] };

export type AdminMessRow = {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  invite_enabled: boolean;
  created_at: string;
  area_bn: string | null;
  area_en: string | null;
  active_members: number;
  pending_members: number;
  manager: { id: string; name: string; phone: string | null; email: string | null } | null;
  last_activity: string | null;
};

export type AdminUserRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  platform_role: Enums<"platform_role">;
  occupation: Enums<"occupation_type"> | null;
  is_deleted: boolean;
  created_at: string;
  mess_id: string | null;
  mess_name: string | null;
  mess_role: Enums<"mess_role"> | null;
  member_status: Enums<"member_status"> | null;
};

export const PLATFORM_ROLES = ["user", "landlord", "service_provider", "super_admin"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const MODERATION_KINDS = ["listing", "service", "recipe", "event", "job", "market"] as const;
export type ModerationKind = (typeof MODERATION_KINDS)[number];
