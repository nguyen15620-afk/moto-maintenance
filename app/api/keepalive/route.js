// Vercel Cron gọi route này định kỳ để Supabase luôn có hoạt động (tránh bị pause do không dùng).
import { supabase } from "@/lib/supabaseClient";

export async function GET() {
  // head + count: chạm DB thật nhưng không trả dữ liệu nào ra ngoài
  const { error } = await supabase
    .from("vehicles")
    .select("*", { count: "exact", head: true });

  if (error) {
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true });
}
