import dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("SUPABASE_URL =", supabaseUrl);
  console.error("SUPABASE_ANON_KEY =", supabaseKey);
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to convert UUID to string for JWT compatibility
export const formatUser = (user) => {
  if (!user) return null;
  return {
    ...user,
    _id: user.id, // For backward compatibility with frontend
  };
};

// Helper to convert snake_case to camelCase
export const toCamelCase = (obj) => {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);

  const camelObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    camelObj[camelKey] = obj[key];
  }
  return camelObj;
};
