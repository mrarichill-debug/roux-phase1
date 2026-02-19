# ROUX PHASE 1 - SESSION 1 SETUP GUIDE

## What You Have
- Complete database schema for all Roux Phase 1 features
- Ready to configure Supabase

## What You Need
1. A Supabase account (free)
2. An Anthropic API key (for Sage)
3. 15 minutes to follow these steps

---

## STEP 1: Create Your Supabase Project

1. Go to https://supabase.com
2. Click "Start your project" (sign up with GitHub is easiest)
3. Once logged in, click "New Project"
4. Fill in:
   - **Name:** `roux` (or anything you want)
   - **Database Password:** Create a strong password and **SAVE IT SOMEWHERE SAFE**
   - **Region:** Choose closest to you (e.g., US West, US East, etc.)
5. Click "Create new project"
6. Wait 2-3 minutes while Supabase sets up your database

---

## STEP 2: Set Up the Database Schema

1. In your Supabase project dashboard, look at the left sidebar
2. Click **"SQL Editor"**
3. Click **"New Query"** button (top right)
4. Open the file `supabase-schema.sql` from this folder
5. Copy the ENTIRE contents of that file
6. Paste it into the SQL Editor in Supabase
7. Click **"Run"** (or press Cmd/Ctrl + Enter)
8. You should see: **"Success. No rows returned"**

✅ Your database is now set up with all tables, security policies, and indexes!

---

## STEP 3: Get Your Supabase API Keys

1. In the Supabase dashboard, click **"Settings"** (gear icon in left sidebar)
2. Click **"API"** in the settings menu
3. You'll see two important values:

**Project URL:**
- Looks like: `https://xxxxxxxxxxxxx.supabase.co`
- **Copy this and save it** - you'll need it later

**anon/public key:**
- Long string starting with `eyJ...`
- **Copy this and save it** - you'll need it later

---

## STEP 4: Verify Authentication is Enabled

1. Still in Supabase, click **"Authentication"** in the left sidebar
2. Click **"Providers"**
3. Make sure **"Email"** is toggled ON (it should be by default)
4. That's it - authentication is ready!

---

## STEP 5: Get Your Anthropic API Key

1. Go to https://console.anthropic.com
2. Sign up or log in
3. Click **"API Keys"** in the left sidebar
4. Click **"Create Key"**
5. Give it a name like "Roux Phase 1"
6. **Copy the key and save it** - you won't see it again
7. Add some credits to your account:
   - Click "Billing" in the sidebar
   - Add $20-30 to start (this will last months at Phase 1 usage)

---

## WHAT YOU SHOULD HAVE NOW

Three pieces of information saved somewhere safe:

1. ✅ Supabase Project URL: `https://xxxxx.supabase.co`
2. ✅ Supabase anon key: `eyJ...` (long string)
3. ✅ Anthropic API key: `sk-ant-...`

---

## NEXT STEPS

You're ready for Session 2! When you're ready, just say:

**"Ready for Session 2"**

And I'll build:
- Complete authentication system (create household, join household, invite codes)
- Sage's first-time tutorial flow
- Basic app shell with navigation
- All styling and mobile optimization

Then you'll be able to deploy and test the tutorial!

---

## TROUBLESHOOTING

**"Success. No rows returned" - is that normal?**
Yes! That means the SQL ran successfully. The tables are created even though nothing was inserted.

**Can't find the SQL Editor?**
Look for a "</>" icon in the left sidebar of your Supabase dashboard.

**Error when running the SQL?**
Make sure you copied the ENTIRE file, including the first comment block at the top.

**Need to run the SQL again?**
That's fine - the script is designed to be safe to run multiple times. Just run it again.

---

## Questions?
Just ask! I'm here to help troubleshoot any setup issues.
