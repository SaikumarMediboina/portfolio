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

The repository includes `firestore.rules`. It preserves the existing private subscriber documents
and adds the two-member expense household. Deploy it from the Firebase console or with:

```bash
npx firebase-tools deploy --only firestore:rules --project YOUR_FIREBASE_PROJECT_ID
```

Do not use a public `allow read, write: if true` rule. Expense access is granted only through the
Sai owner record or a single-use Naveen invite.

## Sai & Naveen Expense Tracker

Open `/expenses` after Firebase Authentication, Firestore, and the rules above are active.

1. Sign in with Sai's Google account and choose **Create as Sai**.
2. Choose **Create new invite**. The private link is copied and expires in seven days.
3. Open that link in a separate browser/profile, sign in with Naveen's Google account, and choose
   **Join as Naveen**.
4. Expenses and custom categories now sync live between both browsers through Firestore.

The tracker stores integer paise instead of floating-point rupees. Its collections are:

```text
expenseHouseholds/sai-naveen
expenseHouseholds/sai-naveen/members/{uid}
expenseHouseholds/sai-naveen/expenses/{expenseId}
expenseHouseholds/sai-naveen/categories/{categoryId}
expenseInvites/{singleUseToken}
```

The old browser-only `sai-naveen-expenses` and `sai-naveen-categories` localStorage values are no
longer read. Clearing browser storage therefore does not delete Firestore expenses.

## Sending Updates

The site includes a manual admin sender at `/admin-update`.

1. Add backend-only variables in Vercel:
   `ADMIN_SEND_SECRET`, `NEWSLETTER_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL`, and Firebase service-account credentials.
2. Prefer `FIREBASE_SERVICE_ACCOUNT_BASE64` for Firebase credentials. It should be the base64 value of the full service-account JSON file. The API also supports `FIREBASE_SERVICE_ACCOUNT_JSON` or the split `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and private-key variables.
3. Use `EMAIL_FROM` from a verified Resend sender/domain, for example `Sai Kumar <updates@saikumarmediboina.com>`.
4. Open `/admin-update`, enter the admin secret, title, message, link, and a test recipient first.
5. Leave test recipient blank only when sending to all Firestore subscribers where `subscribed` is `true`.

Emails are sent from a Vercel Function, not from the browser, so API keys are not exposed to visitors.

`NEWSLETTER_SECRET` signs unsubscribe links. It can match `ADMIN_SEND_SECRET`, but keeping it separate makes future rotation cleaner.

## Gemini Chat Assistant

The portfolio assistant uses `/api/chat` as a Vercel Function. The browser sends the visitor question plus a compact, public website context. The server calls Gemini with `GEMINI_API_KEY`, so the key is never exposed in client-side code.

Add these backend-only variables in Vercel:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` optional, defaults to `gemini-2.5-flash`

If the Gemini key is missing, the free-tier quota is reached, or the API cannot answer, the assistant falls back to the built-in website-trained response.
