// lib/supabaseClient.js
// Khởi tạo 1 client Supabase duy nhất, dùng chung cho toàn bộ app.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Cảnh báo sớm nếu quên khai báo biến môi trường, tránh lỗi khó hiểu về sau
  console.warn(
    "⚠️ Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env.local"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);