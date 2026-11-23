# SkillSwap Production Deployment Guide (Render.com + MongoDB Atlas)

This guide provides step-by-step instructions for deploying SkillSwap to [Render.com](https://render.com) using the Infrastructure-as-Code Blueprint (`render.yaml`), connected to a free-tier [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) M0 database.

---

## Architecture & Production Overview

- **Frontend**: React 19 (Vite) built to static assets (`client/dist`).
- **Backend**: Express server running on Node 22 LTS, serving both `/api` routes and the static React SPA with client-side routing fallback.
- **Data Layer**: Prisma ORM with MongoDB Replica Set connector (`mongodb+srv://`).
- **Avatars**: Stored directly in MongoDB as binary WebP documents (`AvatarFile` collection), eliminating data loss on Render's ephemeral disk filesystem.
- **Security**: Strict Content Security Policy (CSP), origin validation (CSRF protection), HttpOnly SameSite Secure session cookies, signed JWT authentication, and Zod input validation.

> [!WARNING]
> **Single Instance Constraint**: The application currently utilizes an in-memory rate limiter (`server/src/lib/rate-limit.js`) and in-memory Nominatim geocoding cache (`server/src/lib/nominatim.js`). You must run **strictly 1 instance** (standard default on Render Free tier). Scaling to multiple concurrent instances requires external Redis caching (planned for a future phase).

---

## Step 1: Setting up MongoDB Atlas

1. **Create an Account & Project**:
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign in or create a free account.
   - Create a new project named `SkillSwap`.

2. **Deploy Free M0 Cluster**:
   - Click **Create Deployment** and select the **M0 (Free)** tier.
   - Choose Cloud Provider: **AWS**.
   - Choose Region: **US West (Oregon) / us-west-2** (matches Render's `oregon` region for lowest network latency).
   - Click **Create Deployment**.

3. **Configure Database Access (User Credentials)**:
   - Navigate to **Security > Database Access** in the Atlas sidebar.
   - Click **Add New Database User**.
   - Authentication Method: **Password**.
   - Choose a secure username (e.g., `skillswap_app`) and a strong, complex password (save this password securely).
   - Database User Privileges: Select **Read and write to any database** (or built-in role scoped to the `skillswap` database).
   - Click **Add User**.

4. **Configure Network Access (IP Whitelist)**:
   - Navigate to **Security > Network Access** in the Atlas sidebar.
   - Click **Add IP Address**.
   - Because Render Free tier uses dynamic outbound IP addresses, add:
     - IP Address: `0.0.0.0/0`
     - Description: `Render dynamic outbound access`
   - Click **Confirm**.
   > [!NOTE]
   > Atlas database access is protected by strong SCRAM-SHA-256 authentication over TLS. Ensure your database user password is long and complex.

5. **Obtain Connection String**:
   - Navigate to **Database > Clusters** and click **Connect**.
   - Select **Drivers** (Node.js).
   - Copy the connection string format:
     ```
     mongodb+srv://<username>:<password>@<cluster-host>/skillswap?retryWrites=true&w=majority&appName=SkillSwap
     ```
   - Replace `<username>` and `<password>` with your database user credentials.
   - Ensure the database name path is explicitly `/skillswap` (before the `?` query parameter).

---

## Step 2: Deploying to Render via Blueprint

SkillSwap includes an automated Infrastructure-as-Code Blueprint file ([`render.yaml`](file:///d:/project/render.yaml)) in the root repository.

1. **Push Repository to GitHub**:
   - Ensure your latest code is pushed to your Git remote (private repository recommended).

2. **Connect Blueprint in Render**:
   - Log in to your [Render Dashboard](https://dashboard.render.com).
   - Click **New +** at the top right and select **Blueprint**.
   - Connect your GitHub repository.
   - Render automatically reads [`render.yaml`](file:///d:/project/render.yaml) and detects the `skillswap` web service.

3. **Configure Environment Variables**:
   Render will prompt you for the un-synced environment variables:
   - `MONGODB_URL`: Paste your MongoDB Atlas connection string (`mongodb+srv://...`).
   - `ALLOWED_ORIGINS`: Set to your expected Render app domain (e.g., `https://skillswap.onrender.com`).
   - `NOMINATIM_USER_AGENT`: Set to a unique application name with a contact email per OpenStreetMap policy (e.g., `SkillSwap-App/1.0 (admin@example.com)`).
   - `JWT_SECRET`: Render automatically generates a cryptographically secure 32-character secret (`generateValue: true`).
   - `TRUST_PROXY`: Pre-configured to `"true"` in `render.yaml`.
   - `AVATAR_STORAGE`: Pre-configured to `"mongo"` in `render.yaml`.
   - `NODE_ENV`: Pre-configured to `"production"` in `render.yaml`.

4. **Initialize Database Schema (`prisma db push`)**:
   Render builds the application, but schema creation must be applied to your new MongoDB Atlas cluster.
   Run `prisma db push` once from your local machine pointing to the Atlas database:
   ```bash
   MONGODB_URL="mongodb+srv://<user>:<password>@<cluster>/skillswap?retryWrites=true&w=majority" npx prisma db push --schema=prisma/schema.prisma
   ```
   *Alternative*: Open the **Shell** tab in the Render Dashboard for your deployed web service and run:
   ```bash
   npx prisma db push --schema=prisma/schema.prisma
   ```

---

## Step 3: Loading Initial Data into Production

Choose **Option A** for a clean production launch, or **Option B** to restore existing development data.

### Option A: Clean Production Launch (Recommended)
Populate only the 13 skill categories into MongoDB, leaving users, matches, and events empty for real users:
```bash
# Preview what will be seeded (Dry Run)
node server/scripts/import-backup.mjs --skills-only

# Apply write to production database
node server/scripts/import-backup.mjs --skills-only --apply
```

### Option B: Full Restore with Development Data
Restore the full baseline snapshot (13 skills, 13 users, 17 teach skills, 15 learn skills, 7 matches, 5 events, 8 attendees, 1 review, 2 messages):
```bash
# Preview restore integrity and manifest (Dry Run)
node server/scripts/import-backup.mjs

# Apply full restore to production database
node server/scripts/import-backup.mjs --apply
```
> [!IMPORTANT]
> **Password Security Notice**: Restoring development data imports test accounts with known development passwords (`password123`). If using Option B, you must immediately reset user passwords or use the platform profile controls to update credentials.

---

## Step 4: Migrating Existing Avatars to MongoDB

If any WebP avatar files exist in disk storage (`public/uploads/avatars/`), migrate them to the database to ensure persistence across Render restarts:
```bash
# Preview files eligible for migration (Dry Run)
node server/scripts/migrate-avatars-to-db.mjs

# Execute migration (creates records in AvatarFile collection; never deletes disk files)
node server/scripts/migrate-avatars-to-db.mjs --apply
```

---

## Step 5: Post-Deployment Verification

1. **Automated Health Check**:
   ```bash
   curl -i https://<your-app>.onrender.com/api/health
   ```
   Expected response: `HTTP/1.1 200 OK`, `{"status":"ok"}`.

2. **Automated Production Smoke Check**:
   Run the 35-assertion automated production check against your live deployed domain:
   ```bash
   PROD_URL="https://<your-app>.onrender.com" node server/scripts/prod-smoke-check.mjs
   ```

3. **Manual Browser Verification**:
   - Open `https://<your-app>.onrender.com` in your browser.
   - Verify CSP headers and that no console errors appear.
   - Sign in using an existing account or register a new user.
   - Confirm the "Fill demo credentials" button is **hidden** (production mode guard active).
   - Check the Interactive Map (`/events`) — confirm Leaflet tiles and markers load.
   - Upload a profile avatar and reload to confirm it persists via MongoDB.
   - Check the Dashboard (`/dashboard`) — verify that Accept/Decline controls render on incoming swap requests.

---

## Step 6: Maintenance & Troubleshooting

1. **Free-Tier Sleep Behavior**:
   - Render web services on the free tier spin down (sleep) after 15 minutes of inactivity.
   - The first request after sleep initiates a cold start and may take 45–60 seconds to respond. Subsequent requests respond instantly.
   - You can configure a free external uptime monitor (e.g. UptimeRobot) pinging `/api/health` every 10 minutes if you wish to prevent sleeping.

2. **MongoDB Atlas Connection Drops**:
   - If Render logs show `MongoServerSelectionError` or connection timeout, verify in MongoDB Atlas that **Network Access** still has `0.0.0.0/0` active.
   - Ensure the database user has correct read/write privileges.

3. **Single Instance Limitation**:
   - Do not scale your Render web service beyond 1 instance. Multi-instance scaling will fragment in-memory rate limits and geocode caching.

4. **Viewing Live Logs**:
   - Access real-time server output, HTTP request logs, and error traces in the **Logs** tab of your Render Dashboard.

