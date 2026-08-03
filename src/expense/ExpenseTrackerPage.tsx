import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { isFirebaseConfigured } from "../lib/firebase";
import {
  addExpenseCategory,
  addExpenseEntry,
  createExpenseHousehold,
  createExpenseInvite,
  deleteExpenseEntry,
  ensureDefaultExpenseCategories,
  joinExpenseHousehold,
  subscribeToExpenseAccess,
  subscribeToExpenseData,
  type ExpenseAccessState,
  type ExpenseCategory,
  type ExpenseEntry,
  type ExpenseLiveData,
  type ExpenseMember,
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

const EXPENSE_CHART_COLORS = [
  "#7a6ff0",
  "#ef8a5d",
  "#36b993",
  "#e05f91",
  "#e6b94e",
  "#4f9fed",
] as const;

const EMPTY_LIVE_DATA: ExpenseLiveData = {
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

function getPieChartGradient(breakdown: Array<[string, number]>, totalPaise: number) {
  if (!breakdown.length || totalPaise <= 0) {
    return "var(--panel-border)";
  }

  let currentPercentage = 0;
  const segments = breakdown.map(([, value], index) => {
    const startPercentage = currentPercentage;
    currentPercentage += (value / totalPaise) * 100;
    const color = EXPENSE_CHART_COLORS[index % EXPENSE_CHART_COLORS.length];

    return `${color} ${startPercentage.toFixed(2)}% ${currentPercentage.toFixed(2)}%`;
  });

  return `conic-gradient(${segments.join(", ")})`;
}

function getInviteToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("invite")?.trim() ?? "";
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
        <a className="expense-text-link" href="/">
          Back to portfolio
        </a>
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
  const [access, setAccess] = useState<ExpenseAccessState | null>(null);
  const [liveData, setLiveData] = useState<ExpenseLiveData>(EMPTY_LIVE_DATA);
  const [dataReady, setDataReady] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState("");
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
    if (!access?.member) {
      return undefined;
    }

    return subscribeToExpenseData(
      (nextData) => {
        setLiveData(nextData);
        setDataReady(true);
      },
      (nextError) => setError(getErrorMessage(nextError)),
    );
  }, [access?.member?.id]);

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
        liveData.members.find((member) => member.id === access?.member?.id)?.id ??
          liveData.members[0].id,
      );
    }
  }, [access?.member?.id, liveData.members, paidByUid]);

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
      spendView === "all"
        ? visibleEntries
        : visibleEntries.filter((entry) => entry.paidByName === spendView),
    [spendView, visibleEntries],
  );
  const chartTotalPaise = chartEntries.reduce((sum, entry) => sum + entry.amountPaise, 0);

  const breakdown = useMemo(() => {
    const totals = new Map<string, number>();
    chartEntries.forEach((entry) => {
      totals.set(entry.categoryName, (totals.get(entry.categoryName) ?? 0) + entry.amountPaise);
    });

    return [...totals].sort((left, right) => right[1] - left[1]);
  }, [chartEntries]);
  const highestCategoryValue = Math.max(...breakdown.map(([, value]) => value), 1);
  const chartViewLabel = spendView === "all" ? "Household" : spendView;
  const pieChartGradient = useMemo(
    () => getPieChartGradient(breakdown, chartTotalPaise),
    [breakdown, chartTotalPaise],
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

  const addExpense = async (event: FormEvent) => {
    event.preventDefault();
    const amountPaise = parseRupees(amount);
    const category = liveData.categories.find((item) => item.id === categoryId);
    const paidBy = liveData.members.find((item) => item.id === paidByUid);

    if (amountPaise < 1) {
      setError("Enter an amount greater than ₹0.");
      return;
    }

    if (!description.trim() || !category || !paidBy || !user) {
      setError("Complete the amount, description, category, and paid-by fields.");
      return;
    }

    const saved = await runAction(
      "add-expense",
      () =>
        addExpenseEntry({
          amountPaise,
          category,
          description,
          expenseDate,
          paidBy,
          userUid: user.uid,
        }),
      "Expense added. It is now synced for Sai and Naveen.",
    );

    if (saved) {
      setAmount("");
      setDescription("");
    }
  };

  const addCategory = async (event: FormEvent) => {
    event.preventDefault();
    const name = newCategory.trim();

    if (!user || !name) {
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
        await addExpenseCategory(user.uid, name);
        setNewCategory("");
      },
      `${name} is ready for both users.`,
    );
  };

  const deleteEntry = async (entry: ExpenseEntry) => {
    if (!window.confirm(`Delete “${entry.description}” for ${money(entry.amountPaise)}?`)) {
      return;
    }

    await runAction(
      `delete-${entry.id}`,
      () => deleteExpenseEntry(entry.id),
      "Expense deleted for both users.",
    );
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
        eyebrow={inviteToken ? "Naveen, you have a private invite" : "Private household"}
        title="Sai & Naveen Expense Tracker"
      >
        <p className="expense-access-copy">
          Sign in with Google. Only the two household member accounts can read or change this
          Firestore data.
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

  if (!access.householdExists) {
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

  if (!access.member) {
    return (
      <AccessCard
        eyebrow={inviteToken ? "Private invitation" : "Account not linked"}
        title={inviteToken ? "Join Sai as Naveen" : "This is a private two-user tracker"}
      >
        <p className="expense-access-copy">
          {inviteToken
            ? `You are signed in as ${user.email}. Confirm to join the shared Firestore space as Naveen.`
            : "This Google account is not a household member. Ask Sai for the latest private invite link."}
        </p>
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
      <AccessCard eyebrow={`Welcome, ${access.member.displayName}`} title="Syncing live expenses">
        <p className="expense-access-copy">Loading the shared Firestore dashboard…</p>
        <div className="expense-loading-bar" aria-label="Loading" />
      </AccessCard>
    );
  }

  const activeCategory =
    liveData.categories.find((category) => category.id === categoryId) ??
    liveData.categories[0];
  const activePayer =
    liveData.members.find((member) => member.id === paidByUid) ?? liveData.members[0];

  return (
    <div className="expense-page-shell">
      <main className="expense-page">
        <header className="expense-topbar">
          <div className="expense-title-group">
            <div className="expense-brand-mark" aria-hidden="true">
              S<span>N</span>
            </div>
            <div>
              <div className="expense-live-line">
                <span className="expense-live-dot" />
                Live on Firestore
              </div>
              <h1>Sai & Naveen</h1>
              <p>
                Signed in as {access.member.displayName} · {user.email}
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
            <a className="expense-button expense-button-secondary" href="/">
              Portfolio
            </a>
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
            <p className="expense-eyebrow">Household overview</p>
            <h2>{monthLabel(selectedMonth)}</h2>
          </div>
          <label>
            View month
            <input
              max={currentMonth()}
              onChange={(event) => setSelectedMonth(event.target.value)}
              type="month"
              value={selectedMonth}
            />
          </label>
        </section>

        <section className="expense-summary-grid" aria-label="Monthly expense summary">
          <article>
            <span>Total spent</span>
            <strong>{money(totalPaise)}</strong>
            <small>{visibleEntries.length} shared expenses</small>
          </article>
          <article>
            <span>Sai paid</span>
            <strong>{money(saiPaidPaise)}</strong>
            <small>{totalPaise ? Math.round((saiPaidPaise / totalPaise) * 100) : 0}% of total</small>
          </article>
          <article>
            <span>Naveen paid</span>
            <strong>{money(naveenPaidPaise)}</strong>
            <small>
              {totalPaise ? Math.round((naveenPaidPaise / totalPaise) * 100) : 0}% of total
            </small>
          </article>
        </section>

        {access.member.role === "owner" && liveData.members.length < 2 ? (
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

        <div className="expense-main-grid">
          <section className="expense-panel expense-visual-panel">
            <div className="expense-panel-heading">
              <div>
                <p className="expense-eyebrow">Visual breakdown</p>
                <h2>Where the money went</h2>
              </div>
              <span>{breakdown.length} categories</span>
            </div>
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
            {breakdown.length ? (
              <div className="expense-chart-layout">
                <div className="expense-pie-visual">
                  <div
                    aria-label={`${chartViewLabel} category spending pie chart for ${monthLabel(selectedMonth)}`}
                    className="expense-pie-chart"
                    role="img"
                    style={{ background: pieChartGradient }}
                  />
                  <div className="expense-pie-caption">
                    <span>{chartViewLabel} total</span>
                    <strong>{money(chartTotalPaise)}</strong>
                    <small>{chartEntries.length} expenses</small>
                  </div>
                </div>
                <div className="expense-category-bars">
                  {breakdown.map(([name, value], index) => (
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
                          <i className={`expense-category-dot expense-bar-tone-${(index % 6) + 1}`} />
                          {name}
                        </span>
                        <strong>{money(value)}</strong>
                      </div>
                      <div className="expense-bar-track">
                        <i
                          className={`expense-bar-tone-${(index % 6) + 1}`}
                          style={{ width: `${Math.max((value / highestCategoryValue) * 100, 3)}%` }}
                        />
                      </div>
                      <small>
                        {chartTotalPaise
                          ? Math.round((value / chartTotalPaise) * 100)
                          : 0}
                        %
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="expense-empty-state">
                <span>◔</span>
                <h3>No {chartViewLabel.toLowerCase()} spending in {monthLabel(selectedMonth)}</h3>
                <p>
                  {spendView === "all"
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
                aria-live="polite"
                className="expense-category-detail"
                id="expense-category-details"
              >
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </section>

          <section className="expense-panel">
            <div className="expense-panel-heading">
              <div>
                <p className="expense-eyebrow">Quick entry</p>
                <h2>Add expense</h2>
              </div>
            </div>
            <form className="expense-form" onSubmit={(event) => void addExpense(event)}>
              {!liveData.categories.length ? (
                <button
                  className="expense-button expense-button-secondary expense-field-wide"
                  disabled={Boolean(busyAction)}
                  onClick={() =>
                    void runAction(
                      "restore-categories",
                      () => ensureDefaultExpenseCategories(user.uid),
                      "Standard categories restored for both users.",
                    )
                  }
                  type="button"
                >
                  {busyAction === "restore-categories"
                    ? "Restoring…"
                    : "Restore standard categories"}
                </button>
              ) : null}
              <label>
                Amount
                <div className="expense-amount-field">
                  <span>₹</span>
                  <input
                    inputMode="decimal"
                    onChange={(event) => setAmount(event.target.value)}
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
                className="expense-button expense-button-primary expense-field-wide"
                disabled={Boolean(busyAction) || !activeCategory || !activePayer}
                type="submit"
              >
                {busyAction === "add-expense" ? "Saving to Firestore…" : "Add shared expense"}
              </button>
            </form>
            <form
              className="expense-category-form"
              onSubmit={(event) => void addCategory(event)}
            >
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
                Create
              </button>
            </form>
          </section>
        </div>

        <section className="expense-panel expense-recent-panel">
          <div className="expense-panel-heading">
            <div>
              <p className="expense-eyebrow">Shared activity</p>
              <h2>Recent expenses</h2>
            </div>
            <span>Synced live</span>
          </div>
          {visibleEntries.length ? (
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
                  {visibleEntries.map((entry) => (
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
              <h3>No expenses for this month</h3>
              <p>Choose another month or add a new shared expense.</p>
            </div>
          )}
        </section>

        <footer className="expense-footer">
          <span>
            <i className="expense-live-dot" /> Firestore real-time sync
          </span>
          <span>Private to Sai and Naveen</span>
        </footer>
      </main>
    </div>
  );
}
