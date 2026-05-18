import type { User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

const SUBSCRIBERS_COLLECTION = "subscribers";

function assertSubscriberStore() {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured. Add Firebase environment variables first.");
  }

  return db;
}

export async function getSubscriberStatus(uid: string) {
  const store = assertSubscriberStore();
  const subscriberRef = doc(store, SUBSCRIBERS_COLLECTION, uid);
  const subscriberSnapshot = await getDoc(subscriberRef);

  if (!subscriberSnapshot.exists()) {
    return false;
  }

  return Boolean(subscriberSnapshot.data().subscribed);
}

export async function saveSubscriber(user: User) {
  const store = assertSubscriberStore();
  const subscriberRef = doc(store, SUBSCRIBERS_COLLECTION, user.uid);
  const subscriberSnapshot = await getDoc(subscriberRef);
  const subscriberPayload: Record<string, unknown> = {
    uid: user.uid,
    name: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    subscribed: true,
    source: "portfolio",
    updatedAt: serverTimestamp(),
    unsubscribedAt: null,
  };

  if (!subscriberSnapshot.exists()) {
    subscriberPayload.createdAt = serverTimestamp();
  }

  await setDoc(subscriberRef, subscriberPayload, { merge: true });
}

export async function unsubscribeSubscriber(uid: string) {
  const store = assertSubscriberStore();
  const subscriberRef = doc(store, SUBSCRIBERS_COLLECTION, uid);

  await setDoc(
    subscriberRef,
    {
      subscribed: false,
      updatedAt: serverTimestamp(),
      unsubscribedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
