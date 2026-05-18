# Portfolio

React + Vite portfolio website deployed on Vercel.

## Local Setup

```bash
npm install
npm run dev
```

## Google Sign-In Setup

1. Create a Firebase project.
2. Enable Authentication, then enable the Google sign-in provider.
3. Create a Firestore database.
4. Add authorized domains in Firebase Authentication settings:
   `localhost`, your Vercel domain, and `saikumarmediboina.com`.
5. Copy `.env.example` to `.env.local` and fill the Firebase web app values.
6. Add the same `VITE_FIREBASE_*` variables in Vercel Project Settings.

## Firestore Rules

Use these rules for the first release so each signed-in user can only access their own subscriber document.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /subscribers/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Sending Updates

The website collects subscribers only. Send email updates from a server-side function later, such as a Vercel Function or Firebase Cloud Function, using an email provider like Resend or SendGrid.
