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
  updateDoc,
  writeBatch,
  type DocumentData,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "../lib/firebase";

export const EXPENSE_HOUSEHOLD_ID = "sai-naveen";

export type ExpenseWorkspace =
  | { kind: "shared" }
  | { kind: "personal"; userId: string };

export const SHARED_EXPENSE_WORKSPACE: ExpenseWorkspace = { kind: "shared" };

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
  displayName: string;
  role: "owner" | "member" | "personal";
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
  paidByName: string;
  createdByUid: string;
  createdAtMillis: number;
};

export type ExpenseBudget = {
  categoryId: string;
  categoryName: string;
  monthlyLimitPaise: number;
};

export type ExpenseAccessState = {
  householdExists: boolean;
  member: ExpenseMember | null;
  personalProfile: ExpenseMember | null;
};

export type ExpenseLiveData = {
  budgets: ExpenseBudget[];
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

function personalProfileRef(uid: string, store = assertExpenseStore()) {
  return doc(store, "personalExpenseUsers", uid);
}

function categoriesRef(workspace: ExpenseWorkspace, store = assertExpenseStore()) {
  return workspace.kind === "shared"
    ? collection(store, "expenseHouseholds", EXPENSE_HOUSEHOLD_ID, "categories")
    : collection(store, "personalExpenseUsers", workspace.userId, "categories");
}

function expensesRef(workspace: ExpenseWorkspace, store = assertExpenseStore()) {
  return workspace.kind === "shared"
    ? collection(store, "expenseHouseholds", EXPENSE_HOUSEHOLD_ID, "expenses")
    : collection(store, "personalExpenseUsers", workspace.userId, "expenses");
}

function budgetsRef(workspace: ExpenseWorkspace, store = assertExpenseStore()) {
  return workspace.kind === "shared"
    ? collection(store, "expenseHouseholds", EXPENSE_HOUSEHOLD_ID, "budgets")
    : collection(store, "personalExpenseUsers", workspace.userId, "budgets");
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

function mapPersonalProfile(id: string, data: DocumentData): ExpenseMember {
  return {
    id,
    displayName: normalizedText(data.displayName) || "Personal user",
    role: "personal",
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

function mapBudget(id: string, data: DocumentData): ExpenseBudget {
  return {
    categoryId: normalizedText(data.categoryId) || id,
    categoryName: normalizedText(data.categoryName) || "Category",
    monthlyLimitPaise:
      typeof data.monthlyLimitPaise === "number" && Number.isFinite(data.monthlyLimitPaise)
        ? Math.round(data.monthlyLimitPaise)
        : 0,
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
    paidByName: normalizedText(data.paidByName) || "Personal user",
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
  let personalReady = false;
  let householdExists = false;
  let member: ExpenseMember | null = null;
  let personalProfile: ExpenseMember | null = null;

  const emit = () => {
    if (householdReady && memberReady && personalReady) {
      onChange({ householdExists, member, personalProfile });
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
  const unsubscribePersonalProfile = onSnapshot(
    personalProfileRef(uid, store),
    (snapshot) => {
      personalReady = true;
      personalProfile = snapshot.exists()
        ? mapPersonalProfile(snapshot.id, snapshot.data())
        : null;
      emit();
    },
    onError,
  );

  return () => {
    unsubscribeHousehold();
    unsubscribeMember();
    unsubscribePersonalProfile();
  };
}

export function subscribeToExpenseData(
  workspace: ExpenseWorkspace,
  personalProfile: ExpenseMember | null,
  onChange: LiveDataHandler,
  onError: (error: Error) => void,
) {
  const store = assertExpenseStore();
  const current: ExpenseLiveData = {
    budgets: [],
    categories: [],
    entries: [],
    members: personalProfile ? [personalProfile] : [],
  };
  const ready = {
    budgets: false,
    categories: false,
    entries: false,
    members: workspace.kind === "personal",
  };

  const emit = () => {
    if (ready.budgets && ready.categories && ready.entries && ready.members) {
      onChange({
        budgets: [...current.budgets],
        categories: [...current.categories],
        entries: [...current.entries],
        members: [...current.members],
      });
    }
  };

  const unsubscribes: Unsubscribe[] = [
    onSnapshot(
      budgetsRef(workspace, store),
      (snapshot) => {
        current.budgets = snapshot.docs
          .map((item) => mapBudget(item.id, item.data()))
          .filter((budget) => budget.monthlyLimitPaise > 0)
          .sort((left, right) => left.categoryName.localeCompare(right.categoryName));
        ready.budgets = true;
        emit();
      },
      (error) => {
        current.budgets = [];
        ready.budgets = true;
        emit();
        onError(error);
      },
    ),
    onSnapshot(
      categoriesRef(workspace, store),
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
      expensesRef(workspace, store),
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
  ];

  if (workspace.kind === "shared") {
    unsubscribes.push(
      onSnapshot(
        membersRef(store),
        (snapshot) => {
          current.members = snapshot.docs
            .map((item) => mapMember(item.id, item.data()))
            .sort((left, right) =>
              left.role === "owner" ? -1 : right.role === "owner" ? 1 : 0,
            );
          ready.members = true;
          emit();
        },
        onError,
      ),
    );
  }

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
    categoryBatch.set(doc(categoriesRef(SHARED_EXPENSE_WORKSPACE, store), defaultCategoryId(name)), {
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

export async function createPersonalExpenseInvite(ownerUid: string) {
  const store = assertExpenseStore();
  const token = randomInviteToken();
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  await writeBatch(store)
    .set(doc(store, "personalExpenseInvites", token), {
      inviteType: "personal",
      active: true,
      createdByUid: ownerUid,
      createdAt: serverTimestamp(),
      expiresAt,
    })
    .commit();

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

export async function joinPersonalExpenseWorkspace(user: User, token: string) {
  const store = assertExpenseStore();
  const cleanToken = token.trim();

  if (!/^[a-f0-9]{32,64}$/i.test(cleanToken)) {
    throw new Error("This private invite link is not valid. Ask Sai for a fresh link.");
  }

  const inviteRef = doc(store, "personalExpenseInvites", cleanToken);
  const profileRef = personalProfileRef(user.uid, store);

  await runTransaction(store, async (transaction) => {
    const [inviteSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(inviteRef),
      transaction.get(profileRef),
    ]);

    if (profileSnapshot.exists()) {
      return;
    }

    if (!inviteSnapshot.exists()) {
      throw new Error("This private invite does not exist. Ask Sai to create a new one.");
    }

    const invite = inviteSnapshot.data();
    const expiresAt = invite.expiresAt;
    const expired =
      expiresAt && typeof expiresAt.toMillis === "function"
        ? expiresAt.toMillis() <= Date.now()
        : true;

    if (invite.inviteType !== "personal" || invite.active !== true || expired) {
      throw new Error("This private invite has expired or was already used.");
    }

    transaction.update(inviteRef, {
      active: false,
      claimedBy: user.uid,
      claimedAt: serverTimestamp(),
    });
    transaction.set(profileRef, {
      uid: user.uid,
      displayName: user.displayName?.trim() || "Personal user",
      email: user.email ?? "",
      photoURL: user.photoURL ?? "",
      inviteToken: cleanToken,
      createdAt: serverTimestamp(),
    });
  });

  const workspace: ExpenseWorkspace = { kind: "personal", userId: user.uid };
  const categoryBatch = writeBatch(store);
  DEFAULT_EXPENSE_CATEGORIES.forEach((name) => {
    categoryBatch.set(doc(categoriesRef(workspace, store), defaultCategoryId(name)), {
      name,
      isDefault: true,
      createdByUid: user.uid,
      createdAt: serverTimestamp(),
    });
  });
  await categoryBatch.commit();
}

export async function addExpenseCategory(
  workspace: ExpenseWorkspace,
  userUid: string,
  name: string,
) {
  const store = assertExpenseStore();
  await addDoc(categoriesRef(workspace, store), {
    name: name.trim(),
    isDefault: false,
    createdByUid: userUid,
    createdAt: serverTimestamp(),
  });
}

export async function addExpenseEntry(input: {
  workspace: ExpenseWorkspace;
  amountPaise: number;
  category: ExpenseCategory;
  description: string;
  expenseDate: string;
  paidBy: ExpenseMember;
  userUid: string;
}) {
  const store = assertExpenseStore();
  await addDoc(expensesRef(input.workspace, store), {
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

export async function updateExpenseEntry(input: {
  workspace: ExpenseWorkspace;
  expenseId: string;
  amountPaise: number;
  category: ExpenseCategory;
  description: string;
  expenseDate: string;
  paidBy: ExpenseMember;
  userUid: string;
}) {
  const store = assertExpenseStore();
  await updateDoc(doc(expensesRef(input.workspace, store), input.expenseId), {
    amountPaise: input.amountPaise,
    categoryId: input.category.id,
    categoryName: input.category.name,
    description: input.description.trim(),
    expenseDate: input.expenseDate,
    paidByUid: input.paidBy.id,
    paidByName: input.paidBy.displayName,
    updatedByUid: input.userUid,
    updatedAt: serverTimestamp(),
  });
}

export async function saveExpenseBudgets(
  workspace: ExpenseWorkspace,
  userUid: string,
  items: Array<{ category: ExpenseCategory; monthlyLimitPaise: number }>,
) {
  const store = assertExpenseStore();
  const batch = writeBatch(store);

  items.forEach(({ category, monthlyLimitPaise }) => {
    const budgetRef = doc(budgetsRef(workspace, store), category.id);

    if (monthlyLimitPaise > 0) {
      batch.set(budgetRef, {
        categoryId: category.id,
        categoryName: category.name,
        monthlyLimitPaise,
        updatedByUid: userUid,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.delete(budgetRef);
    }
  });

  await batch.commit();
}

export async function deleteExpenseEntry(workspace: ExpenseWorkspace, expenseId: string) {
  const store = assertExpenseStore();
  await deleteDoc(doc(expensesRef(workspace, store), expenseId));
}

export async function ensureDefaultExpenseCategories(
  workspace: ExpenseWorkspace,
  userUid: string,
) {
  const store = assertExpenseStore();
  const batch = writeBatch(store);

  DEFAULT_EXPENSE_CATEGORIES.forEach((name) => {
    batch.set(
      doc(categoriesRef(workspace, store), defaultCategoryId(name)),
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
