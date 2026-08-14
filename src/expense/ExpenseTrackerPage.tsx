import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { isFirebaseConfigured } from "../lib/firebase";
import {
  addExpenseCategory,
  addExpenseEntry,
  createExpenseHousehold,
  createExpenseInvite,
  createPersonalExpenseInvite,
  deleteExpenseEntry,
  ensureDefaultExpenseCategories,
  joinExpenseHousehold,
  joinPersonalExpenseWorkspace,
  saveExpenseBudgets,
  SHARED_EXPENSE_WORKSPACE,
  subscribeToExpenseAccess,
  subscribeToExpenseData,
  updateExpenseEntry,
  type ExpenseAccessState,
  type ExpenseCategory,
  type ExpenseEntry,
  type ExpenseLiveData,
  type ExpenseMember,
  type ExpenseWorkspace,
} from "./firestore";
import "./ExpenseTrackerPage.css";

type ExpenseTrackerPageProps = {
  authBusy: boolean;
  authError: string;
  authReady: boolean;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onThemeToggle: () => void;
  theme: "light" | "dark";
  user: User | null;
};

type SpendView = "all" | "Sai" | "Naveen";
type ExpenseDialog = "add" | "budgets" | "edit" | "recent" | "invite" | null;
type ExpensePieSlice = {
  color: string;
  fullCircle: boolean;
  name: string;
  path: string;
};

const EMPTY_LIVE_DATA: ExpenseLiveData = {
  budgets: [],
  categories: [],
  entries: [],
  members: [],
};

const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100);

const percentage = (part: number, total: number) =>
  total > 0 ? ((part / total) * 100).toFixed(1) : "0.0";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return today().slice(0, 7);
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);

  if (!year || !month) {
    return "Selected month";
  }

  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function parseRupees(value: string) {
  const amount = Number(value.replace(/[₹,\s]/g, ""));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function formatRupeeInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const decimalPosition = cleaned.indexOf(".");
  const integerSource = decimalPosition >= 0 ? cleaned.slice(0, decimalPosition) : cleaned;
  const decimalSource = decimalPosition >= 0 ? cleaned.slice(decimalPosition + 1) : "";
  const integerDigits = integerSource.replace(/^0+(?=\d)/, "");

  if (!integerDigits && decimalPosition < 0) {
    return "";
  }

  const formattedInteger = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(Number(integerDigits || "0"));

  return decimalPosition >= 0
    ? `${formattedInteger}.${decimalSource.replace(/\D/g, "").slice(0, 2)}`
    : formattedInteger;
}

function formatPaiseForInput(paise: number) {
  const rupees = (paise / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  return formatRupeeInput(rupees);
}

function hashCategoryName(value: string) {
  let hash = 2166136261;

  for (const character of value.trim().toLocaleLowerCase()) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function getCategoryColorMap(categoryNames: string[]) {
  const colors = new Map<string, string>();
  const usedColors = new Set<string>();
  const stableNames = [...new Set(categoryNames.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );

  stableNames.forEach((name) => {
    const hash = hashCategoryName(name);
    let attempt = 0;
    let color = "";

    do {
      const hue = (hash + attempt * 137.508) % 360;
      const saturation = 64 + ((hash + attempt * 17) % 17);
      const lightness = 48 + ((hash + attempt * 11) % 9);
      color = `hsl(${hue.toFixed(1)} ${saturation}% ${lightness}%)`;
      attempt += 1;
    } while (usedColors.has(color));

    usedColors.add(color);
    colors.set(name, color);
  });

  return colors;
}

function getPiePoint(angle: number, radius = 46.5) {
  const radians = ((angle - 90) * Math.PI) / 180;

  return {
    x: 50 + radius * Math.cos(radians),
    y: 50 + radius * Math.sin(radians),
  };
}

function getPieSlices(
  breakdown: Array<[string, number]>,
  totalPaise: number,
  categoryColors: Map<string, string>,
): ExpensePieSlice[] {
  if (!breakdown.length || totalPaise <= 0) {
    return [];
  }

  let currentAngle = 0;

  return breakdown.map(([name, value]) => {
    const startAngle = currentAngle;
    currentAngle += (value / totalPaise) * 360;
    const endAngle = Math.min(currentAngle, 360);

    if (breakdown.length === 1) {
      return {
        color: categoryColors.get(name) ?? "var(--accent)",
        fullCircle: true,
        name,
        path: "",
      };
    }

    const start = getPiePoint(startAngle);
    const end = getPiePoint(endAngle);
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
    const path = [
      "M 50 50",
      `L ${start.x.toFixed(4)} ${start.y.toFixed(4)}`,
      `A 46.5 46.5 0 ${largeArcFlag} 1 ${end.x.toFixed(4)} ${end.y.toFixed(4)}`,
      "Z",
    ].join(" ");

    return {
      color: categoryColors.get(name) ?? "var(--accent)",
      fullCircle: false,
      name,
      path,
    };
  });
}

function getInviteToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("invite")?.trim() ?? "";
}

function getPersonalInviteToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("personalInvite")?.trim() ?? "";
}

function getErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

  if (code === "permission-denied") {
    return "Firestore blocked this action. Deploy the expense-tracker rules from the repository.";
  }

  if (code === "unavailable") {
    return "Firestore is temporarily unreachable. Check the connection and try again.";
  }

  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function AccessCard({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="expense-access-shell">
      <section className="expense-access-card">
        <div className="expense-brand-mark" aria-hidden="true">
          S<span>N</span>
        </div>
        <p className="expense-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}

export default function ExpenseTrackerPage({
  authBusy,
  authError,
  authReady,
  onSignIn,
  onSignOut,
  onThemeToggle,
  theme,
  user,
}: ExpenseTrackerPageProps) {
  const inviteToken = useMemo(getInviteToken, []);
  const personalInviteToken = useMemo(getPersonalInviteToken, []);
  const [access, setAccess] = useState<ExpenseAccessState | null>(null);
  const [liveData, setLiveData] = useState<ExpenseLiveData>(EMPTY_LIVE_DATA);
  const [dataReady, setDataReady] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState("");
  const [generatedPersonalInviteLink, setGeneratedPersonalInviteLink] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paidByUid, setPaidByUid] = useState("");
  const [expenseDate, setExpenseDate] = useState(today);
  const [newCategory, setNewCategory] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [spendView, setSpendView] = useState<SpendView>("all");
  const [selectedCategoryName, setSelectedCategoryName] = useState("");
  const [expenseDialog, setExpenseDialog] = useState<ExpenseDialog>(null);
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({});
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);
  const [editReturnDialog, setEditReturnDialog] = useState<"recent" | null>("recent");
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editPaidByUid, setEditPaidByUid] = useState("");
  const [editExpenseDate, setEditExpenseDate] = useState(today);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("all");
  const [expensePayerFilter, setExpensePayerFilter] = useState("all");
  const workspace = useMemo<ExpenseWorkspace | null>(() => {
    if (access?.member) {
      return SHARED_EXPENSE_WORKSPACE;
    }

    return access?.personalProfile
      ? { kind: "personal", userId: access.personalProfile.id }
      : null;
  }, [access?.member, access?.personalProfile]);
  const currentMember = access?.member ?? access?.personalProfile ?? null;
  const isSharedWorkspace = workspace?.kind === "shared";

  useEffect(() => {
    setAccess(null);
    setLiveData(EMPTY_LIVE_DATA);
    setDataReady(false);

    if (!user || !isFirebaseConfigured) {
      return undefined;
    }

    return subscribeToExpenseAccess(
      user.uid,
      setAccess,
      (nextError) => setError(getErrorMessage(nextError)),
    );
  }, [user]);

  useEffect(() => {
    if (!workspace) {
      return undefined;
    }

    setDataReady(false);
    return subscribeToExpenseData(
      workspace,
      access?.personalProfile ?? null,
      (nextData) => {
        setLiveData(nextData);
        setDataReady(true);
      },
      (nextError) => setError(getErrorMessage(nextError)),
    );
  }, [access?.personalProfile, workspace]);

  useEffect(() => {
    if (!liveData.categories.length) {
      return;
    }

    if (!liveData.categories.some((category) => category.id === categoryId)) {
      setCategoryId(liveData.categories[0].id);
    }
  }, [categoryId, liveData.categories]);

  useEffect(() => {
    if (!liveData.members.length) {
      return;
    }

    if (!liveData.members.some((member) => member.id === paidByUid)) {
      setPaidByUid(
        liveData.members.find((member) => member.id === currentMember?.id)?.id ??
          liveData.members[0].id,
      );
    }
  }, [currentMember?.id, liveData.members, paidByUid]);

  const runAction = async (name: string, action: () => Promise<void>, successMessage: string) => {
    setBusyAction(name);
    setError("");
    setFeedback("");

    try {
      await action();
      setFeedback(successMessage);
      return true;
    } catch (nextError) {
      setError(getErrorMessage(nextError));
      return false;
    } finally {
      setBusyAction("");
    }
  };

  const visibleEntries = useMemo(
    () => liveData.entries.filter((entry) => entry.expenseDate.startsWith(selectedMonth)),
    [liveData.entries, selectedMonth],
  );

  const totalPaise = visibleEntries.reduce((sum, entry) => sum + entry.amountPaise, 0);
  const saiPaidPaise = visibleEntries
    .filter((entry) => entry.paidByName === "Sai")
    .reduce((sum, entry) => sum + entry.amountPaise, 0);
  const naveenPaidPaise = totalPaise - saiPaidPaise;

  const chartEntries = useMemo(
    () =>
      !isSharedWorkspace || spendView === "all"
        ? visibleEntries
        : visibleEntries.filter((entry) => entry.paidByName === spendView),
    [isSharedWorkspace, spendView, visibleEntries],
  );
  const chartTotalPaise = chartEntries.reduce((sum, entry) => sum + entry.amountPaise, 0);

  const breakdown = useMemo(() => {
    const totals = new Map<string, number>();
    chartEntries.forEach((entry) => {
      totals.set(entry.categoryName, (totals.get(entry.categoryName) ?? 0) + entry.amountPaise);
    });

    return [...totals]
      .filter(([, value]) => value > 0)
      .sort((left, right) => right[1] - left[1]);
  }, [chartEntries]);
  const averageExpensePaise = visibleEntries.length
    ? Math.round(totalPaise / visibleEntries.length)
    : 0;
  const topCategory = breakdown[0] ?? null;
  const highestCategoryValue = Math.max(...breakdown.map(([, value]) => value), 1);
  const chartViewLabel = isSharedWorkspace
    ? spendView === "all"
      ? "Household"
      : spendView
    : "My spending";
  const categoryColors = useMemo(
    () =>
      getCategoryColorMap([
        ...liveData.categories.map((category) => category.name),
        ...liveData.entries.map((entry) => entry.categoryName),
      ]),
    [liveData.categories, liveData.entries],
  );
  const pieSlices = useMemo(
    () => getPieSlices(breakdown, chartTotalPaise, categoryColors),
    [breakdown, categoryColors, chartTotalPaise],
  );
  const selectedCategoryEntries = useMemo(
    () =>
      selectedCategoryName
        ? chartEntries.filter((entry) => entry.categoryName === selectedCategoryName)
        : [],
    [chartEntries, selectedCategoryName],
  );
  const selectedCategoryTotalPaise = selectedCategoryEntries.reduce(
    (sum, entry) => sum + entry.amountPaise,
    0,
  );
  const budgetByCategoryId = useMemo(
    () => new Map(liveData.budgets.map((budget) => [budget.categoryId, budget])),
    [liveData.budgets],
  );
  const budgetByCategoryName = useMemo(
    () => new Map(liveData.budgets.map((budget) => [budget.categoryName, budget])),
    [liveData.budgets],
  );
  const categorySpendById = useMemo(() => {
    const totals = new Map<string, number>();

    visibleEntries.forEach((entry) => {
      const category = liveData.categories.find(
        (item) => item.id === entry.categoryId || item.name === entry.categoryName,
      );
      const key = category?.id ?? entry.categoryId;

      if (key) {
        totals.set(key, (totals.get(key) ?? 0) + entry.amountPaise);
      }
    });

    return totals;
  }, [liveData.categories, visibleEntries]);
  const recentEntries = useMemo(() => {
    const search = expenseSearch.trim().toLocaleLowerCase();
    const selectedFilterCategory = liveData.categories.find(
      (category) => category.id === expenseCategoryFilter,
    );

    return visibleEntries
      .filter((entry) => {
        const matchesSearch =
          !search ||
          entry.description.toLocaleLowerCase().includes(search) ||
          entry.categoryName.toLocaleLowerCase().includes(search) ||
          entry.paidByName.toLocaleLowerCase().includes(search);
        const matchesCategory =
          expenseCategoryFilter === "all" ||
          entry.categoryId === expenseCategoryFilter ||
          entry.categoryName === selectedFilterCategory?.name;
        const matchesPayer =
          expensePayerFilter === "all" || entry.paidByUid === expensePayerFilter;

        return matchesSearch && matchesCategory && matchesPayer;
      })
      .slice(0, 20);
  }, [
    expenseCategoryFilter,
    expensePayerFilter,
    expenseSearch,
    liveData.categories,
    visibleEntries,
  ]);
  const filtersActive = Boolean(
    expenseSearch.trim() || expenseCategoryFilter !== "all" || expensePayerFilter !== "all",
  );

  useEffect(() => {
    if (!expenseDialog) {
      return undefined;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpenseDialog(null);
      }
    };
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [expenseDialog]);

  useEffect(() => {
    if (!selectedCategoryEntries.length) {
      return undefined;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedCategoryName("");
      }
    };
    const isMobilePopup = window.matchMedia("(max-width: 680px)").matches;
    const previousOverflow = document.body.style.overflow;

    if (isMobilePopup) {
      document.body.style.overflow = "hidden";
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);

      if (isMobilePopup) {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [selectedCategoryEntries.length]);

  useEffect(() => {
    if (
      selectedCategoryName &&
      !breakdown.some(([categoryName]) => categoryName === selectedCategoryName)
    ) {
      setSelectedCategoryName("");
    }
  }, [breakdown, selectedCategoryName]);

  const addExpense = async (event: FormEvent) => {
    event.preventDefault();
    const amountPaise = parseRupees(amount);
    const category = liveData.categories.find((item) => item.id === categoryId);
    const paidBy = liveData.members.find((item) => item.id === paidByUid);

    if (amountPaise < 1) {
      setError("Enter an amount greater than ₹0.");
      return;
    }

    if (!description.trim() || !category || !paidBy || !user || !workspace) {
      setError("Complete the amount, description, category, and paid-by fields.");
      return;
    }

    const saved = await runAction(
      "add-expense",
      () =>
        addExpenseEntry({
          workspace,
          amountPaise,
          category,
          description,
          expenseDate,
          paidBy,
          userUid: user.uid,
        }),
      isSharedWorkspace
        ? "Expense added. It is now synced for Sai and Naveen."
        : "Expense added to your private tracker.",
    );

    if (saved) {
      setAmount("");
      setDescription("");
      setExpenseDialog(null);
    }
  };

  const addCategory = async (event: FormEvent) => {
    event.preventDefault();
    const name = newCategory.trim();

    if (!user || !workspace || !name) {
      return;
    }

    if (
      liveData.categories.some(
        (category) => category.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      setError("That category already exists.");
      return;
    }

    await runAction(
      "add-category",
      async () => {
        await addExpenseCategory(workspace, user.uid, name);
        setNewCategory("");
      },
      isSharedWorkspace ? `${name} is ready for both users.` : `${name} is ready for you.`,
    );
  };

  const openBudgets = () => {
    const nextInputs: Record<string, string> = {};

    liveData.categories.forEach((category) => {
      const budget = budgetByCategoryId.get(category.id);
      nextInputs[category.id] = budget ? formatPaiseForInput(budget.monthlyLimitPaise) : "";
    });

    setBudgetInputs(nextInputs);
    setError("");
    setFeedback("");
    setExpenseDialog("budgets");
  };

  const saveBudgets = async (event: FormEvent) => {
    event.preventDefault();

    if (!workspace || !user) {
      return;
    }

    const items = liveData.categories.map((category) => ({
      category,
      monthlyLimitPaise: parseRupees(budgetInputs[category.id] ?? ""),
    }));

    if (items.some((item) => item.monthlyLimitPaise > 1_000_000_000)) {
      setError("Keep each monthly category budget at ₹1 crore or less.");
      return;
    }

    const saved = await runAction(
      "save-budgets",
      () => saveExpenseBudgets(workspace, user.uid, items),
      isSharedWorkspace
        ? "Monthly category budgets updated for Sai and Naveen."
        : "Your monthly category budgets are updated.",
    );

    if (saved) {
      setExpenseDialog(null);
    }
  };

  const startEditingExpense = (entry: ExpenseEntry, returnDialog: "recent" | null = "recent") => {
    const category = liveData.categories.find(
      (item) => item.id === entry.categoryId || item.name === entry.categoryName,
    );
    const payer = liveData.members.find(
      (item) => item.id === entry.paidByUid || item.displayName === entry.paidByName,
    );

    setEditingExpense(entry);
    setEditAmount(formatPaiseForInput(entry.amountPaise));
    setEditDescription(entry.description);
    setEditCategoryId(category?.id ?? liveData.categories[0]?.id ?? "");
    setEditPaidByUid(payer?.id ?? liveData.members[0]?.id ?? "");
    setEditExpenseDate(entry.expenseDate);
    setEditReturnDialog(returnDialog);
    setError("");
    setFeedback("");
    setExpenseDialog("edit");
  };

  const saveEditedExpense = async (event: FormEvent) => {
    event.preventDefault();

    const amountPaise = parseRupees(editAmount);
    const category = liveData.categories.find((item) => item.id === editCategoryId);
    const paidBy = liveData.members.find((item) => item.id === editPaidByUid);

    if (amountPaise < 1) {
      setError("Enter an amount greater than ₹0.");
      return;
    }

    if (
      !editingExpense ||
      !editDescription.trim() ||
      !category ||
      !paidBy ||
      !workspace ||
      !user
    ) {
      setError("Complete the amount, description, category, and paid-by fields.");
      return;
    }

    const saved = await runAction(
      `edit-${editingExpense.id}`,
      () =>
        updateExpenseEntry({
          workspace,
          expenseId: editingExpense.id,
          amountPaise,
          category,
          description: editDescription,
          expenseDate: editExpenseDate,
          paidBy,
          userUid: user.uid,
        }),
      isSharedWorkspace ? "Expense updated for both users." : "Expense updated.",
    );

    if (saved) {
      setEditingExpense(null);
      setExpenseDialog(editReturnDialog);
    }
  };

  const deleteEntry = async (entry: ExpenseEntry) => {
    if (!workspace) {
      return;
    }

    if (!window.confirm(`Delete “${entry.description}” for ${money(entry.amountPaise)}?`)) {
      return;
    }

    const deleted = await runAction(
      `delete-${entry.id}`,
      () => deleteExpenseEntry(workspace, entry.id),
      isSharedWorkspace ? "Expense deleted for both users." : "Expense deleted.",
    );

    if (
      deleted &&
      selectedCategoryName === entry.categoryName &&
      selectedCategoryEntries.length === 1
    ) {
      setSelectedCategoryName("");
    }
  };

  const createInvite = async () => {
    if (!user) {
      return;
    }

    await runAction(
      "create-invite",
      async () => {
        const token = await createExpenseInvite(user.uid);
        const url = `${window.location.origin}/expenses?invite=${encodeURIComponent(token)}`;
        setGeneratedInviteLink(url);

        try {
          await navigator.clipboard?.writeText(url);
        } catch {
          // The link remains visible so it can still be copied manually.
        }
      },
      "Naveen’s private invite link is ready. It expires in 7 days.",
    );
  };

  const copyInvite = async () => {
    if (!generatedInviteLink) {
      return;
    }

    try {
      await navigator.clipboard?.writeText(generatedInviteLink);
      setFeedback("Invite link copied. Send it privately to Naveen.");
    } catch {
      setFeedback("Select the visible link and copy it manually.");
    }
  };

  const createPersonalInvite = async () => {
    if (!user) {
      return;
    }

    await runAction(
      "create-personal-invite",
      async () => {
        const token = await createPersonalExpenseInvite(user.uid);
        const url = `${window.location.origin}/expenses?personalInvite=${encodeURIComponent(token)}`;
        setGeneratedPersonalInviteLink(url);

        try {
          await navigator.clipboard?.writeText(url);
        } catch {
          // The link remains visible so it can still be copied manually.
        }
      },
      "Independent-user invite created. It expires in 7 days.",
    );
  };

  const copyPersonalInvite = async () => {
    if (!generatedPersonalInviteLink) {
      return;
    }

    try {
      await navigator.clipboard?.writeText(generatedPersonalInviteLink);
      setFeedback("Private-user invite copied. Send it only to the intended person.");
    } catch {
      setFeedback("Select the visible private-user link and copy it manually.");
    }
  };

  if (!authReady) {
    return (
      <AccessCard eyebrow="Private household" title="Opening your expense space">
        <p className="expense-access-copy">Checking your Google sign-in securely…</p>
        <div className="expense-loading-bar" aria-label="Loading" />
      </AccessCard>
    );
  }

  if (!isFirebaseConfigured) {
    return (
      <AccessCard eyebrow="One-time setup needed" title="Connect Firebase first">
        <p className="expense-access-copy">
          Add the existing <code>VITE_FIREBASE_*</code> values in Vercel. The tracker never
          stores service-account secrets in the browser.
        </p>
      </AccessCard>
    );
  }

  if (!user) {
    return (
      <AccessCard
        eyebrow={
          personalInviteToken
            ? "Your independent tracker is ready"
            : inviteToken
              ? "Naveen, you have a private invite"
              : "Private expense spaces"
        }
        title={personalInviteToken ? "Start your personal expense tracker" : "Expense Tracker"}
      >
        <p className="expense-access-copy">
          Sign in with Google. Firestore keeps the Sai–Naveen household and every personal
          workspace in completely separate, UID-protected paths.
        </p>
        <button
          className="expense-button expense-button-primary"
          disabled={authBusy}
          onClick={() => void onSignIn()}
          type="button"
        >
          {authBusy ? "Opening Google…" : "Continue with Google"}
        </button>
        {authError ? <p className="expense-message is-error">{authError}</p> : null}
      </AccessCard>
    );
  }

  if (!access) {
    return (
      <AccessCard eyebrow="Signed in" title="Checking household access">
        <p className="expense-access-copy">{user.email}</p>
        <div className="expense-loading-bar" aria-label="Loading" />
      </AccessCard>
    );
  }

  if (!access.householdExists && !access.personalProfile) {
    return (
      <AccessCard eyebrow="First-time setup" title="Create your shared household">
        <p className="expense-access-copy">
          This Google account will become <strong>Sai</strong>, the owner. After setup, create
          one private link for Naveen.
        </p>
        <button
          className="expense-button expense-button-primary"
          disabled={Boolean(busyAction)}
          onClick={() =>
            void runAction(
              "create-household",
              () => createExpenseHousehold(user),
              "Shared household created. You are signed in as Sai.",
            )
          }
          type="button"
        >
          {busyAction === "create-household" ? "Creating securely…" : "Create as Sai"}
        </button>
        {error ? <p className="expense-message is-error">{error}</p> : null}
        {feedback ? <p className="expense-message is-success">{feedback}</p> : null}
      </AccessCard>
    );
  }

  if (!access.member && !access.personalProfile) {
    return (
      <AccessCard
        eyebrow={inviteToken || personalInviteToken ? "Private invitation" : "Account not linked"}
        title={
          personalInviteToken
            ? "Create your independent expense space"
            : inviteToken
              ? "Join Sai as Naveen"
              : "This account needs a private invite"
        }
      >
        <p className="expense-access-copy">
          {personalInviteToken
            ? `You are signed in as ${user.email}. Your expenses will be visible only to this Google account.`
            : inviteToken
              ? `You are signed in as ${user.email}. Confirm to join the shared Firestore space as Naveen.`
              : "Ask Sai for either the Naveen household link or a separate personal-tracker link."}
        </p>
        {personalInviteToken ? (
          <button
            className="expense-button expense-button-primary"
            disabled={Boolean(busyAction)}
            onClick={() =>
              void runAction(
                "join-personal-workspace",
                () => joinPersonalExpenseWorkspace(user, personalInviteToken),
                "Your private expense tracker is ready.",
              )
            }
            type="button"
          >
            {busyAction === "join-personal-workspace"
              ? "Creating securely…"
              : "Create my private tracker"}
          </button>
        ) : null}
        {inviteToken ? (
          <button
            className="expense-button expense-button-primary"
            disabled={Boolean(busyAction)}
            onClick={() =>
              void runAction(
                "join-household",
                () => joinExpenseHousehold(user, inviteToken),
                "Welcome, Naveen. Your shared expenses are now live.",
              )
            }
            type="button"
          >
            {busyAction === "join-household" ? "Joining securely…" : "Join as Naveen"}
          </button>
        ) : null}
        <button
          className="expense-button expense-button-secondary"
          disabled={authBusy}
          onClick={() => void onSignOut()}
          type="button"
        >
          Switch Google account
        </button>
        {error ? <p className="expense-message is-error">{error}</p> : null}
      </AccessCard>
    );
  }

  if (!dataReady) {
    return (
      <AccessCard eyebrow={`Welcome, ${currentMember?.displayName}`} title="Syncing live expenses">
        <p className="expense-access-copy">
          Loading your {isSharedWorkspace ? "shared" : "private"} Firestore dashboard…
        </p>
        <div className="expense-loading-bar" aria-label="Loading" />
      </AccessCard>
    );
  }

  if (!workspace || !currentMember) {
    return null;
  }

  const activeCategory =
    liveData.categories.find((category) => category.id === categoryId) ??
    liveData.categories[0];
  const activePayer =
    liveData.members.find((member) => member.id === paidByUid) ?? liveData.members[0];

  const addExpenseContent = (
    <div className="expense-modal-content">
      {error ? <p className="expense-message is-error">{error}</p> : null}
      {feedback ? <p className="expense-message is-success">{feedback}</p> : null}
      <form className="expense-form" onSubmit={(event) => void addExpense(event)}>
        {!liveData.categories.length ? (
          <button
            className="expense-button expense-button-secondary expense-field-wide"
            disabled={Boolean(busyAction)}
            onClick={() =>
              void runAction(
                "restore-categories",
                () => ensureDefaultExpenseCategories(workspace, user.uid),
                isSharedWorkspace
                  ? "Standard categories restored for both users."
                  : "Standard categories restored for your private tracker.",
              )
            }
            type="button"
          >
            {busyAction === "restore-categories" ? "Restoring…" : "Restore standard categories"}
          </button>
        ) : null}
        <label>
          Amount
          <div className="expense-amount-field">
            <span>₹</span>
            <input
              inputMode="decimal"
              onChange={(event) => setAmount(formatRupeeInput(event.target.value))}
              placeholder="350"
              required
              value={amount}
            />
          </div>
        </label>
        <label>
          Date
          <input
            max={today()}
            onChange={(event) => setExpenseDate(event.target.value)}
            required
            type="date"
            value={expenseDate}
          />
        </label>
        <label className="expense-field-wide">
          Description
          <input
            maxLength={80}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Lunch"
            required
            value={description}
          />
        </label>
        <label>
          Category
          <select
            onChange={(event) => setCategoryId(event.target.value)}
            value={activeCategory?.id ?? ""}
          >
            {liveData.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Paid by
          <select
            onChange={(event) => setPaidByUid(event.target.value)}
            value={activePayer?.id ?? ""}
          >
            {liveData.members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </select>
        </label>
        <button
          className="expense-button expense-button-primary expense-field-wide expense-submit-button"
          disabled={Boolean(busyAction) || !activeCategory || !activePayer}
          type="submit"
        >
          {busyAction === "add-expense" ? "Saving to Firestore…" : "Add expense"}
        </button>
      </form>
      <form className="expense-category-form" onSubmit={(event) => void addCategory(event)}>
        <label>
          Need your own category?
          <input
            maxLength={40}
            onChange={(event) => setNewCategory(event.target.value)}
            placeholder="Pet Care"
            value={newCategory}
          />
        </label>
        <button
          className="expense-button expense-button-secondary"
          disabled={busyAction === "add-category"}
          type="submit"
        >
          {busyAction === "add-category" ? "Creating…" : "Create category"}
        </button>
      </form>
    </div>
  );

  const editExpenseContent = editingExpense ? (
    <div className="expense-modal-content">
      {error ? <p className="expense-message is-error">{error}</p> : null}
      <form className="expense-form" onSubmit={(event) => void saveEditedExpense(event)}>
        <label>
          Amount
          <div className="expense-amount-field">
            <span>₹</span>
            <input
              inputMode="decimal"
              onChange={(event) => setEditAmount(formatRupeeInput(event.target.value))}
              required
              value={editAmount}
            />
          </div>
        </label>
        <label>
          Date
          <input
            max={today()}
            onChange={(event) => setEditExpenseDate(event.target.value)}
            required
            type="date"
            value={editExpenseDate}
          />
        </label>
        <label className="expense-field-wide">
          Description
          <input
            maxLength={80}
            onChange={(event) => setEditDescription(event.target.value)}
            required
            value={editDescription}
          />
        </label>
        <label>
          Category
          <select
            onChange={(event) => setEditCategoryId(event.target.value)}
            value={editCategoryId}
          >
            {liveData.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Paid by
          <select
            onChange={(event) => setEditPaidByUid(event.target.value)}
            value={editPaidByUid}
          >
            {liveData.members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </select>
        </label>
        <button
          className="expense-button expense-button-primary expense-field-wide expense-submit-button"
          disabled={busyAction === `edit-${editingExpense.id}`}
          type="submit"
        >
          {busyAction === `edit-${editingExpense.id}` ? "Saving changes…" : "Save changes"}
        </button>
      </form>
    </div>
  ) : null;

  const budgetContent = (
    <div className="expense-modal-content">
      {error ? <p className="expense-message is-error">{error}</p> : null}
      <p className="expense-budget-intro">
        Set a recurring monthly limit for any category. Leave an amount blank to remove its
        budget.
      </p>
      {liveData.categories.length ? (
        <form className="expense-budget-form" onSubmit={(event) => void saveBudgets(event)}>
          <div className="expense-budget-list">
            {liveData.categories.map((category) => {
              const spentPaise = categorySpendById.get(category.id) ?? 0;
              const enteredLimitPaise = parseRupees(budgetInputs[category.id] ?? "");
              const previewLimitPaise = enteredLimitPaise;
              const usedPercent = previewLimitPaise
                ? Math.min((spentPaise / previewLimitPaise) * 100, 100)
                : 0;
              const isOverBudget = previewLimitPaise > 0 && spentPaise > previewLimitPaise;

              return (
                <label className="expense-budget-row" key={category.id}>
                  <span className="expense-budget-row-heading">
                    <strong>{category.name}</strong>
                    <small>
                      {money(spentPaise)} spent in {monthLabel(selectedMonth)}
                    </small>
                  </span>
                  <span className="expense-amount-field expense-budget-input">
                    <span>₹</span>
                    <input
                      aria-label={`${category.name} monthly budget`}
                      inputMode="decimal"
                      onChange={(event) =>
                        setBudgetInputs((current) => ({
                          ...current,
                          [category.id]: formatRupeeInput(event.target.value),
                        }))
                      }
                      placeholder="No limit"
                      value={budgetInputs[category.id] ?? ""}
                    />
                  </span>
                  {previewLimitPaise ? (
                    <span className={`expense-budget-progress${isOverBudget ? " is-over" : ""}`}>
                      <i style={{ width: `${usedPercent}%` }} />
                    </span>
                  ) : null}
                  <small className={isOverBudget ? "expense-budget-status is-over" : "expense-budget-status"}>
                    {previewLimitPaise
                      ? isOverBudget
                        ? `${money(spentPaise - previewLimitPaise)} over budget`
                        : `${percentage(spentPaise, previewLimitPaise)}% used`
                      : "No monthly limit"}
                  </small>
                </label>
              );
            })}
          </div>
          <button
            className="expense-button expense-button-primary expense-submit-button"
            disabled={busyAction === "save-budgets"}
            type="submit"
          >
            {busyAction === "save-budgets" ? "Saving budgets…" : "Save monthly budgets"}
          </button>
        </form>
      ) : (
        <div className="expense-empty-state is-compact">
          <h3>Create a category first</h3>
          <p>Budgets become available as soon as your first expense category exists.</p>
        </div>
      )}
    </div>
  );

  const recentExpenseContent = (
    <div className="expense-modal-content">
      {error ? <p className="expense-message is-error">{error}</p> : null}
      {feedback ? <p className="expense-message is-success">{feedback}</p> : null}
      <div className="expense-recent-filters" aria-label="Filter recent expenses">
        <label className="expense-search-field">
          Search
          <input
            onChange={(event) => setExpenseSearch(event.target.value)}
            placeholder="Description, category, or payer"
            type="search"
            value={expenseSearch}
          />
        </label>
        <label>
          Category
          <select
            onChange={(event) => setExpenseCategoryFilter(event.target.value)}
            value={expenseCategoryFilter}
          >
            <option value="all">All categories</option>
            {liveData.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Paid by
          <select
            onChange={(event) => setExpensePayerFilter(event.target.value)}
            value={expensePayerFilter}
          >
            <option value="all">All payers</option>
            {liveData.members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </select>
        </label>
        <button
          className="expense-button expense-button-secondary expense-filter-reset"
          disabled={!filtersActive}
          onClick={() => {
            setExpenseSearch("");
            setExpenseCategoryFilter("all");
            setExpensePayerFilter("all");
          }}
          type="button"
        >
          Reset
        </button>
      </div>
      {recentEntries.length ? (
        <div className="expense-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Category</th>
                <th>Paid by</th>
                <th>Date</th>
                <th>Amount</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {recentEntries.map((entry) => (
                <tr key={entry.id}>
                  <td data-label="Description">
                    <strong>{entry.description}</strong>
                  </td>
                  <td data-label="Category">
                    <span className="expense-category-chip">{entry.categoryName}</span>
                  </td>
                  <td data-label="Paid by">{entry.paidByName}</td>
                  <td data-label="Date">
                    {new Intl.DateTimeFormat("en-IN", {
                      day: "numeric",
                      month: "short",
                    }).format(new Date(`${entry.expenseDate}T00:00:00`))}
                  </td>
                  <td data-label="Amount">
                    <strong>{money(entry.amountPaise)}</strong>
                  </td>
                  <td className="expense-row-action">
                    <button
                      aria-label={`Edit ${entry.description}`}
                      onClick={() => startEditingExpense(entry)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      aria-label={`Delete ${entry.description}`}
                      disabled={busyAction === `delete-${entry.id}`}
                      onClick={() => void deleteEntry(entry)}
                      type="button"
                    >
                      {busyAction === `delete-${entry.id}` ? "…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="expense-empty-state is-compact">
          <h3>{filtersActive ? "No matching expenses" : "No expenses for this month"}</h3>
          <p>
            {filtersActive
              ? "Try a different search or reset the filters."
              : "Close this view and use + Add expense to create the first entry."}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="expense-page-shell">
      <main className="expense-page">
        <header className="expense-topbar">
          <div className="expense-title-group">
            <div className="expense-brand-mark" aria-hidden="true">
              {isSharedWorkspace ? "S" : currentMember.displayName.slice(0, 1).toUpperCase()}
              <span>{isSharedWorkspace ? "N" : "P"}</span>
            </div>
            <div>
              <div className="expense-live-line">
                <span className="expense-live-dot" />
                Live on Firestore
              </div>
              <h1>
                {isSharedWorkspace ? "Sai & Naveen" : `${currentMember.displayName}'s Expenses`}
              </h1>
              <p>
                Signed in as {currentMember.displayName} · {user.email}
              </p>
            </div>
          </div>
          <div className="expense-topbar-actions">
            <button
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              className="expense-icon-button"
              onClick={onThemeToggle}
              type="button"
            >
              {theme === "light" ? "☾" : "☀"}
            </button>
            <button
              className="expense-button expense-button-secondary"
              disabled={authBusy}
              onClick={() => void onSignOut()}
              type="button"
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="expense-period-bar">
          <div>
            <p className="expense-eyebrow">
              {isSharedWorkspace ? "Household overview" : "Personal overview"}
            </p>
            <h2>{monthLabel(selectedMonth)}</h2>
          </div>
          <div className="expense-period-actions">
            <label className="expense-month-control">
              View month
              <input
                max={currentMonth()}
                onChange={(event) => setSelectedMonth(event.target.value)}
                type="month"
                value={selectedMonth}
              />
            </label>
            <button
              className="expense-period-action expense-add-trigger"
              onClick={() => {
                setError("");
                setFeedback("");
                setExpenseDialog("add");
              }}
              type="button"
            >
              <span aria-hidden="true">+</span>
              <strong>Add expense</strong>
            </button>
            <button
              className="expense-period-action"
              onClick={openBudgets}
              type="button"
            >
              <span aria-hidden="true">₹</span>
              <strong>Budgets</strong>
            </button>
            <button
              className="expense-period-action"
              onClick={() => setExpenseDialog("recent")}
              type="button"
            >
              <span aria-hidden="true">↻</span>
              <strong>Recent</strong>
            </button>
          </div>
        </section>

        <section className="expense-summary-grid" aria-label="Monthly expense summary">
          <article>
            <span>Total spent</span>
            <strong>{money(totalPaise)}</strong>
            <small>
              {visibleEntries.length} {isSharedWorkspace ? "shared" : "private"} expenses
            </small>
          </article>
          {isSharedWorkspace ? (
            <>
              <article>
                <span>Sai paid</span>
                <strong>{money(saiPaidPaise)}</strong>
                <small>{percentage(saiPaidPaise, totalPaise)}% of total</small>
              </article>
              <article>
                <span>Naveen paid</span>
                <strong>{money(naveenPaidPaise)}</strong>
                <small>{percentage(naveenPaidPaise, totalPaise)}% of total</small>
              </article>
            </>
          ) : (
            <>
              <article>
                <span>Average expense</span>
                <strong>{money(averageExpensePaise)}</strong>
                <small>Based on this month</small>
              </article>
              <article>
                <span>Top category</span>
                <strong>{topCategory?.[0] ?? "No spending"}</strong>
                <small>
                  {topCategory ? `${percentage(topCategory[1], totalPaise)}% of total` : "Add an expense to begin"}
                </small>
              </article>
            </>
          )}
        </section>

        {access.member?.role === "owner" && liveData.members.length < 2 ? (
          <section className="expense-invite-banner">
            <div>
              <p className="expense-eyebrow">Connect user 2</p>
              <h2>Invite Naveen to this live dashboard</h2>
              <p>One private link, one Google account, valid for seven days.</p>
            </div>
            <div className="expense-invite-actions">
              {generatedInviteLink ? (
                <button
                  className="expense-button expense-button-secondary"
                  onClick={() => void copyInvite()}
                  type="button"
                >
                  Copy invite link
                </button>
              ) : null}
              <button
                className="expense-button expense-button-primary"
                disabled={Boolean(busyAction)}
                onClick={() => void createInvite()}
                type="button"
              >
                {busyAction === "create-invite" ? "Creating…" : "Create new invite"}
              </button>
            </div>
            {generatedInviteLink ? (
              <label className="expense-invite-link">
                Private link
                <input
                  onFocus={(event) => event.currentTarget.select()}
                  readOnly
                  value={generatedInviteLink}
                />
              </label>
            ) : null}
          </section>
        ) : null}

        {error ? <p className="expense-message is-error">{error}</p> : null}
        {feedback ? <p className="expense-message is-success">{feedback}</p> : null}

        <div className="expense-main-grid is-visual-only">
          <section className="expense-panel expense-visual-panel">
            <div className="expense-panel-heading">
              <div>
                <p className="expense-eyebrow">Visual breakdown</p>
                <h2>Where the money went</h2>
              </div>
              <span>{breakdown.length} categories</span>
            </div>
            {isSharedWorkspace ? (
              <div className="expense-spend-toggle" role="group" aria-label="Choose spending view">
                {([
                  ["all", "Household"],
                  ["Sai", "Sai spent"],
                  ["Naveen", "Naveen spent"],
                ] as const).map(([value, label]) => (
                  <button
                    aria-pressed={spendView === value}
                    className={spendView === value ? "is-active" : ""}
                    key={value}
                    onClick={() => setSpendView(value)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="expense-private-view-note">
                <span className="expense-live-dot" /> Only your Google account can see this data
              </div>
            )}
            {breakdown.length ? (
              <div className="expense-chart-layout">
                <div className="expense-pie-visual">
                  <svg
                    aria-label={`${chartViewLabel} category spending pie chart for ${monthLabel(selectedMonth)}`}
                    className="expense-pie-chart"
                    role="img"
                    shapeRendering="geometricPrecision"
                    viewBox="0 0 100 100"
                  >
                    <circle className="expense-pie-surface" cx="50" cy="50" r="46.5" />
                    {pieSlices.map((slice) =>
                      slice.fullCircle ? (
                        <circle
                          className="expense-pie-slice"
                          cx="50"
                          cy="50"
                          fill={slice.color}
                          key={slice.name}
                          r="46.5"
                        />
                      ) : (
                        <path
                          className="expense-pie-slice"
                          d={slice.path}
                          fill={slice.color}
                          key={slice.name}
                        />
                      ),
                    )}
                    <circle className="expense-pie-outline" cx="50" cy="50" r="46.5" />
                  </svg>
                  <div className="expense-pie-caption">
                    <span>{chartViewLabel} total</span>
                    <strong>{money(chartTotalPaise)}</strong>
                    <small>{chartEntries.length} expenses</small>
                  </div>
                </div>
                <div className="expense-category-bars">
                  {breakdown.map(([name, value]) => {
                    const budget =
                      !isSharedWorkspace || spendView === "all"
                        ? budgetByCategoryName.get(name)
                        : undefined;
                    const budgetUsed = budget
                      ? Math.min((value / budget.monthlyLimitPaise) * 100, 100)
                      : 0;
                    const isOverBudget = Boolean(budget && value > budget.monthlyLimitPaise);

                    return (
                      <button
                      aria-controls="expense-category-details"
                      aria-expanded={selectedCategoryName === name}
                      className={`expense-category-row${
                        selectedCategoryName === name ? " is-active" : ""
                      }`}
                      key={name}
                      onClick={() =>
                        setSelectedCategoryName((current) => (current === name ? "" : name))
                      }
                      type="button"
                    >
                      <div className="expense-category-label">
                        <span className="expense-category-name">
                          <i
                            className="expense-category-dot"
                            style={{ background: categoryColors.get(name) }}
                          />
                          {name}
                        </span>
                        <strong>{money(value)}</strong>
                      </div>
                      <div
                        className={`expense-bar-track${budget ? " has-budget" : ""}${
                          isOverBudget ? " is-over" : ""
                        }`}
                      >
                        <i
                          style={{
                            background: categoryColors.get(name),
                            width: `${Math.max(
                              budget
                                ? budgetUsed
                                : (value / highestCategoryValue) * 100,
                              3,
                            )}%`,
                          }}
                        />
                      </div>
                      <small>
                        {budget
                          ? isOverBudget
                            ? `${percentage(value, budget.monthlyLimitPaise)}% · over`
                            : `${percentage(value, budget.monthlyLimitPaise)}% of budget`
                          : `${percentage(value, chartTotalPaise)}%`}
                      </small>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="expense-empty-state">
                <span>◔</span>
                <h3>No {chartViewLabel.toLowerCase()} spending in {monthLabel(selectedMonth)}</h3>
                <p>
                  {!isSharedWorkspace || spendView === "all"
                    ? "Add the first expense and the visual summary appears here instantly."
                    : `No expenses paid by ${spendView} in this month.`}
                </p>
              </div>
            )}
            {breakdown.length && !selectedCategoryEntries.length ? (
              <p className="expense-category-click-hint">
                Select a category to see its expense descriptions and amounts.
              </p>
            ) : null}
            {selectedCategoryEntries.length ? (
              <section
                aria-label={`${selectedCategoryName} expense details`}
                aria-live="polite"
                className="expense-category-detail"
                id="expense-category-details"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setSelectedCategoryName("");
                  }
                }}
                role="dialog"
              >
                <div className="expense-category-detail-sheet">
                  <div className="expense-category-detail-heading">
                    <div>
                      <p className="expense-eyebrow">Category details</p>
                      <h3>{selectedCategoryName}</h3>
                      <p>
                        {chartViewLabel} · {selectedCategoryEntries.length} expenses · {money(selectedCategoryTotalPaise)}
                      </p>
                    </div>
                    <button
                      aria-label="Close category details"
                      onClick={() => setSelectedCategoryName("")}
                      type="button"
                    >
                      <span aria-hidden="true">×</span>
                      Close
                    </button>
                  </div>
                  <div className="expense-table-wrap expense-category-detail-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Date</th>
                          <th>Paid by</th>
                          <th>Amount</th>
                          <th aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCategoryEntries.map((entry) => (
                          <tr key={entry.id}>
                            <td data-label="Description">
                              <strong>{entry.description}</strong>
                            </td>
                            <td data-label="Date">
                              {new Intl.DateTimeFormat("en-IN", {
                                day: "numeric",
                                month: "short",
                              }).format(new Date(`${entry.expenseDate}T00:00:00`))}
                            </td>
                            <td data-label="Paid by">{entry.paidByName}</td>
                            <td data-label="Amount">
                              <strong>{money(entry.amountPaise)}</strong>
                            </td>
                            <td className="expense-row-action" data-label="Actions">
                              <button
                                aria-label={`Edit ${entry.description}`}
                                onClick={() => startEditingExpense(entry, null)}
                                type="button"
                              >
                                Edit
                              </button>
                              <button
                                aria-label={`Delete ${entry.description}`}
                                disabled={busyAction === `delete-${entry.id}`}
                                onClick={() => void deleteEntry(entry)}
                                type="button"
                              >
                                {busyAction === `delete-${entry.id}` ? "Deleting…" : "Delete"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ) : null}
          </section>

        </div>

        {expenseDialog === "add" ? (
          <section
            aria-labelledby="expense-add-dialog-title"
            aria-modal="true"
            className="expense-modal-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setExpenseDialog(null);
              }
            }}
            role="dialog"
          >
            <div className="expense-modal-sheet expense-add-modal">
              <header className="expense-modal-header">
                <div>
                  <p className="expense-eyebrow">
                    {isSharedWorkspace ? "New shared entry" : "New private entry"}
                  </p>
                  <h2 id="expense-add-dialog-title">Add expense</h2>
                  <p>
                    {monthLabel(expenseDate.slice(0, 7))} ·{" "}
                    {isSharedWorkspace ? "synced for both users" : "private to your account"}
                  </p>
                </div>
                <button
                  aria-label="Close add expense dialog"
                  className="expense-modal-close"
                  onClick={() => setExpenseDialog(null)}
                  type="button"
                >
                  <span aria-hidden="true">×</span>
                  Close
                </button>
              </header>
              {addExpenseContent}
            </div>
          </section>
        ) : null}

        {expenseDialog === "budgets" ? (
          <section
            aria-labelledby="expense-budget-dialog-title"
            aria-modal="true"
            className="expense-modal-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setExpenseDialog(null);
              }
            }}
            role="dialog"
          >
            <div className="expense-modal-sheet expense-budget-modal">
              <header className="expense-modal-header">
                <div>
                  <p className="expense-eyebrow">Monthly guardrails</p>
                  <h2 id="expense-budget-dialog-title">Category budgets</h2>
                  <p>{monthLabel(selectedMonth)} spending shown against recurring limits</p>
                </div>
                <button
                  aria-label="Close category budgets dialog"
                  className="expense-modal-close"
                  onClick={() => setExpenseDialog(null)}
                  type="button"
                >
                  <span aria-hidden="true">×</span>
                  Close
                </button>
              </header>
              {budgetContent}
            </div>
          </section>
        ) : null}

        {expenseDialog === "edit" && editingExpense ? (
          <section
            aria-labelledby="expense-edit-dialog-title"
            aria-modal="true"
            className="expense-modal-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setExpenseDialog(editReturnDialog);
              }
            }}
            role="dialog"
          >
            <div className="expense-modal-sheet expense-edit-modal">
              <header className="expense-modal-header">
                <div>
                  <p className="expense-eyebrow">Correct an entry</p>
                  <h2 id="expense-edit-dialog-title">Edit expense</h2>
                  <p>Changes sync immediately after you save</p>
                </div>
                <button
                  aria-label="Cancel editing expense"
                  className="expense-modal-close"
                  onClick={() => setExpenseDialog(editReturnDialog)}
                  type="button"
                >
                  <span aria-hidden="true">×</span>
                  Cancel
                </button>
              </header>
              {editExpenseContent}
            </div>
          </section>
        ) : null}

        {expenseDialog === "recent" ? (
          <section
            aria-labelledby="expense-recent-dialog-title"
            aria-modal="true"
            className="expense-modal-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setExpenseDialog(null);
              }
            }}
            role="dialog"
          >
            <div className="expense-modal-sheet expense-recent-modal">
              <header className="expense-modal-header">
                <div>
                  <p className="expense-eyebrow">
                    {isSharedWorkspace ? "Shared activity" : "Private activity"}
                  </p>
                  <h2 id="expense-recent-dialog-title">Recent expenses</h2>
                  <p>Search, filter, edit, or delete · {monthLabel(selectedMonth)}</p>
                </div>
                <button
                  aria-label="Close recent expenses dialog"
                  className="expense-modal-close"
                  onClick={() => setExpenseDialog(null)}
                  type="button"
                >
                  <span aria-hidden="true">×</span>
                  Close
                </button>
              </header>
              {recentExpenseContent}
            </div>
          </section>
        ) : null}

        {expenseDialog === "invite" && access.member?.role === "owner" ? (
          <section
            aria-labelledby="expense-invite-dialog-title"
            aria-modal="true"
            className="expense-modal-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setExpenseDialog(null);
              }
            }}
            role="dialog"
          >
            <div className="expense-modal-sheet expense-invite-modal">
              <header className="expense-modal-header">
                <div>
                  <p className="expense-eyebrow">Independent user</p>
                  <h2 id="expense-invite-dialog-title">Personal tracker invite</h2>
                  <p>One-time link · valid for 7 days</p>
                </div>
                <button
                  aria-label="Close personal invite dialog"
                  className="expense-modal-close"
                  onClick={() => setExpenseDialog(null)}
                  type="button"
                >
                  <span aria-hidden="true">×</span>
                  Close
                </button>
              </header>
              <div className="expense-modal-content expense-invite-modal-content">
                <p className="expense-invite-explanation">
                  The invited user gets a separate UID-protected dashboard. Their expenses never
                  appear in the Sai–Naveen household.
                </p>
                {error ? <p className="expense-message is-error">{error}</p> : null}
                {feedback ? <p className="expense-message is-success">{feedback}</p> : null}
                <div className="expense-invite-modal-actions">
                  <button
                    className="expense-button expense-button-primary"
                    disabled={Boolean(busyAction)}
                    onClick={() => void createPersonalInvite()}
                    type="button"
                  >
                    {busyAction === "create-personal-invite"
                      ? "Creating…"
                      : "Create personal invite"}
                  </button>
                  {generatedPersonalInviteLink ? (
                    <button
                      className="expense-button expense-button-secondary"
                      onClick={() => void copyPersonalInvite()}
                      type="button"
                    >
                      Copy invite link
                    </button>
                  ) : null}
                </div>
                {generatedPersonalInviteLink ? (
                  <label className="expense-invite-link expense-invite-modal-link">
                    Private link
                    <input
                      onFocus={(event) => event.currentTarget.select()}
                      readOnly
                      value={generatedPersonalInviteLink}
                    />
                  </label>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <footer className="expense-footer">
          <span>
            <i className="expense-live-dot" /> Firestore real-time sync
          </span>
          <div className="expense-footer-end">
            <span>
              {isSharedWorkspace
                ? "Private to Sai and Naveen"
                : `Private to ${currentMember.displayName}`}
            </span>
            {access.member?.role === "owner" ? (
              <button
                className="expense-footer-invite"
                onClick={() => {
                  setError("");
                  setFeedback("");
                  setExpenseDialog("invite");
                }}
                type="button"
              >
                Invite
              </button>
            ) : null}
          </div>
        </footer>
      </main>
    </div>
  );
}
