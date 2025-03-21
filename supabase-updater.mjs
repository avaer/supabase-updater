#!/usr/bin/env node

import dotenv from 'dotenv';
import { program } from 'commander';
import { createServerClient } from '@supabase/ssr'

// Create a cookie store that mimics the next/headers cookies API
class LocalCookieStore {
  cookies = new Map();

  get(name) {
    return this.cookies.get(name)?.value;
  }

  getAll() {
    return Array.from(this.cookies.entries()).map(([name, cookie]) => ({
      name,
      value: cookie.value,
      options: cookie.options,
    }));
  }

  set(name, value, options = {}) {
    this.cookies.set(name, { value, options });
  }

  delete(name) {
    this.cookies.delete(name);
  }

  has(name) {
    return this.cookies.has(name);
  }
}

export const createClient = async ({
  jwt,
} = {}) => {
  if (!process.env.SUPABASE_URL) {
    throw new Error('SUPABASE_URL is not set');
  }
  if (!process.env.SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_ANON_KEY is not set');
  }
  if (!jwt) {
    throw new Error('JWT is not set');
  }

  const cookieStore = new LocalCookieStore();

  return createServerClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || '',
    {
      cookies: {
        getAll() {
          const allCookies = cookieStore.getAll();
          return allCookies;
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
      global: {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    }
  );
};

const main = async () => {
  // Load environment variables from .env file
  dotenv.config();

  // initialize the program
  program
    .name("supabase-updater")
    .description("Update a row in supabase")
    .option("--jwt <token>", "JWT token for authentication")
    .argument("table", "Table to update")
    .argument("id", "ID of the row to update")
    .argument("json", "JSON to update the row with")
    .argument("[condition]", "Optional condition in the format col=value")
    .parse(process.argv);

  const jwt = program.opts().jwt;
  if (!jwt) {
    throw new Error("Error: No JWT token specified");
  }

  const table = program.args[0];
  if (!table) {
    throw new Error("Error: No table specified");
  }
  const id = program.args[1];
  if (!id) {
    throw new Error("Error: No id specified");
  }
  const json = program.args[2];
  if (!json) {
    throw new Error("Error: No json specified");
  }
  const j = JSON.parse(json);
  const condition = program.args[3];
  const conditionParts = condition ? condition.split('=') : null;

  // Create a Supabase client to execute the query
  const supabase = await createClient({
    jwt,
  });

  let query = supabase.from(table)
    .update(j)
    .eq('id', id);
  if (conditionParts) {
    query = query.eq(conditionParts[0], conditionParts[1]);
  }

  const result = await query;
  if (!result.error) {
    console.log(result.data);
  } else {
    throw new Error(`Error: ${result.error.message}`);
  }
};

// Run only when this file is executed directly (not when imported as a module)
if (import.meta.url === import.meta.resolve('./supabase-updater.mjs')) {
  main();
}
