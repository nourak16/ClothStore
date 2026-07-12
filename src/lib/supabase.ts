/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// Retrieve environment variables from Vite env config.
// These variables are loaded on the client-side.
const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Clean up Supabase URL if it has a trailing slash, '/rest/v1', or other subpaths.
// The Supabase client expects just the project root URL (e.g. 'https://xxx.supabase.co').
const sanitizeSupabaseUrl = (url: string): string => {
  if (!url) return '';
  let cleanUrl = url.trim();
  try {
    const parsedUrl = new URL(cleanUrl);
    if (parsedUrl.hostname.endsWith('.supabase.co') || parsedUrl.hostname.endsWith('.supabase.in')) {
      return parsedUrl.origin;
    }
  } catch (e) {
    // Ignore URL parsing errors and fall back to manual replacement
  }
  return cleanUrl
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/, '')
    .replace(/\/+$/, '');
};

const supabaseUrl = sanitizeSupabaseUrl(rawSupabaseUrl);

// Validate if the Supabase URL is a valid HTTP or HTTPS API URL and not a dashboard URL or placeholder.
const isValidSupabaseConfig = (url: string, key: string): boolean => {
  if (!url || !key) return false;
  
  // Exclude placeholder templates
  if (url.includes('your_supabase_project_url') || key.includes('your_supabase_anon_public_key')) return false;
  
  // Exclude accidental dashboard URLs or wrong endpoints
  if (url.includes('supabase.com/dashboard') || url.includes('/project/')) {
    console.error(
      "❌ SUPABASE CONFIG ERROR: It looks like you pasted your Supabase Dashboard URL into VITE_SUPABASE_URL instead of your API URL.\n" +
      "👉 Please use the API URL from 'Project Settings > API' which looks like: https://your-project-ref.supabase.co"
    );
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    const isValidProtocol = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    
    // An API URL should usually end with .supabase.co or .supabase.in (or localhost/127.0.0.1 for local testing)
    const isStandardDomain = parsedUrl.hostname.endsWith('.supabase.co') || 
                             parsedUrl.hostname.endsWith('.supabase.in') || 
                             parsedUrl.hostname === 'localhost' || 
                             parsedUrl.hostname === '127.0.0.1';
                             
    if (isValidProtocol && !isStandardDomain) {
      console.warn(
        `⚠️ SUPABASE CONFIG WARNING: The configured VITE_SUPABASE_URL ("${url}") does not look like a standard Supabase API endpoint (usually ending with .supabase.co). Please ensure this is correct.`
      );
    }
    
    return isValidProtocol;
  } catch (e) {
    return false;
  }
};

// Initialize Supabase Client gracefully.
// If the user hasn't configured the keys yet, or configured them with placeholder/invalid values,
// we return null to ensure the web preview still builds and functions correctly with the local JSON fallback.
export const supabase = isValidSupabaseConfig(supabaseUrl, supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Log status for easier debugging in the developer console.
if (!supabase) {
  console.warn(
    "⚠️ Supabase is not yet configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables to enable database syncing."
  );
} else {
  console.log("⚡ Supabase is successfully initialized!");
}

/**
 * TypeScript definitions for Supabase Tables.
 * Copy these definitions or use Supabase CLI to generate types for your project.
 */
export interface DBProduct {
  id: number;
  name: string;
  category: string;
  price: number;
  original_price?: number | null;
  description: string;
  image: string;
  images?: string[] | null;
  colors?: Array<{ name: string; hex: string; image: string }> | null;
  created_at?: string;
}

export interface DBOrder {
  id: string; // uuid
  customer_name: string;
  customer_phone: string;
  delivery_area: string;
  delivery_fee: number;
  subtotal: number;
  total_price: number;
  status: 'Pending' | 'Confirmed' | 'Shipped' | 'Completed' | 'Cancelled';
  created_at?: string;
}

export interface DBOrderItem {
  id: string; // uuid or int
  order_id: string;
  product_id: number;
  product_name: string;
  size: string;
  quantity: number;
  price: number; // Unit price at the time of purchase
}
