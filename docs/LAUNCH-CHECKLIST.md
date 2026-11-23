# SkillSwap Production Launch Checklist

A step-by-step, beginner-friendly guide to launch SkillSwap on Render and MongoDB Atlas, configure Google OAuth, set up Resend email notifications, and keep your platform reliable and backed up.

---

## 1. Apply Schema Changes to MongoDB Atlas (Do This First!)

Before deploying the updated code, the additive schema changes (`model OAuthAccount` and `User.emailNotifications`) must be pushed to your live MongoDB Atlas cluster so the database is ready when the server boots.

1. Open a terminal in your project root on your local machine.
2. Run Prisma 6.4 from the `server` directory, pointing `MONGODB_URL` to your Atlas connection string:
   ```bash
   npm --prefix server exec -- prisma db push --schema=prisma/schema.prisma
   ```
   *(Ensure your terminal session has your Atlas `MONGODB_URL` exported or prefixed, e.g. `MONGODB_URL="mongodb+srv://..."`)*
3. Verify the output confirms:
   - `[+] Collection OAuthAccount`
   - `Your database indexes are now in sync with your Prisma schema.`
4. Run `node server/scripts/db-counts.mjs` to confirm all existing records are intact.

---

## 2. Google Cloud Console (OAuth 2.0 PKCE)

To allow users to sign in with Google without passwords:

1. **Create or Select a Project**:
   - Visit the [Google Cloud Console](https://console.cloud.google.com/).
   - Click the project dropdown at the top and click **New Project** (e.g. `SkillSwap-App`).
2. **Configure OAuth Consent Screen**:
   - In the left sidebar, navigate to **APIs & Services > OAuth consent screen**.
   - User Type: Select **External** and click **Create**.
   - App Information: Enter App name (`SkillSwap`), User support email, and Developer contact email.
   - Scopes: Add `openid`, `.../auth/userinfo.email`, and `.../auth/userinfo.profile`.
   - Publishing Status: Click **Publish App** so any Google user can sign in without test user limits.
3. **Create OAuth Client ID**:
   - In the left sidebar, navigate to **APIs & Services > Credentials**.
   - Click **+ Create Credentials > OAuth client ID**.
   - Application type: Select **Web application**.
   - Name: `SkillSwap Web Client`.
   - **Authorized JavaScript origins**:
     - `http://localhost:5173`
     - `https://skillswap.onrender.com` *(replace with your actual Render URL)*
   - **Authorized redirect URIs** (MUST be exact):
     - `http://localhost:5173/api/auth/google/callback`
     - `https://skillswap.onrender.com/api/auth/google/callback` *(replace with your actual Render URL)*
   - Click **Create**.
4. **Copy Credentials to Render**:
   - Copy the generated **Client ID** and **Client Secret**.
   - Go to your [Render Dashboard](https://dashboard.render.com), open your `skillswap` web service, and navigate to **Environment**.
   - Add/Set:
     - `GOOGLE_CLIENT_ID`: `<Your Client ID>`
     - `GOOGLE_CLIENT_SECRET`: `<Your Client Secret>`
     - `PUBLIC_URL`: `https://skillswap.onrender.com` *(exact https site URL)*

---

## 3. Resend Email Notifications

SkillSwap delivers fire-and-forget emails for connection requests, request acceptances, and cancelled events.

1. **Create a Resend Account**:
   - Sign up at [Resend.com](https://resend.com).
2. **Verify a Custom Sending Domain**:
   > [!IMPORTANT]
   > On Resend's free tier with default sandbox credentials, emails can only be sent to your own account email. To send transactional notifications to arbitrary platform users, you must add and verify a custom domain (e.g. `skillswap.app` or `yourdomain.com`) by adding DNS records (DKIM, SPF, MX) at your domain registrar. Always check Resend's CURRENT pricing and free-tier volume allowances.
3. **Generate API Key**:
   - In Resend, go to **API Keys** and click **Create API Key**.
   - Select **Full Access** or **Sending Access**.
   - Copy the `re_...` key.
4. **Configure in Render Environment**:
   - In Render Dashboard > `skillswap` > **Environment**:
     - `RESEND_API_KEY`: `re_...`
     - `EMAIL_FROM`: `SkillSwap <notifications@yourdomain.com>` *(must use your verified domain)*
     - `EMAIL_DRY_RUN`: `false` *(or `true` if you wish to log instead of sending during pre-launch)*

---

## 4. Free Uptime Monitoring (`/api/health/db`)

Render's free web services automatically spin down (sleep) after 15 minutes of inactivity, causing a 30-50 second cold start on the next visitor.

1. **Create an Uptime Monitor**:
   - Sign up for a free monitor service like [UptimeRobot](https://uptimerobot.com) or [Better Uptime](https://betteruptime.com).
2. **Configure HTTP Ping**:
   - Monitor Type: **HTTP(s)**
   - URL to Monitor: `https://skillswap.onrender.com/api/health/db`
   - Monitoring Interval: Every 5 or 10 minutes.
   - Expected Response: HTTP `200` with body `{"status":"ok"}`.
3. **Free-Tier Awareness**:
   > [!NOTE]
   > Uptime pings keep the web service awake and verify that both Express and MongoDB Atlas replica set connections are healthy. Verify Render's CURRENT free-tier policies regarding monthly free instance-hours (e.g., 750 free hours per month).

---

## 5. Site Configuration & Legal Review

1. **Update Site Contact**:
   - Open [`client/src/config/site.js`](file:///d:/project/client/src/config/site.js).
   - Change `CONTACT_EMAIL = 'privacy@skillswap.local'` to your real operational contact or support email (e.g. `support@skillswap.app`).
2. **Review Privacy Policy & Terms**:
   - Navigate to `/privacy` and `/terms` on your running client.
   - Review the plain-language terms with legal counsel or adapt them to match your local regulatory requirements (GDPR, CCPA, etc.).

---

## 6. Live Smoke Test Checklist (Browser Testing)

Once deployed, perform this step-by-step verification on the live URL:

- [ ] **Email/Password Sign-Up**: Register a new user (`userA`). Verify redirect to `/dashboard`.
- [ ] **Google Sign-In**: Click "Continue with Google" on `/auth`. Verify Google consent prompt, redirect back, and onboarding at `/profile/setup`.
- [ ] **Profile Setup & Avatar**: Add skills to teach and learn, search and select an address, upload a JPG/PNG/WebP photo. Verify avatar renders in navbar.
- [ ] **Connection Request & Email**: As `userA`, find `userB` on `/dashboard` and send a connection request. Verify `userB` receives the notification email (or dry-run log).
- [ ] **Accept Request & Chat**: Log in as `userB`, click **Accept** on the pending request card. Open `/chat` and exchange messages in real time.
- [ ] **Peer Review**: Complete a swap and submit a 1-5 star review with comments on `/reviews`.
- [ ] **Event Hosting & Cancellation**: Create an event with a 2-person capacity. RSVP with a peer. Cancel the event as host and verify attendees receive the cancellation email.
- [ ] **Account Deletion**: Navigate to `/profile/setup`, scroll to the bottom Danger Zone, enter confirmation text (`DELETE`) and password, and confirm. Verify immediate logout, redirect to `/` with notice, and complete deletion of all records.

---

## 7. Weekly Production Backup Routine

To protect against accidental data loss:

1. Run the non-destructive backup export script once a week:
   ```bash
   MONGODB_URL="mongodb+srv://..." node server/scripts/export-backup.mjs
   ```
2. The script writes a timestamped snapshot of all collections to an external backup folder (outside the project tree) with document counts and SHA256 integrity verification.
3. Store the exported JSON snapshots in secure, off-site cloud storage.

