"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Supabase client for the browser. Used for direct file uploads and signed media links. */
export const browserDb = () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_KEY!);
