# Expense push reminders

The tracker includes opt-in, per-browser push reminders, a test button, and an off switch. No existing expense entries or access rules are migrated. Preferences and FCM tokens are stored as additional fields on the signed-in user's `subscribers/{uid}` document. Push enrollment does not subscribe anyone to email.

## Activate in production

1. In Firebase project `portfolio-962a9`, open Project settings → Cloud Messaging → Web Push certificates. Generate a key pair if none exists. Copy the **public** key into the Vercel Production variable `VITE_FIREBASE_VAPID_KEY`.
2. Configure a strong random server-only `CRON_SECRET` in Vercel Production. Do not expose this variable in client code.
3. Keep the existing Firebase service-account configuration in Vercel. Its project must match `VITE_FIREBASE_PROJECT_ID`. The service account needs Firestore read/write permissions and permission to send Firebase Cloud Messaging messages (Firebase Cloud Messaging API Admin role, or a custom role with the required send permission). Enable the FCM HTTP v1 API and FCM Registration API for the project if disabled.
4. Redeploy so the public key is included in the browser bundle. Confirm `/api/expense-reminders?status=1` returns `ready: true`. This checks configuration presence, not actual delivery or IAM permissions.
5. Sign in to an expense workspace, expand **Daily reminders**, and choose **Enable notifications**. Only that button requests browser permission. Choose **Send test** and verify the notification on the device. Test sends are limited to one attempt per user/device/minute.
6. Close the tracker and send a test from the same browser after reopening it, then verify a scheduled notification with the tracker closed. On iPhone/iPad use iOS/iPadOS 16.4 or later, add the tracker to the Home Screen, and enable notifications from the installed app.

## Daily schedule

The initial schedule is once daily at 15:30 UTC (9 PM Asia/Kolkata). Vercel Hobby may execute within the following hour, and browsers/OS settings may delay or suppress delivery. The UI therefore says **around 9–10 PM India time**, not an exact alarm. Configurable per-user times require a more frequent scheduler and are not enabled in this first version.

The server sends only to enabled devices owned by users who still have a shared or personal expense workspace. The default skip option checks entries with that user's `createdByUid` and today's India-calendar `expenseDate`; another household member's entry does not suppress their reminder. Turn reminders off before changing the skip preference and enable again.

Notification messages contain no amounts or private transaction details. Clicking opens `/expenses?add=1`; the existing sign-in/access gates remain in place, and the Add Expense form opens only after workspace data is ready.

## Delivery behavior and storage

The server reserves each daily user/device/date attempt atomically in `expenseReminderDeliveries` before sending. This collection is server-only under the existing rules. Duplicate invocations do not resend. Failed or uncertain attempts are not automatically retried that day, favoring prevention of duplicate notifications. A successful FCM response means accepted by the push service, not confirmed device delivery. Invalid/expired registrations reported as `UNREGISTERED` are disabled.

Monitor Vercel cron logs and response counts (`sent`, `skipped`, `duplicate`, `failed`). If desired, configure Firestore TTL on the receipt collection's `createdAt` field only after changing it to an explicit future expiration field; `createdAt` is currently an audit timestamp, not a configured TTL policy. Receipt cleanup is not enabled automatically.

Turning off disables this device's schedule in Firestore; it leaves the browser's site-level notification permission intact. Multiple opted-in browsers can each receive a reminder. Sign-out does not automatically disable reminders, so shared-device users should choose **Turn off** before leaving.

Never loosen expense/subscriber security rules to enable push. If enrollment returns permission-denied, resolve the underlying Firebase sign-in/rules/configuration issue first.

References: https://firebase.google.com/docs/cloud-messaging/web/get-started ; https://firebase.google.com/docs/cloud-messaging/web/receive-messages ; https://vercel.com/docs/cron-jobs/usage-and-pricing ; https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
