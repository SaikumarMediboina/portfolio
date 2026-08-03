import type { User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  writeBatch,
  type DocumentData,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "../lib/firebase";

export const EXPENSE_HOUSEHOLD_ID = "sai-naveen";

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Food",
  "Housing",
  "Bills",
  "Transport",
  "Shopping",
  "Health",
  "Entertainment",
  "Travel",
  "Other",
] as const;

export type ExpenseMember = {
  id: string;
  displayName: "Sai" | "Naveen";
  role: "owner" | "member";
  email: string;
  photoURL: string;
};

export type ExpenseCategory = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type ExpenseEntry = {
  id: string;
  amountPaise: number;
  categoryId: string;
  categoryName: string;
  description: string;
  expenseDate: string;
  paidByUid: string;
  paidByName: "Sai" | "Naveen";
  createdByUid: string;
  createdAtMillis: number;
};

export type ExpenseAccessState = {
  householdExists: boolean;
  member: ExpenseMember | null;
};

export type ExpenseLiveData = {
  categories: ExpenseCategory[];
  entries: ExpenseEntry[];
  members: ExpenseMember[];
};

type LiveDataHandler = (data: ExpenseLiveData) => void;

function assertExpenseStore(): Firestore {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured for this website yet.");
  }

  return db;
}

function householdRef(store = assertExpenseStore()) {
  return doc(store, "expenseHouseholds", EXPENSE_HOUSEHOLD_ID);
}

function membersRef(store = assertExpenseStore()) {
  return collection(store, "expenseHouseholds", EXPENSE_HOUSEHOLD_ID, "members");
}

function memberRef(uid: string, store = assertExpenseStore()) {
  return doc(store, "expenseHouseholds", EXPENSE_HOUSEHOLD_ID, "members", uid);
}

function categoriesRef(store = assertExpenseStore()) {
  return collection(store, "expenseHouseholds", EXPENSE_HOUSEHOLD_ID, "categories");
}

function expensesRef(store = assertExpenseStore()) {
  return collection(store, "expenseHouseholds", EXPENSE_HOUSEHOLD_ID, "expenses");
}

function normalizedText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function mapMember(id: string, data: DocumentData): ExpenseMember {
  return {
    id,
    displayName: data.displayName === "Naveen" ? "Naveen" : "Sai",
    role: data.role === "owner" ? "owner" : "member",
    email: normalizedText(data.email),
    photoURL: normalizedText(data.photoURL),
  };
}

function mapCategory(id: string, data: DocumentData): ExpenseCategory {
  return {
    id,
    name: normalizedText(data.name),
    isDefault: Boolean(data.isDefault),
  };
}

function mapEntry(id: string, data: DocumentData): ExpenseEntry {
  const createdAt = data.createdAt;

  return {
    id,
    amountPaise:
      typeof data.amountPaise === "number" && Number.isFinite(data.amountPaise)
        ? Math.round(data.amountPaise)
        : 0,
    categoryId: normalizedText(data.categoryId),
    categoryName: normalizedText(data.categoryName) || "Other",
    description: normalizedText(data.description),
    expenseDate: normalizedText(data.expenseDate),
    paidByUid: normalizedText(data.paidByUid),
    paidByName: data.paidByName === "Naveen" ? "Naveen" : "Sai",
    createdByUid: normalizedText(data.createdByUid),
    createdAtMillis:
      createdAt && typeof createdAt.toMillis === "function" ? createdAt.toMillis() : 0,
  };
}

function defaultCategoryId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function randomInviteToken() {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID().replace(/-/g, "");
  }

  if (!cryptoApi?.getRandomValues) {
    throw new Error("A secure browser context is required to create an invite.");
  }

  const bytes = new Uint8Array(24);
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function subscribeToExpenseAccess(
  uid: string,
  onChange: (access: ExpenseAccessState) => void,
  onError: (error: Error) => void,
) {
  const store = assertExpenseStore();
  let householdReady = false;
  let memberReady = false;
  let householdExists = false;
  let member: ExpenseMember | null = null;

  const emit = () => {
    if (householdReady && memberReady) {
      onChange({ householdExists, member });
    }
  };

  const unsubscribeHousehold = onSnapshot(
    householdRef(store),
    (snapshot) => {
      householdReady = true;
      householdExists = snapshot.exists();
      emit();
    },
    onError,
  );
  const unsubscribeMember = onSnapshot(
    memberRef(uid, store),
    (snapshot) => {
      memberReady = true;
      member = snapshot.exists() ? mapMember(snapshot.id, snapshot.data()) : null;
      emit();
    },
    onError,
  );

  return () => {
    unsubscribeHousehold();
    unsubscribeMember();
  };
}

export function subscribeToExpenseData(
  onChange: LiveDataHandler,
  onError: (error: Error) => void,
) {
  const store = assertExpenseStore();
  const current: ExpenseLiveData = {
    categories: [],
    entries: [],
    members: [],
  };
  const ready = {
    categories: false,
    entries: false,
    members: false,
  };

  const emit = () => {
    if (ready.categories && ready.entries && ready.members) {
      onChange({
        categories: [...current.categories],
        entries: [...current.entries],
        members: [...current.members],
      });
    }
  };

  const unsubscribes: Unsubscribe[] = [
    onSnapshot(
      categoriesRef(store),
      (snapshot) => {
        current.categories = snapshot.docs
          .map((item) => mapCategory(item.id, item.data()))
          .filter((category) => category.name)
          .sort((left, right) => left.name.localeCompare(right.name));
        ready.categories = true;
        emit();
      },
      onError,
    ),
    onSnapshot(
      expensesRef(store),
      (snapshot) => {
        current.entries = snapshot.docs
          .map((item) => mapEntry(item.id, item.data()))
          .filter((entry) => entry.amountPaise > 0)
          .sort(
            (left, right) =>
              right.expenseDate.localeCompare(left.expenseDate) ||
              right.createdAtMillis - left.createdAtMillis,
          );
        ready.entries = true;
        emit();
      },
      onError,
    ),
    onSnapshot(
      membersRef(store),
      (snapshot) => {
        current.members = snapshot.docs
          .map((item) => mapMember(item.id, item.data()))
          .sort((left, right) => (left.role === "owner" ? -1 : right.role === "owner" ? 1 : 0));
        ready.members = true;
        emit();
      },
      onError,
    ),
  ];

  return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
}

export async function createExpenseHousehold(user: User) {
  const store = assertExpenseStore();
  const sharedHouseholdRef = householdRef(store);
  const ownerMemberRef = memberRef(user.uid, store);

  await runTransaction(store, async (transaction) => {
    const existingHousehold = await transaction.get(sharedHouseholdRef);

    if (existingHousehold.exists()) {
      throw new Error("The shared household already exists. Ask Sai for the Naveen invite link.");
    }

    transaction.set(sharedHouseholdRef, {
      name: "Sai & Naveen",
      ownerUid: user.uid,
      naveenUid: "",
      naveenInviteToken: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.set(ownerMemberRef, {
      uid: user.uid,
      displayName: "Sai",
      role: "owner",
      email: user.email ?? "",
      photoURL: user.photoURL ?? "",
      joinedAt: serverTimestamp(),
    });
  });

  const categoryBatch = writeBatch(store);
  DEFAULT_EXPENSE_CATEGORIES.forEach((name) => {
    categoryBatch.set(doc(categoriesRef(store), defaultCategoryId(name)), {
      name,
      isDefault: true,
      createdByUid: user.uid,
      createdAt: serverTimestamp(),
    });
  });
  await categoryBatch.commit();
}

export async function createExpenseInvite(ownerUid: string) {
  const store = assertExpenseStore();
  const token = randomInviteToken();
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const inviteRef = doc(store, "expenseInvites", token);
  const batch = writeBatch(store);
  batch.set(inviteRef, {
    householdId: EXPENSE_HOUSEHOLD_ID,
    displayName: "Naveen",
    role: "member",
    active: true,
    createdByUid: ownerUid,
    createdAt: serverTimestamp(),
    expiresAt,
  });
  await batch.commit();

  return token;
}

export async function joinExpenseHousehold(user: User, token: string) {
  const store = assertExpenseStore();
  const cleanToken = token.trim();

  if (!/^[a-f0-9]{32,64}$/i.test(cleanToken)) {
    throw new Error("This invite link is not valid. Ask Sai to create a fresh invite.");
  }

  const inviteRef = doc(store, "expenseInvites", cleanToken);
  const joiningMemberRef = memberRef(user.uid, store);
  const sharedHouseholdRef = householdRef(store);

  await runTransaction(store, async (transaction) => {
    const [householdSnapshot, inviteSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(sharedHouseholdRef),
      transaction.get(inviteRef),
      transaction.get(joiningMemberRef),
    ]);

    if (memberSnapshot.exists()) {
      return;
    }

    if (!householdSnapshot.exists() || !inviteSnapshot.exists()) {
      throw new Error("This invite does not exist. Ask Sai to create a new one.");
    }

    const household = householdSnapshot.data();
    const invite = inviteSnapshot.data();
    const expiresAt = invite.expiresAt;
    const expired =
      expiresAt && typeof expiresAt.toMillis === "function"
        ? expiresAt.toMillis() <= Date.now()
        : true;

    if (
      invite.householdId !== EXPENSE_HOUSEHOLD_ID ||
      invite.active !== true ||
      Boolean(household.naveenUid) ||
      expired
    ) {
      throw new Error("This invite has expired or was already used. Ask Sai for a fresh link.");
    }

    transaction.update(inviteRef, {
      active: false,
      claimedBy: user.uid,
      claimedAt: serverTimestamp(),
    });
    transaction.update(sharedHouseholdRef, {
      naveenUid: user.uid,
      naveenInviteToken: cleanToken,
      updatedAt: serverTimestamp(),
    });
    transaction.set(joiningMemberRef, {
      uid: user.uid,
      displayName: "Naveen",
      role: "member",
      inviteToken: cleanToken,
      email: user.email ?? "",
      photoURL: user.photoURL ?? "",
      joinedAt: serverTimestamp(),
    });
  });
}

export async function addExpenseCategory(userUid: string, name: string) {
  const store = assertExpenseStore();
  await addDoc(categoriesRef(store), {
    name: name.trim(),
    isDefault: false,
    createdByUid: userUid,
    createdAt: serverTimestamp(),
  });
}

export async function addExpenseEntry(input: {
  amountPaise: number;
  category: ExpenseCategory;
  description: string;
  expenseDate: string;
  paidBy: ExpenseMember;
  userUid: string;
}) {
  const store = assertExpenseStore();
  await addDoc(expensesRef(store), {
    amountPaise: input.amountPaise,
    categoryId: input.category.id,
    categoryName: input.category.name,
    description: input.description.trim(),
    expenseDate: input.expenseDate,
    paidByUid: input.paidBy.id,
    paidByName: input.paidBy.displayName,
    createdByUid: input.userUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteExpenseEntry(expenseId: string) {
  const store = assertExpenseStore();
  await deleteDoc(doc(expensesRef(store), expenseId));
}

export async function ensureDefaultExpenseCategories(userUid: string) {
  const store = assertExpenseStore();
  const batch = writeBatch(store);

  DEFAULT_EXPENSE_CATEGORIES.forEach((name) => {
    batch.set(
      doc(categoriesRef(store), defaultCategoryId(name)),
      {
        name,
        isDefault: true,
        createdByUid: userUid,
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
  });

  await batch.commit();
}
