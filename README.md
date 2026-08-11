# SkillSwap — Local Skill-Swap & Event Platform 🤝

> A full-stack web platform where users list skills they can teach and skills they want to learn, get matched with nearby peers for skill swaps, and create or join local skill-based meetup events.

---

## 📌 About the Project

I built **SkillSwap** as my final-year IT portfolio project to solve a real-world community problem: learning new practical skills (like coding, guitar, photography, or languages) without expensive course fees.

Instead of paying money, SkillSwap connects local peers who want to trade knowledge mutually. If you know React and want to learn Spanish, SkillSwap matches you with a native Spanish speaker who wants to learn web development.

This project was built from scratch using **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**, **Prisma ORM**, **PostgreSQL**, **NextAuth.js**, and **Socket.io**.

---

## ✨ Features

- **🔐 User Authentication**: Secure Email & Password login (with bcrypt password hashing) and Google OAuth integration via NextAuth.js.
- **🏷️ Interactive Skill Tag Profiles**: Users define skills they can teach (with proficiency levels: *Beginner*, *Intermediate*, *Advanced*, *Expert*) and skills they want to learn using interactive badge tags.
- **⚡ Matching Engine**: Dynamic matching logic that calculates **Mutual Swaps** (User A teaches what User B wants to learn AND vice versa) and direct one-way matches.
- **🗺️ Local Meetups & Interactive Map**: Users can host group study sessions, view upcoming events, and explore interactive OpenStreetMap markers (powered by Leaflet). Includes one-click RSVP tracking.
- **💬 Real-Time Messaging**: Two-panel chat UI with conversation list (`ScrollArea`) and real-time message stream with PostgreSQL persistence.
- **⭐ Ratings & Reviews**: Interactive 5-star rating submission form after completing a session, displaying average rating scores on user cards.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (`Button`, `Card`, `Input`, `Badge`, `Avatar`, `Tabs`, `Dialog`, `Select`, `Textarea`, `Table`, `ScrollArea`)
- **Icons**: Lucide React Icons (`lucide-react`)
- **Maps**: Leaflet + OpenStreetMap (free, no API key required)

### Backend & Database
- **API Routes**: Next.js App Router API Handlers (`route.ts`)
- **ORM**: Prisma ORM v6
- **Database**: PostgreSQL (Supabase or local PostgreSQL connection)
- **Authentication**: NextAuth.js v4 (Credentials + Google OAuth)
- **Password Hashing**: `bcryptjs`
- **Real-Time Communication**: `socket.io` & `socket.io-client`

---

## 📸 Screenshots

*(Add your screenshots here for your portfolio/resume showcase!)*

| Landing Page | Match Dashboard |
| :---: | :---: |
| `![Landing Page](https://via.placeholder.com/600x350?text=SkillSwap+Landing+Page)` | `![Dashboard](https://via.placeholder.com/600x350?text=Match+Dashboard)` |

| Interactive Events & Map | Real-Time Chat |
| :---: | :---: |
| `![Events & Map](https://via.placeholder.com/600x350?text=Events+%26+Map+View)` | `![Chat UI](https://via.placeholder.com/600x350?text=Two-Panel+Chat+UI)` |

---

## 🚀 Getting Started / Installation

Follow these steps to run the project locally on your machine.

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL Database**: Local Postgres instance or free [Supabase](https://supabase.com) account.

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-username/skillswap.git
cd skillswap
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env` in the root directory:
```bash
cp .env.example .env
```

Open `.env` and fill in your PostgreSQL connection string and NextAuth secret:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/skillswap?schema=public"
NEXTAUTH_SECRET="your_random_secret_key_here"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_MAP_PROVIDER="leaflet"
```

### Step 4: Set Up Database Schema & Prisma Client
Run Prisma migrations/push to initialize the tables in your PostgreSQL database:
```bash
npx prisma db push
npx prisma generate
```

### Step 5: Start the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application!

---

## 🧠 What I Learned

> [TODO — Fill in after building for your job interview discussions!]

- **Next.js App Router Architecture**: How server components and client components work together, handling dynamic route params (`params: Promise<{ id: string }>`) and wrapping client search params in `<Suspense>`.
- **Database Modeling with Prisma**: Designing relational schemas (`User`, `Skill`, `UserSkillsTeach`, `UserSkillsLearn`, `Match`, `Event`, `Review`, `Message`) with foreign keys and cascade deletes.
- **Authentication Flows**: Implementing NextAuth credentials provider, hashing passwords securely using `bcryptjs`, and storing session tokens in HTTP cookies.
- **State Management & UI Design**: Building clean, accessible user interfaces using shadcn UI components and managing local React state (`useState`/`useContext`) without external state managers.
- **Handling Real-Time Data**: Persisting chat messages in PostgreSQL while providing instant message stream updates to users.

---

## 🔮 Future Improvements

- [ ] Add distance calculation (in kilometers/miles) between users based on latitude and longitude coordinates.
- [ ] Add email notifications (via Resend/Nodemailer) when a user receives a new match request or meetup RSVP.
- [ ] Add video call integration (using WebRTC or Agora) for remote skill-swapping sessions.
- [ ] Add a calendar sync button (.ics download) for local meetups.

---

## 📜 License

This project is open-source under the [MIT License](LICENSE).
