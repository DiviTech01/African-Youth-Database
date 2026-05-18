import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: 'aws-0-eu-west-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.lfvbwpmpuyfujrpwwgol',
  password: 'Divine1234@Ayo.ymis.com',
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log('Connected to Supabase directly');

// ── 2. Trigger: auto-create User profile when Supabase auth user is created ──
console.log('\n2. Creating auto-profile trigger...');
await client.query(`
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger AS $$
  BEGIN
    INSERT INTO public."User" (id, email, name, role, "createdAt", "updatedAt")
    VALUES (
      NEW.id::text,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      'REGISTERED',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
`);
await client.query(`
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`);
console.log('Trigger created');

// ── 3. Backfill: create User rows for any existing auth users without one ────
console.log('\n3. Backfilling existing auth users...');
const backfill = await client.query(`
  INSERT INTO public."User" (id, email, name, role, "createdAt", "updatedAt")
  SELECT
    au.id::text,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
    'REGISTERED',
    NOW(),
    NOW()
  FROM auth.users au
  LEFT JOIN public."User" u ON u.id = au.id::text
  WHERE u.id IS NULL
  RETURNING email;
`);
console.log('Backfilled:', backfill.rows.map(r => r.email));

// ── 4. Check auth.users to see all registered accounts ───────────────────────
console.log('\n4. Checking auth.users...');
const authUsers = await client.query(`SELECT id::text, email, created_at FROM auth.users ORDER BY created_at DESC;`);
console.log('Auth users:', authUsers.rows);

// Ensure all auth users have a profile row
const backfill2 = await client.query(`
  INSERT INTO public."User" (id, email, name, role, "createdAt", "updatedAt")
  SELECT au.id::text, au.email,
    COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
    'REGISTERED', NOW(), NOW()
  FROM auth.users au
  LEFT JOIN public."User" u ON u.id = au.id::text
  WHERE u.id IS NULL
  RETURNING email;
`);
if (backfill2.rows.length) console.log('Additional backfill:', backfill2.rows.map(r => r.email));

// ── 5. Set roles ──────────────────────────────────────────────────────────────
console.log('\n5. Setting roles...');
const adminResult = await client.query(`
  UPDATE "User" SET role = 'ADMIN' WHERE email = 'pacsdaglobal@gmail.com' RETURNING email, role;
`);
console.log('Admin:', adminResult.rows);
const contribResult = await client.query(`
  UPDATE "User" SET role = 'CONTRIBUTOR' WHERE email = 'obikehie44@gmail.com' RETURNING email, role;
`);
console.log('Contributor:', contribResult.rows);

// ── 6. Enable RLS on User table ───────────────────────────────────────────────
console.log('\n5. Enabling RLS on User table...');
await client.query(`ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;`);

// Security-definer helper so admin policy doesn't cause recursive RLS
await client.query(`
  CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean AS $$
    SELECT EXISTS (
      SELECT 1 FROM public."User"
      WHERE id = auth.uid()::text AND role = 'ADMIN'
    );
  $$ LANGUAGE sql SECURITY DEFINER STABLE;
`);

await client.query(`
  DROP POLICY IF EXISTS "Users can read own profile" ON public."User";
  CREATE POLICY "Users can read own profile"
    ON public."User" FOR SELECT
    USING (auth.uid()::text = id OR public.is_admin());
`);
await client.query(`
  DROP POLICY IF EXISTS "Users can update own profile" ON public."User";
  CREATE POLICY "Users can update own profile"
    ON public."User" FOR UPDATE
    USING (auth.uid()::text = id);
`);
await client.query(`
  DROP POLICY IF EXISTS "Admins can update any profile" ON public."User";
  CREATE POLICY "Admins can update any profile"
    ON public."User" FOR UPDATE
    USING (public.is_admin());
`);
await client.query(`
  DROP POLICY IF EXISTS "Service role full access" ON public."User";
  CREATE POLICY "Service role full access"
    ON public."User"
    USING (current_setting('role') = 'service_role' OR auth.jwt() ->> 'role' = 'service_role');
`);
console.log('RLS enabled with policies');

// ── 7. Final state ────────────────────────────────────────────────────────────
console.log('\n6. Current User table:');
const final = await client.query(`SELECT id, email, role, name FROM "User" ORDER BY "createdAt" DESC;`);
console.table(final.rows);

await client.end();
console.log('\nDone!');
