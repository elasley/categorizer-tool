// src/utils/getCurrentUser.js
import { supabase } from "../config/supabase";

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user || null;
}
