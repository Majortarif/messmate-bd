import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/export/me — everything MessMate BD stores about the signed-in user,
 * as one JSON file (the "export my data" right in the privacy policy).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Unauthorized", { status: 401 });

  const { data, error } = await supabase.rpc("export_my_data");
  if (error) {
    const limited = error.message.includes("rate_limited");
    return new Response(limited ? "Too many exports, try again later" : "Could not export", { status: limited ? 429 : 500 });
  }

  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
  return new Response(JSON.stringify({ account: { id: auth.user.id, email: auth.user.email }, ...(data as object) }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="messmate-my-data-${day}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
