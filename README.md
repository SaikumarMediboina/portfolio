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

The site includes a manual admin sender at `/admin-update`.

1. Add backend-only variables in Vercel:
   `ADMIN_SEND_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL`, and Firebase service-account credentials.
2. Prefer `FIREBASE_SERVICE_ACCOUNT_BASE64` for Firebase credentials. It should be the base64 value of the full service-account JSON file.
3. Use `EMAIL_FROM` from a verified Resend sender/domain, for example `Sai Kumar <updates@saikumarmediboina.com>`.
4. Open `/admin-update`, enter the admin secret, title, message, link, and a test recipient first.
5. Leave test recipient blank only when sending to all Firestore subscribers where `subscribed` is `true`.

Emails are sent from a Vercel Function, not from the browser, so API keys are not exposed to visitors.
