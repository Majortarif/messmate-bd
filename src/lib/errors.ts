/**
 * Every error the app can show. Database RPCs raise these keys as the error
 * message; Supabase Auth reports them as `code`. Each key has a translation
 * under `errors.*` in messages/bn.json and messages/en.json.
 */
export const ERROR_KEYS = [
  "generic",
  "network",
  "not_configured",
  // auth
  "invalid_credentials",
  "email_not_confirmed",
  "user_already_exists",
  "weak_password",
  "same_password",
  "over_email_send_rate_limit",
  "over_request_rate_limit",
  "email_address_invalid",
  "signup_disabled",
  "auth_link_invalid",
  "session_expired",
  // database (raised by RPCs and triggers)
  "not_authenticated",
  "not_manager",
  "not_member",
  "not_in_mess",
  "already_in_mess",
  "invalid_invite",
  "invite_disabled",
  "terms_not_accepted",
  "rate_limited",
  "last_manager",
  "not_pending",
  "not_found",
  "no_pending_request",
  "room_full",
  "room_not_in_mess",
  "invalid_status",
  "insufficient_balance",
  "cutoff_passed",
  "menu_locked",
  "too_many_guests",
  "guests_not_allowed",
  "month_closed",
  "duplicate_trx_id",
  "trx_id_required",
  "invalid_trx_id",
  "invalid_amount",
  "already_reviewed",
  "reason_required",
  "menu_price_locked",
  "menu_has_orders",
  "menu_identity_locked",
  "menu_not_found",
  "month_not_finished",
  "month_already_closed",
  "bill_not_draft",
  "bill_not_posted",
  "no_participants",
  "custom_split_required",
  "custom_split_mismatch",
  "custom_split_duplicate_user",
  "custom_split_not_member",
  "not_reversible",
  "already_reversed",
  "invalid_type",
  "payer_not_member",
  "expense_payer_locked",
  "expense_reimbursed_locked",
  "future_date",
  "invalid_proof_path",
  "mode_change_blocked",
  "not_super_admin",
  "cannot_change_own_role",
  "forbidden_role_change",
  "invalid_kind",
  "too_many_listings",
  "invalid_photo_path",
  "too_many_photos",
  "roommate_profile_required",
  "too_many_checklists",
  "cannot_review_own_service",
  "item_removed_by_moderator",
  // client / generic database
  "upload_failed",
  "file_too_large",
  "invalid_file",
  "invalid_input",
  "duplicate",
] as const;

export type ErrorKey = (typeof ERROR_KEYS)[number];

const known = new Set<string>(ERROR_KEYS);

// Supabase Auth codes that we show under a different, shared key.
const AUTH_ALIASES: Record<string, ErrorKey> = {
  user_already_registered: "user_already_exists",
  email_exists: "user_already_exists",
  otp_expired: "auth_link_invalid",
  flow_state_expired: "auth_link_invalid",
  flow_state_not_found: "auth_link_invalid",
  bad_code_verifier: "auth_link_invalid",
  session_not_found: "session_expired",
  refresh_token_not_found: "session_expired",
};

/** Turns a Supabase / Postgres / network error into a translatable key. */
export function toErrorKey(error: unknown): ErrorKey {
  if (!error) return "generic";
  if (typeof error === "string") return known.has(error) ? (error as ErrorKey) : "generic";
  const { code, message } = error as { code?: unknown; message?: unknown };
  for (const candidate of [code, message]) {
    if (typeof candidate !== "string") continue;
    if (known.has(candidate)) return candidate as ErrorKey;
    if (candidate in AUTH_ALIASES) return AUTH_ALIASES[candidate];
  }
  // Postgres constraint errors (bad phone format, duplicate row, …)
  if (code === "23514" || code === "22P02" || code === "23502" || code === "22001") return "invalid_input";
  if (code === "23505") return "duplicate";
  if (typeof message === "string" && /fetch failed|network|ECONN|ENOTFOUND/i.test(message)) return "network";
  return "generic";
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorKey };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: unknown): ActionResult<never> => ({ ok: false, error: toErrorKey(error) });
