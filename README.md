# Status: Work in Progress (Not Production-Ready)

This project is under active development and is not production-ready. Expect rapid changes and potential breaking issues.

Live App: https://app.philanthropicode.com  
Project introduction on Substack: https://whodowewanttobe.substack.com/

---

# Philanthropicode Poll

A lightweight polling app to create, share, and view polls. Built with React + Vite, Firebase (Auth + Firestore), React Router, and Tailwind CSS.

- Create and edit polls
- View poll details
- Basic authentication (email/password)
- Share and feedback pages
- Simple, responsive UI

Repository: https://github.com/philanthropicode/poll

## Tech Stack

- React 19 + Vite 7
- React Router 7
- Tailwind CSS 4
- Firebase (Auth, Firestore)
- ESLint 9

## Project Structure (high-level)

```
src/
  components/       # Header, Footer, Hero, ShareButton
  context/          # AuthContext (Firebase Auth)
  lib/              # firebase.js (Firebase initialization)
  pages/            # Route views (Home, About, Auth, CreatePoll, PollView, PollEdit, Profile, Feedback, Donate)
  App.jsx           # Routes
  main.jsx          # App bootstrap with BrowserRouter and AuthProvider
```

## Routes

- / — Home
- /auth — Sign in / Sign up
- /profile — User profile
- /about — About the project
- /polls/new — Create a new poll
- /polls/:id — View a poll
- /polls/:id/edit — Edit a poll
- /feedback — Feedback page
- /donate — Donation info

## Getting Started

Prerequisites:
- Node.js 18+ (recommended)

Install dependencies:
```
npm install
```

Environment variables:
- Copy .env.template to .env and fill with your Firebase config. Note: firebase.js references additional values (storage bucket and messaging sender id). Include them even if .env.template doesn’t, leaving blank if not used.

Example .env:
```
VITE_FIREBASE_API_KEY=your-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:123:web:abc
VITE_FIREBASE_MEASUREMENT_ID=G-XXXX
```

Start the dev server:
```
npm run dev
```
Vite will print the local URL (typically http://localhost:5173).

## Scripts

- dev — Start Vite dev server
- build — Production build
- preview — Preview the production build locally
- lint — Run ESLint

Examples:
```
npm run build
npm run preview
npm run lint
```

## Firebase Notes

- Firebase config is initialized in src/lib/firebase.js.
- AuthContext (src/context/AuthContext.jsx) provides user state and helpers: signin, signup, signout.
- Firestore is initialized and exported as db for data operations.

## Deployment

This repo includes firebase.json and .firebaserc, indicating Firebase Hosting.

Typical flow:
```
npm run build
# ensure Firebase CLI is installed and you are logged in:
# npm i -g firebase-tools
# firebase login
firebase deploy
```

Adjust hosting config as needed in firebase.json.

## Contributing

- This is a work in progress; issues and PRs are welcome.
- Please open an issue to discuss substantial changes before submitting a PR.

## License

No license specified. All rights reserved unless a license is added in the future.

---
Live App: https://app.philanthropicode.com  
Project introduction on Substack: https://whodowewanttobe.substack.com/
