# Status: Work in Progress (Not Production-Ready)

This project is under active development and is not production-ready. Expect rapid changes and potential breaking issues.

Live App: https://app.philanthropicode.com  
Project intro on Substack: https://whodowewanttobe.substack.com/  
Project planning (Kanban): https://github.com/orgs/philanthropicode/projects/1

---

# Philanthropicode Poll

A lightweight polling app to create, share, and answer civic polls. Built with React + Vite, Firebase (Auth + Firestore), React Router, and Tailwind CSS.

- Create and edit polls
- View poll details & answer with sliders
- Authentication (email/password)
- Share & Feedback pages (+ rate-limited feedback)
- Donations page
- Simple, responsive UI

Repository: https://github.com/philanthropicode/poll

---

## Why this exists & key design decisions

- **Sliders instead of quadratic tokens.**  
  We chose a **−10 … 10** slider for each question over classic quadratic voting “token budgets.” It’s far easier for the general public to understand and yields quick participation without education overhead.  
  **Planned:** we’ll **enforce a quadratic budget constraint** across sliders (each movement “costs” budget quadratically) so results retain the spirit of quadratic polling. This is lower priority than maps/visualization work.

- **Edits allowed until deadline.**  
  Respondents can change answers **any time before the poll’s due date**. After the deadline, both the **questions** (by the owner) and **submissions** (by respondents) are locked by Firestore rules.

- **Communities & visualization first.**  
  Priority is building **heat maps** and enabling people to **self-select a community/district** for analysis. This will drive insight and local relevance.

- **Privacy & simplicity.**  
  We collect minimal profile info (city, state, ZIP) and snapshot it on each submission for analytics (historical integrity, no joins).

- **Shipping over ceremony.**  
  Firebase lets us iterate quickly (Auth, Firestore, Hosting). We’ll offload analytics to a warehouse later (e.g., BigQuery/Postgres) while keeping the app simple.

**More planned work** is tracked on our Kanban: https://github.com/orgs/philanthropicode/projects/1

---

## Current feature set

- Home shows the **10 most recent polls** (title + due date); tap title to view
- Poll view with:
  - Title, description, due date
  - For owner: link to **Edit**
  - Questions as **sliders (−10 to 10)** with optional per-question comments
  - Auto-saving on interaction; final **Submit** stamps a submission status
  - **Share** button (copy link)
- Poll edit:
  - Update description
  - Add/edit/delete questions (while poll is open)
- Auth: sign in/up, profile (city/state/ZIP)
- Feedback page (category, optional pollId), **30s cooldown** enforced server-side
- Donate page (wire to Stripe/other)
- Header + Footer, About page

---

## Tech Stack

- React 19 + Vite 7
- React Router 7
- Tailwind CSS 4
- Firebase: Auth, Firestore, Hosting
- ESLint 9

**Tailwind v4 note:** use `@tailwindcss/postcss` in `postcss.config` and `@import "tailwindcss";` in `src/index.css`.

---

## Data model (high-level)

- `polls/{pollId}`
  - `title`, `description`, `state`, `city`, `zipcode`
  - `dueDate` (YYYY-MM-DD), `dueAt` (Timestamp at end-of-day)
  - `createdBy`, `createdAt`
  - **Subcollection:** `polls/{pollId}/questions/{questionId}`
    - `text`, `order`, `createdAt`

- `submissions/{docId}` (per-user, per-question)  
  `pollId`, `userId`, `questionId`, `value` (−10..10), `comment?`, `updatedAt`,  
  **snapshot location:** `city?`, `state?`, `zip?` (currently client-stamped; will move server-side)

- `submissions/{pollId__uid__status}` (submission status)  
  `pollId`, `userId`, `createdAt`, `submittedAt`

- `profiles/{uid}`  
  `city`, `state`, `zip`, `updatedAt`

- `feedback/{id}`  
  `userId`, `email?`, `message`, `category`, `pollId?`, `path`, `userAgent?`, `createdAt`

- `feedback_ratelimits/{uid}`  
  `lastAt`, `count` (for server-enforced cooldown)

---

## Firestore rules (summary)

- **Polls:** anyone signed-in can create; only owner updates; **dueDate/dueAt immutable** after creation; questions can be created/edited/deleted **only while poll is open**.
- **Submissions:** signed-in users can create/update **only while poll is open** and only their own docs.
- **Feedback:** create requires a **same-batch write** to `feedback_ratelimits/{uid}`; server enforces **≥30s** between messages.

(See repo rules for exact expressions.)

---

## Project Structure (high-level)

```
src/
  components/    # Header, Footer, Hero, ShareButton
  context/       # AuthContext (Firebase Auth)
  lib/           # firebase.js (Firebase init, Firestore cache)
  pages/         # Home, About, Auth (Form), CreatePoll, PollView, PollEdit, Profile, Feedback, Donate
App.jsx          # Routes + layout
main.jsx         # App bootstrap with BrowserRouter and AuthProvider
```

---

## Routes

- `/` — Home (recent polls, hero/welcome)
- `/form` — Sign in / Sign up
- `/profile` — User profile (city/state/ZIP)
- `/about` — About the project
- `/polls/new` — Create a new poll
- `/polls/:id` — View/answer a poll
- `/polls/:id/edit` — Edit a poll
- `/feedback` — Feedback page (rate-limited)
- `/donate` — Donation info

---

## Getting Started

**Prerequisites:** Node.js 18+

Install dependencies:

```bash
npm install
```

Environment variables:  
Copy `.env.template` to `.env` and fill with your Firebase config.

```
VITE_FIREBASE_API_KEY=your-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:123:web:abc
VITE_FIREBASE_MEASUREMENT_ID=G-XXXX
```

Start dev server:

```bash
npm run dev
```

Vite prints the local URL (e.g. http://localhost:5173).

---

## Scripts

- `dev` — start Vite dev server
- `build` — production build
- `preview` — preview production build locally
- `lint` — run ESLint

Examples:

```bash
npm run build
npm run preview
npm run lint
```

---

## Firebase notes

- Firebase init in `src/lib/firebase.js`  
  We use **persistent local cache** for Firestore to speed up reloads.
- `AuthContext` exposes `{ user, loading, signin, signup, signout }`.
- **Hosting headers**:  
  - `index.html` → `Cache-Control: no-store`  
  - Hashed assets (`.js/.css/.svg/.woff2/...`) → `Cache-Control: public, max-age=31536000, immutable`  
    Commit these in `firebase.json`.

---

## Deployment

This repo includes `firebase.json` and `.firebaserc` for Firebase Hosting.

Typical flow:

```bash
npm run build
# ensure Firebase CLI is installed and you are logged in
# npm i -g firebase-tools
# firebase login
firebase deploy
```

---

## Roadmap / Work to be done

High-level priorities (see Kanban for details):

- **Quadratic budget on sliders** (respect a per-poll budget; enforce with UX + validation)
- **Maps & communities:** heat maps; user self-select community/district
- **Server-side stamping** of location on submissions (Cloud Function)
- **Analytics export** (warehouse + dashboards)
- **Private polls / org workspaces / CSV export** (candidate “Pro” features)
- **Moderation & spam controls** (feedback, abusive comments)

Kanban: https://github.com/orgs/philanthropicode/projects/1

---

## Contributing

Issues and PRs are welcome. Please open an issue to discuss substantial changes before a PR.

---

## License

No license specified. All rights reserved unless a license is added in the future.

---

Live App: https://app.philanthropicode.com  
Substack: https://whodowewanttobe.substack.com/