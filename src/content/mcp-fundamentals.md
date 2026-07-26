# What Is MCP? Learn It Through an Expense Tracker

Before learning the definition, start with one question.

**Can an AI assistant automatically see the files on your computer?**

No.

**Can it automatically open your GitHub repository, read your database, or add an expense?**

No.

An AI model can understand language, reason about a request, and suggest an answer. But it does not automatically have permission to use your files, databases, APIs, or applications.

For example, you can say:

> "Add INR 350 for lunch under food."

The AI understands the sentence. Understanding alone is not enough: a real application still needs to validate the amount, store it safely, and return a result. That is where MCP comes in.

---

## The Problem

Imagine asking an AI assistant:

> "Show this month's expenses and tell me where I spent the most."

Without an approved connection to your expense data, the assistant can only ask you to share the data. It cannot see your SQLite database, run your Expense Tracker, or change anything on its own.

The same issue appears with many real systems.

* Files on your computer
* GitHub repositories
* Databases
* Slack workspaces
* Google Drive folders
* Internal APIs
* Personal tools such as an Expense Tracker

An AI application needs a controlled connection to those systems.

---

## MCP Is the Solution

MCP means **Model Context Protocol**.

> **MCP is a common communication standard that lets an AI application safely connect to external tools, data, and services.**

Think of it like a translator. Two people who speak different languages need a translator to communicate.

```text
You
  ↓
Translator
  ↓
Another person
```

MCP plays the same role between an AI application and an external system.

```text
AI application
  ↓
MCP
  ↓
Files, GitHub, APIs, databases, or another application
```

MCP is not an AI model. It is not ChatGPT, Claude, or Cursor. It is the agreement that lets compatible software exchange structured requests and results.

---

## What Does “Protocol” Mean?

A protocol is simply a set of rules for communication.

* Browsers and websites use HTTP.
* Email systems use SMTP.
* File transfer can use FTP.
* AI applications and external tools can use MCP.

Before MCP, each AI application often needed a separate custom integration for every system.

```text
AI application → GitHub integration
AI application → Google Drive integration
AI application → Slack integration
AI application → Database integration
AI application → Expense Tracker integration
```

With MCP, a system can expose its capabilities once through an MCP server. Any compatible host can communicate with it using the same protocol.

```text
GitHub MCP Server
Filesystem MCP Server
Database MCP Server
Expense Tracker MCP Server
          ↓
      MCP standard
          ↓
AI applications
```

---

## Meet Our Expense Tracker

Our Expense Tracker stores expenses in a local SQLite database. Its direct terminal version accepts a fixed command such as:

```text
add 350 Lunch under food
```

That creates a record like this.

```json
{
  "id": 1,
  "amount": "₹350.00",
  "category": "food",
  "description": "Lunch",
  "payment_method": "upi"
}
```

Now imagine using natural language instead:

> "I spent INR 350 on lunch today. Add it under food."

The AI can understand the request, but it should not receive unrestricted SQLite access. Instead, it asks our Expense Tracker MCP Server to use one focused, approved tool.

```text
You
  ↓
AI application
  ↓
Expense Tracker MCP Server
  ↓
SQLite database
```

---

## Host, Client, and Server

MCP has three important roles.

```text
+--------------------------------------+
|              MCP Host                |
|                                      |
|  AI model                            |
|  MCP Client                          |
+------------------↓-------------------+
                   ↓ MCP protocol
          Expense Tracker MCP Server
                   ↓
             SQLite database
```

### The Host

The **Host** is the AI application that you interact with. It receives the request, coordinates the AI model, manages MCP connections, shows approvals, and displays the result.

In our project, `ai_terminal_app.py` is a small AI-powered Host. It accepts natural language in the terminal and lets an OpenAI model choose from the tools exposed by the local MCP server.

### The MCP Client

The **MCP Client** lives inside the Host. It is not normally a separate application that the user opens.

Its job is to connect to one server, send structured requests, receive responses, and maintain the connection. A Host can create one client connection for each server it uses.

### The MCP Server

The **MCP Server** exposes useful capabilities. Our Expense Tracker MCP Server knows how to validate data, work with SQLite, enforce safety rules, and return structured results.

```text
add_expense()
list_expenses()
get_monthly_total()
category_breakdown()
update_expense()
delete_expense()
```

---

## Add an Expense: Complete Flow

You type:

> "I spent INR 350 on lunch today. Add it under food."

### Step 1: The Host receives the request

The AI model understands that this is an expense-creation request.

```text
You
  ↓
AI Host
```

### Step 2: The model selects a Tool

The server exposes a tool named `add_expense`. The model decides that this is the right capability for the user's request. It does not write a SQL statement.

### Step 3: The Client sends structured arguments

```json
{
  "tool": "add_expense",
  "arguments": {
    "amount": 350,
    "category": "food",
    "description": "Lunch",
    "payment_method": "upi"
  }
}
```

### Step 4: The Server validates the request

Before changing data, the server checks the amount, category, description, payment method, and date. These are application rules written by the developer. The AI model cannot bypass them.

### Step 5: The Server stores money safely

The server converts money into integer paise before storing it.

```text
₹350.00
   ↓
35,000 paise
```

This avoids floating-point money errors.

### Step 6: SQLite saves the record

The MCP server uses the trusted database layer to save the validated expense.

### Step 7: The result returns to the user

```json
{
  "message": "Expense added successfully.",
  "expense": {
    "id": 1,
    "amount": "₹350.00",
    "category": "food",
    "description": "Lunch"
  }
}
```

The AI application can now say: **“Added ₹350.00 for Lunch under Food.”**

---

## The Important Distinction

People often say, “The AI added the expense.” That is convenient language, but the real responsibilities are different.

* The **AI Model** understands the request and selects a useful tool.
* The **Host** coordinates the interaction and user approval.
* The **MCP Client** communicates with the server.
* The **MCP Server** validates and performs the action.
* **SQLite** stores the expense.

> **The model decides what action is useful. The MCP Server safely performs the trusted operation.**

The model only receives the capabilities that the server intentionally exposes. It does not automatically gain unrestricted access to a computer or database.

---

## Why Not Give the AI Direct Database Access?

An application could technically call a database API directly. But that becomes difficult to manage when the application needs to support GitHub, databases, files, calendars, or many other systems.

More importantly, direct access can be unsafe. A broad database connection could allow invalid amounts, unsafe queries, accidental deletion, or access to unrelated records.

Our server exposes narrow operations instead.

```text
add_expense(...)
get_monthly_total(...)
update_expense(...)
delete_expense(confirm=true)
```

The server owns validation, database queries, permissions, and confirmation requirements. For example, deleting an expense requires an explicit confirmation, even when an AI model is involved.

```text
delete expense 1
→ Deletion needs explicit confirmation.

delete expense 1 confirm
→ Expense deleted successfully.
```

---

## Tools, Resources, and Prompts

An MCP server can expose three important kinds of capabilities.

### Tools

Tools are executable actions.

```text
add_expense
list_expenses
get_monthly_total
category_breakdown
update_expense
delete_expense
```

> **Tools do something.**

### Resources

Resources provide read-only context. For an Expense Tracker, they could provide available categories, a database schema, or the current month’s summary.

```text
expense://categories
expense://current-month-summary
expense://database-schema
```

> **Resources provide information.**

### Prompts

Prompts are reusable workflow templates. For example, a monthly-review prompt could ask the model to fetch totals, find the largest category, and suggest savings without modifying any data.

> **Prompts guide a workflow.**

---

## Where Are These Parts in Our Expense Tracker?

**The complete Expense Tracker project is available to download at the end of this article.** When you download and extract it for the first time, use the reference below to see exactly where each MCP component lives in the project files.

```text
You
  = the person typing a message in the terminal

AI Host + MCP Client
  = ai_terminal_app.py

AI Model
  = OpenAI model selected by ai_terminal_app.py

MCP Server
  = src/expense_tracker_mcp/server.py

MCP Tools
  = add_expense, list_expenses, get_monthly_total,
    category_breakdown, update_expense, delete_expense

Database layer
  = src/expense_tracker_mcp/database.py

Database file
  = data/expenses.sqlite3 (created locally when you run the app)

Validation and money rules
  = validation.py and money.py

Direct terminal demo
  = terminal_app.py

AI + MCP terminal demo
  = ai_terminal_app.py
```

---

## Try It in Your Terminal

The project includes two terminal applications that use the same local MCP server and SQLite database.

### Direct MCP terminal demo

`terminal_app.py` understands a small, predictable command format itself. It makes a real stdio MCP tool call, but it does not use an AI model.

```powershell
uv run --no-sync python terminal_app.py
```

```text
expense> add 350 Lunch under food
expense> add ₹1,200 Electricity bill under bills via bank_transfer
expense> list
expense> total 2026-07
expense> breakdown 2026-07
expense> delete 1
expense> delete 1 confirm
```

This demo proves that the terminal client, MCP server, validation, and SQLite database are all working locally.

### Real AI + MCP terminal demo

`ai_terminal_app.py` is the real AI flow. The terminal acts as the Host, the OpenAI model chooses an allowed tool, the MCP Client sends that tool call to the local server over stdio, and the result returns for a helpful final answer.

```text
Your terminal message
  ↓
OpenAI model chooses an allowed tool
  ↓
Local MCP Host / Client sends the tool call over stdio
  ↓
Expense Tracker MCP Server validates the request
  ↓
SQLite reads or stores the data
  ↓
Tool result returns to the model
  ↓
Helpful answer appears in the terminal
```

The AI model never receives a SQLite connection and cannot run arbitrary SQL. It can request only the focused MCP tools defined by the server.

---

## Final Understanding

```text
The User describes a goal

The AI Model understands the goal

The Host coordinates the workflow

The MCP Client sends structured messages

The MCP Server validates and executes trusted operations

SQLite stores the data
```

MCP turns an AI application from something that only generates text into something that can safely work with real tools, real data, and real services.
