# What Can You Build with MCP? Learn Through an Expense Tracker

Before defining MCP, imagine what an AI assistant could do if it could safely work with real applications.

It could:

```text
Read files from a project
Search a GitHub repository
Run tests and create a pull request
Add and complete personal tasks
Query a business database
Create support tickets
Read internal documentation
Generate reports from live data
Schedule meetings
Track personal expenses
```

For example, you could say:

> “Find the login bug in my repository, fix it, run the tests, and prepare a pull request.”

Or:

> “Show this month’s expenses and tell me where I spent the most.”

The AI model can understand these requests, but understanding alone is not enough. It needs a safe and structured way to communicate with GitHub, databases, files, calendars, and other systems.

That is what MCP provides.

> **MCP turns an AI application from something that only answers questions into something that can work with real tools and data.**

In this article, we will understand MCP through a simple Expense Tracker.

---

## What Is MCP?

MCP stands for **Model Context Protocol**.

It is a standard way for an AI application to connect to external tools, data, and services.

In simple terms:

> **MCP gives an AI application a controlled way to use capabilities outside the AI model.**

MCP does not make the model smarter.

Instead, it gives the application a common communication method for accessing useful capabilities.

For example:

```text
AI understands:
“Add ₹350 for lunch.”

MCP connects the application to:
add_expense(...)

Expense Tracker Server:
Validates and saves the expense
```

---

## Our Expense Tracker Example

Imagine you tell an AI assistant:

> “I spent ₹350 on lunch. Add it under food.”

The AI understands:

```json
{
  "amount": "350",
  "category": "food",
  "description": "Lunch"
}
```

But the expense still needs to be:

* validated,
* converted into a safe money format,
* stored in a database,
* and returned as a confirmed result.

The AI model should not receive unrestricted database access.

Instead, it uses the Expense Tracker MCP Server.

---

## MCP Architecture in This Project

Our example contains these components:

```text
User
  ↓
MCP Host
  ├── AI Model
  └── MCP Client
          ↓
    MCP messages over stdio
          ↓
Expense Tracker MCP Server
          ↓
SQLite Database
```

Let us understand each part.

### User

The user speaks naturally:

> “Add ₹350 for lunch under food.”

The user does not need to know Python, SQL, or MCP message formats.

### MCP Host

The Host is the application the user interacts with.

It coordinates the complete workflow. It can:

* communicate with the AI model,
* manage MCP Client connections,
* display tool requests,
* ask for approval,
* and show the final result.

### AI Model

The model understands the user’s request.

It decides that the user wants to create an expense and selects the appropriate capability.

The model decides what should happen, but it does not directly modify SQLite.

### MCP Client

The MCP Client lives inside the Host.

It communicates with the MCP Server using structured protocol messages.

For this request, it sends a tool call to the Expense Tracker Server.

### MCP Server

The Expense Tracker MCP Server contains the trusted application logic.

It knows how to:

```text
Add an expense
List stored expenses
Calculate monthly totals
Group spending by category
Update an expense
Delete an expense safely
```

### SQLite

SQLite stores the expense records.

SQLite is not MCP. It is an external system used by the MCP Server.

---

## Adding an Expense: Complete Flow

The user says:

> “I spent ₹350 on lunch. Add it under food.”

### Step 1: The AI understands the request

The model extracts:

```json
{
  "amount_rupees": "350",
  "category": "food",
  "description": "Lunch",
  "payment_method": "upi"
}
```

No database operation has happened yet.

### Step 2: The model selects a Tool

The Expense Tracker Server exposes a Tool called:

```text
add_expense
```

The model sees that this Tool can create a new expense.

> **Tools perform operations.**

### Step 3: The MCP Client sends the request

A simplified MCP request looks like this:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "add_expense",
    "arguments": {
      "amount_rupees": "350",
      "category": "food",
      "description": "Lunch",
      "payment_method": "upi"
    }
  }
}
```

This message means:

```text
Run the add_expense Tool
using these arguments.
```

### Step 4: The Server validates the data

Before saving anything, the Server checks:

```text
Is the amount greater than zero?
Does it have at most two decimal places?
Is food an allowed category?
Is the description empty?
Is the payment method supported?
Is the date valid?
```

These rules are defined by the application developer.

The model cannot bypass them.

### Step 5: The Server converts rupees to paise

Money should not be stored as a floating-point value.

The Server converts:

```text
₹350.00
   ↓
35,000 paise
```

The database stores an integer:

```text
amount_paise = 35000
```

This keeps calculations accurate.

### Step 6: SQLite stores the expense

The MCP Server runs a safe, parameterized database operation.

The model does not receive direct SQL access.

SQLite stores a record such as:

```text
ID: 1
Amount: 35000 paise
Category: food
Description: Lunch
Payment method: upi
```

### Step 7: The result returns to the user

The Server returns:

```json
{
  "message": "Expense added successfully.",
  "expense": {
    "id": 1,
    "amount_paise": 35000,
    "amount": "₹350.00",
    "category": "food",
    "description": "Lunch"
  }
}
```

The AI application can now say:

> “Your lunch expense of ₹350.00 has been added under food.”

---

## Complete Request Flow

```text
User:
“I spent ₹350 on lunch.”

        ↓

AI Model:
Understands the request

        ↓

AI Model:
Selects add_expense

        ↓

MCP Client:
Sends tools/call

        ↓

Expense Tracker MCP Server:
Validates the arguments

        ↓

MCP Server:
Converts ₹350 into 35,000 paise

        ↓

SQLite:
Stores the record

        ↓

MCP Server:
Returns the result

        ↓

Host:
Shows confirmation to the user
```

---

## What Can Our Expense Tracker MCP Server Do?

Our server exposes six Tools:

```text
add_expense
list_expenses
get_monthly_total
category_breakdown
update_expense
delete_expense
```

This means a user can ask:

> “Add ₹1,200 for the electricity bill.”

> “Show all expenses from July 2026.”

> “How much did I spend this month?”

> “Which category has the highest spending?”

> “Change expense 3 from travel to groceries.”

> “Delete expense 3 after I confirm.”

The model understands the language. The MCP Server performs the trusted operation.

---

## Tools, Resources, and Prompts

An MCP Server can expose three important types of capabilities.

### Tools

Tools perform operations.

In our project:

```text
add_expense
get_monthly_total
update_expense
delete_expense
```

A Tool may create data, retrieve data, run a calculation, or perform an external action.

> **Tools do something.**

### Resources

Resources provide contextual information.

Our server exposes:

```text
expenses://current-month/summary
```

It may return:

```json
{
  "month": "2026-07",
  "expense_count": 8,
  "total": "₹6,450.00",
  "highest_category": "bills"
}
```

The Resource does not modify the database.

> **Resources provide information.**

### Prompts

Prompts provide reusable workflow instructions.

Our server exposes:

```text
analyze_monthly_spending
```

It can guide the model to:

```text
Get the monthly total
Get the category breakdown
Find unusually large expenses
Suggest realistic savings
Never modify or delete data
```

> **Prompts guide a workflow.**

---

## Why Not Give the AI Direct Database Access?

Direct SQLite access would give the application too much power.

It could accidentally:

```text
Run an unsafe SQL query
Delete the wrong expense
Store an invalid amount
Access unrelated records
Ignore confirmation rules
```

Instead, the MCP Server exposes narrow operations:

```text
add_expense(...)
get_monthly_total(...)
update_expense(...)
delete_expense(confirm=true)
```

The developer controls:

* accepted inputs,
* validation rules,
* database queries,
* permissions,
* and confirmation requirements.

MCP standardizes the communication. The Server enforces the business rules.

---

## Quick Understanding Check

The user says:

> “Add ₹500 for groceries.”

Which component understands the sentence?

**AI Model**

Which capability creates the expense?

**`add_expense` Tool**

Which component validates the amount?

**Expense Tracker MCP Server**

Which system stores the record?

**SQLite**

Which component sends the `tools/call` message?

**MCP Client**

---

## What Else Could You Build?

The same MCP concepts can be used to build:

```text
GitHub Assistant
Search code, read files, run tests, create pull requests

Task Manager
Create tasks, set priorities, complete work

Customer Support Assistant
Read orders, check refunds, create tickets

Company Knowledge Assistant
Search approved internal documents

Database Analyst
Run controlled queries and generate reports

DevOps Assistant
Read logs, inspect deployments, restart approved services

Calendar Assistant
Find free time and schedule meetings

Content Publishing Assistant
Draft, review, and publish website content
```

The external system changes, but the pattern remains the same:

```text
User describes a goal
        ↓
Model selects a capability
        ↓
MCP Client sends a request
        ↓
MCP Server performs the operation
        ↓
Result returns to the application
```

---

## Final Understanding

```text
The User describes a goal

The AI Model understands the goal

The Host coordinates the workflow

The MCP Client sends structured messages

The MCP Server validates and performs the operation

SQLite stores the data
```

The key idea is:

> **The model decides what action is useful, while the MCP Server safely performs the trusted operation.**

And the three server capabilities are:

```text
Tool     → Performs an operation
Resource → Provides context
Prompt   → Guides a workflow
```

Most importantly:

> **MCP lets you build AI applications that can safely work with real tools, real data, and real services—not just generate text.**

---

## Terminal Demos: Direct MCP and Real AI + MCP

The project includes two terminal applications. They use the same local MCP server and SQLite database, but they teach two different ideas.

`terminal_app.py` is the direct MCP demo. It parses a small, predictable command format itself, then makes a real stdio MCP tool call. It does not use an AI model.

```powershell
uv run --no-sync python terminal_app.py
```

```text
expense> add 350 Lunch under food
expense> list
expense> total 2026-07
expense> delete 1
expense> delete 1 confirm
```

The real AI flow is `ai_terminal_app.py`. Here the terminal is the MCP Host: it sends your natural-language message to an OpenAI model, gives the model the tools exposed by the local MCP server, executes the tool selected by the model, and sends the result back to the model for a final answer.

```text
Your terminal message
   -> OpenAI model chooses an allowed tool
   -> local MCP Host / Client sends the tool call over stdio
   -> Expense Tracker MCP Server validates the request
   -> SQLite stores or reads the expense data
   -> tool result returns to the model
   -> helpful answer appears in the terminal
```

To run the AI version, create an OpenAI API key and set it only in the current PowerShell window. Do not put the key in source code or commit it.

```powershell
$env:OPENAI_API_KEY = "your_api_key_here"
uv run --no-sync python ai_terminal_app.py
```

Now you can write normal sentences instead of fixed commands:

```text
you> Add INR 350 for lunch under food
assistant> Added Lunch under food for ₹350.00.

you> Where did I spend the most in 2026-07?
assistant> Bills are your highest category for July 2026.

you> Delete expense 1
assistant> Please confirm that you want to delete expense 1.

you> Yes, delete expense 1
assistant> Expense 1 was deleted successfully.
```

The model never receives a SQLite connection and cannot run arbitrary SQL. It can only request the focused MCP tools defined by the server. The delete confirmation is enforced by the server, so it still applies even when the model is involved.

`ai_terminal_app.py` calls the OpenAI API, so your typed request and the tool result needed for the answer are sent to OpenAI. The direct `terminal_app.py` flow stays entirely local. An OpenAI API key and API billing are separate from a ChatGPT subscription.
