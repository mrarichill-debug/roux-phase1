# Roux - Family Meal Planning App
## Phase 1: The Planning Loop

A smart, personalized meal planning platform for busy families — powered by Sage, your AI planning assistant.

---

## 📋 Project Status

**Session 1: Complete ✅**
- Database schema created
- Supabase setup instructions ready
- Ready to configure

**Session 2: Complete ✅**
- Authentication system (create/join household)
- Sage tutorial flow (5 steps)
- App shell with bottom navigation
- Ready to deploy and test!

**Session 3: Next**
- Authentication system
- Tutorial flow with Sage
- App shell and navigation

**Session 3: Planned**
- This Week setup flow
- Recipe library
- Recipe import (photo/URL/text)

**Session 4: Planned**
- Weekly planner
- Shopping list
- Sage chat with voice

**Session 5: Final**
- Leftover logging
- Skipped meals + carry-over
- Polish and deployment

---

## 🎯 Phase 1 Features

### Core Experience
- **This Week Setup** — Sage-led Saturday morning planning session
- **6 Day Types** — Cooking, Quick, Crock Pot, No Cook, Prep, Flex
- **Weekly Planner** — Calendar-style view with meal cards
- **Recipe Library** — Photo, URL, text, and manual import
- **Shopping List** — Auto-generated, grouped by category
- **Leftover Logging** — Real-world tracking after meals
- **Ingredient Carry-Over** — Week-to-week handoff system
- **Sage AI Assistant** — Contextual help throughout

### User Management
- Basic household accounts (2 adults)
- Create or join with invite codes
- Shared plan, real-time sync

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Supabase account (free tier)
- Anthropic API key

### Setup Steps

1. **Configure Supabase**
   - Follow instructions in `SESSION_1_SETUP.md`
   - Run the SQL schema
   - Save your API keys

2. **Install Dependencies** (Session 2+)
   ```bash
   npm install
   ```

3. **Add Environment Variables** (Session 2+)
   ```bash
   # Create .env file with:
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   VITE_ANTHROPIC_API_KEY=your_anthropic_key
   ```

4. **Run Development Server** (Session 2+)
   ```bash
   npm run dev
   ```

5. **Deploy to Vercel** (Session 5)
   - Drag project folder to Vercel
   - Add environment variables
   - Done!

---

## 📞 Support

Questions? Issues? Just ask in our conversation!

---

Built with ❤️ for Lauren, Aric, and their family of seven.
