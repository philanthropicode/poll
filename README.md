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

