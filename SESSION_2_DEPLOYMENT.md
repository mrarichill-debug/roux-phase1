# ROUX PHASE 1 - SESSION 2 DEPLOYMENT GUIDE

## 🎉 What You Built in Session 2

You now have a complete authentication system and tutorial flow:
- ✅ Create household or join with invite code
- ✅ Full user authentication (Supabase Auth)
- ✅ Sage's conversational tutorial (5 steps)
- ✅ App shell with bottom navigation
- ✅ Routing between all main screens

---

## 🚀 Option 1: Run Locally (Test Everything Before Deploying)

### Prerequisites
1. Node.js 18+ installed ([download here](https://nodejs.org))
2. Your Supabase and Anthropic API keys from Session 1

### Steps

**1. Open Terminal/Command Prompt**

**2. Navigate to the project folder**
```bash
cd path/to/roux-phase1
```

**3. Install dependencies**
```bash
npm install
```
This will take 1-2 minutes. You'll see a lot of text scroll by - that's normal.

**4. Create your .env file**
```bash
# On Mac/Linux:
cp .env.example .env

# On Windows:
copy .env.example .env
```

**5. Edit the .env file**
Open the `.env` file in any text editor and add your API keys:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-from-session-1
VITE_ANTHROPIC_API_KEY=sk-ant-your-key-from-session-1
```

**6. Start the development server**
```bash
npm run dev
```

You'll see something like:
```
VITE v5.0.8  ready in 423 ms

➜  Local:   http://localhost:3000/
➜  press h + enter to show help
```

**7. Open your browser**
Go to `http://localhost:3000`

**8. Test it!**
- Create a household (pick any name)
- Go through Sage's tutorial
- Click around the bottom nav
- Everything works!

**9. Test on your phone**
- Make sure your phone is on the same WiFi as your computer
- Find your computer's IP address:
  - Mac: System Settings → Network
  - Windows: `ipconfig` in Command Prompt
  - Look for something like `192.168.1.XXX`
- On your phone browser, go to `http://192.168.1.XXX:3000` (use your actual IP)
- Add to home screen for app-like experience!

---

## 🌐 Option 2: Deploy to Vercel (Public URL)

### Why Vercel?
- Free for personal projects
- Automatic HTTPS
- Takes 5 minutes
- Updates automatically when you change code

### Steps

**1. Create a Vercel account**
- Go to https://vercel.com
- Click "Sign Up"
- Use GitHub (easiest) or email

**2. Create a GitHub repository**

If you're comfortable with GitHub:
- Create a new repository
- Push your `roux-phase1` folder to it
- Skip to step 3

If you're new to GitHub:
- Go to https://github.com
- Sign up if needed
- Click the "+" in the top right → "New repository"
- Name it `roux-phase1`
- Click "Create repository"
- Follow the instructions to upload your files (GitHub has a web uploader)

**3. Deploy in Vercel**
- In Vercel dashboard, click "Add New" → "Project"
- Click "Import Git Repository"
- Select your `roux-phase1` repository
- Click "Import"
- Click "Environment Variables" (expand the section)
- Add your three variables:
  - `VITE_SUPABASE_URL` = your Supabase URL
  - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
  - `VITE_ANTHROPIC_API_KEY` = your Anthropic API key
- Click "Deploy"

**4. Wait 2-3 minutes**
Vercel will build your app and give you a URL like:
`https://roux-phase1-xxxxx.vercel.app`

**5. Test your app**
- Open that URL on your phone
- Create a household
- Go through the tutorial
- Works!

**6. Add to your home screen** (makes it feel like a native app)

**iPhone:**
1. Open the URL in Safari
2. Tap the share button (square with arrow)
3. Tap "Add to Home Screen"
4. Tap "Add"
5. Now you have a Roux icon on your home screen!

**Android:**
1. Open the URL in Chrome
2. Tap the three dots menu
3. Tap "Add to Home screen"
4. Tap "Add"
5. Done!

---

## 🔧 Troubleshooting

**"Module not found" errors when running npm install**
- Make sure you're in the right folder: `cd path/to/roux-phase1`
- Try deleting `node_modules` and running `npm install` again

**App loads but shows "Missing environment variables" error**
- Check your `.env` file exists
- Make sure the variables start with `VITE_`
- Restart the dev server after editing `.env`

**Tutorial loads but Sage doesn't respond**
- Check your Anthropic API key is correct
- Make sure you have credits in your Anthropic account

**Can't join household with invite code**
- Make sure the code is typed correctly (case-sensitive)
- Check that the person who created the household gave you the right code

**Supabase "Invalid JWT" errors**
- Your Supabase anon key might be wrong
- Copy it again from Supabase dashboard → Settings → API

---

## 📱 Getting Ashley to Test

**If you deployed to Vercel:**
1. Just send her the URL
2. She opens it, creates her own household
3. Done!

**If running locally:**
1. Get your computer's IP address (see step 9 above)
2. Make sure Ashley is on your same WiFi
3. Send her `http://YOUR-IP:3000`
4. She can create her own household

---

## ✅ What's Working

- [x] Create household
- [x] Join household with invite code
- [x] Sage tutorial (5 steps)
- [x] Bottom navigation
- [x] Multiple users can use the same app
- [x] Real-time sync between devices
- [x] Works on phone browsers
- [x] Can be added to home screen

---

## 📋 What's Coming in Session 3

- This Week setup flow (the Saturday morning session)
- Recipe library with import
- Day type picker
- Basic meal planning

---

## 🆘 Need Help?

Just ask! Include:
- What you were trying to do
- What happened instead
- Any error messages you see

Ready for Session 3? Just say: **"Ready for Session 3"**
