import os
import json
import re

fundamentals_sections = [
    {
        "id": "what-readers-will-learn",
        "heading": "1. What Readers Will Learn",
        "paragraphs": [
            "Welcome to Module 1 of MCP Made Simple. This introductory guide takes you from a beginner with zero prior knowledge of agent protocols to a developer who understands how AI applications communicate with local filesystems, external databases, cloud services, and developer tools.",
            "You will master the fundamental concepts of the Model Context Protocol (MCP), a stable open standard released by Anthropic on November 25, 2025. You will learn why traditional LLMs operate inside isolated sandboxes, why custom N×M API integrations fail to scale, and how MCP solves this problem through a unified client-server architecture.",
            "By the end of Part 1, you will be equipped to answer technical questions regarding AI tool calling, protocol boundaries, JSON-RPC primitives, schema declarations, and security boundaries."
        ],
        "bullets": [
            "Understand the fundamental isolation problem of Large Language Models (LLMs).",
            "Master the 'AI has a brain but needs hands' mental model for external tool access.",
            "Trace a complete read_file tool execution step-by-step from prompt to output.",
            "Explore the USB-C analogy for software protocols and understand its limitations.",
            "Contrast N×M custom API integrations with the 1×N unified MCP client-server model.",
            "Distinguish between MCP Tools, Resources, and Prompts in application design."
        ]
    },
    {
        "id": "real-github-problem",
        "heading": "2. A Real GitHub Repository Problem",
        "paragraphs": [
            "Imagine asking an AI coding assistant: 'Why is our authentication module throwing a 401 Unauthorized error during token refresh?'",
            "The relevant code sits in your project under src/auth/tokenService.ts. However, a raw Large Language Model hosted on a remote server cannot see your computer, cannot read your codebase, and has no memory of recent commits.",
            "If the model answers using only pre-trained weights, it gives generic advice about OAuth 2.0. It cannot inspect line 42 of your token refresher or run your unit tests.",
            "This gap between an AI model's internal reasoning engine and your local environment represents the core bottleneck in modern AI software engineering."
        ],
        "callout": {
            "type": "beginner-explanation",
            "title": "The Knowledge Cutoff vs Private Context Gap",
            "content": "Even an AI model trained on trillions of public tokens has zero knowledge of your private local files, internal company databases, or current session state. Model training creates static weights, whereas software development requires dynamic context."
        }
    },
    {
        "id": "why-ai-cannot-access-private-systems",
        "heading": "3. Why AI Models Cannot Automatically Access Private Systems",
        "paragraphs": [
            "Large Language Models are intentionally restricted from directly accessing your operating system or network. AI models process text tokens and produce probability distributions over output tokens.",
            "By default, an AI model runs inside an isolated data center sandbox. The raw model container has no network access to your local machine, no file handles to your disk, and no credentials to your private cloud.",
            "Granting an external neural network unrestricted access to host APIs would introduce severe security vulnerabilities. If an unconstrained AI model could execute arbitrary shell commands, a malicious prompt injection inside a pull request could compromise your infrastructure.",
            "Therefore, system architects isolate the AI model's neural network, constructing an intentional, permission-controlled interface exposing explicit functions known as tools."
        ]
    },
    {
        "id": "brain-and-hands-model",
        "heading": "4. The 'AI Has a Brain But Needs Hands' Mental Model",
        "paragraphs": [
            "A helpful mental model for understanding AI system design is: 'The AI model has a brain, but needs hands to touch the real world.'",
            "In this analogy, the Large Language Model acts as the 'brain'. It excels at reasoning, analyzing logic, summarizing text, and generating code syntax. However, the model cannot directly execute code or read a file.",
            "External tools act as the 'hands'. A tool is a deterministic software function written in Python, TypeScript, or Go that executes on a host machine. When the LLM decides it needs information from disk, it formulates a structured request asking its 'hands' (the tool) to execute the action.",
            "Maintaining a strict division between reasoning (the neural network) and execution (software code) achieves both AI capabilities and security."
        ],
        "diagram": {
            "id": "brain-hands-diagram",
            "title": "Mental Model: Reasoning (Brain) vs Execution (Hands)",
            "description": "Visual breakdown showing how the AI model reasons while MCP tools perform physical data execution.",
            "type": "brain-and-hands",
            "steps": [
                { "label": "Reasoning Engine (LLM Brain)", "sub": "Evaluates Prompt & Decides Action", "desc": "Analyzes user request and recognizes that local file content is needed." },
                { "label": "Structured Intent (Tool Call Request)", "sub": "JSON Schema Output", "desc": "Emits structured tool request: read_file(path='src/auth/tokenService.ts')." },
                { "label": "Execution Engine (MCP Hands)", "sub": "Deterministic Code Execution", "desc": "Local MCP server receives call, verifies permissions, reads file from disk, and returns content." },
                { "label": "Synthesis (Final Answer)", "sub": "Contextual LLM Response", "desc": "LLM ingests returned code snippet and provides precise bug diagnosis to user." }
            ]
        }
    },
    {
        "id": "what-is-an-external-tool",
        "heading": "5. What an External Tool Is",
        "paragraphs": [
            "In AI protocol engineering, an 'external tool' is an explicitly declared software function made available to an LLM during a conversation session.",
            "A tool consists of three components: a unique name (such as read_file), a description explaining what it does, and a JSON Schema defining expected input parameters.",
            "When an LLM receives a prompt alongside available tools, it evaluates whether any tool can help fulfill the request. If relevant, the model outputs a special formatted JSON payload specifying the tool name and arguments.",
            "The LLM does not execute the function. The client application intercepts the JSON tool call, invokes the underlying executable code, and sends the result back to the model."
        ]
    },
    {
        "id": "read-file-tool-flow",
        "heading": "6. A Complete read_file Tool Execution Flow",
        "paragraphs": [
            "Let us trace a complete tool execution flow for a read_file tool to see how data moves between the user, the AI model, and the local operating system.",
            "Step 1: The user types 'Check the contents of package.json' in an AI application.",
            "Step 2: The client application sends the prompt to the LLM API, accompanied by available tools including read_file(path: string).",
            "Step 3: The LLM returns a response containing payload: { name: 'read_file', arguments: { path: 'package.json' } }.",
            "Step 4: The client application verifies permissions and reads package.json from disk.",
            "Step 5: The client formats the content into a tool_result message and returns it to the LLM.",
            "Step 6: The LLM analyzes the file content and generates a response explaining package.json."
        ],
        "code": {
            "language": "json",
            "filename": "read_file_execution_payloads.json",
            "code": "// 1. LLM Tool Call Output payload emitted to client\n{\n  \"type\": \"tool_use\",\n  \"id\": \"call_89f1a23c\",\n  \"name\": \"read_file\",\n  \"input\": { \"path\": \"package.json\" }\n}\n\n// 2. Client Tool Result payload returned to LLM\n{\n  \"type\": \"tool_result\",\n  \"tool_use_id\": \"call_89f1a23c\",\n  \"content\": \"{\\n  \\\"name\\\": \\\"portfolio\\\"\\n}\"\n}"
        }
    },
    {
        "id": "what-mcp-stands-for",
        "heading": "7. What MCP Stands For",
        "paragraphs": [
            "MCP stands for Model Context Protocol. It is an open specification introduced by Anthropic in November 2025 to solve the fragmented ecosystem of AI tool integration.",
            "Before MCP, every AI tool developer built custom connectors. Claude Desktop used one format, Cursor IDE used another, and custom frameworks used a third.",
            "MCP replaces this fragmentation with a unified standard based on JSON-RPC 2.0, allowing any AI host to connect to any MCP server without custom glue code."
        ],
        "callout": {
            "type": "important",
            "title": "Stable Specification Baseline",
            "content": "This course strictly teaches the stable MCP specification version 2025-11-25. All architecture patterns, schema definitions, and protocol lifecycle phases documented here conform directly to the published standard."
        }
    },
    {
        "id": "what-is-a-protocol",
        "heading": "8. What a Protocol Is",
        "paragraphs": [
            "In computer science, a 'protocol' is a formal set of rules and message formats that allow independent software systems to exchange data reliably.",
            "Just as HTTP defines how web browsers request web pages from servers, MCP defines how AI host applications discover capabilities, invoke tools, read resources, and execute prompts on external servers.",
            "Without a protocol, software components must be tightly coupled with custom glue code. With a protocol, software components become modular and interoperable."
        ]
    },
    {
        "id": "usb-c-analogy-and-limitations",
        "heading": "9. The USB-C Analogy and Its Limitations",
        "paragraphs": [
            "A popular analogy used to explain MCP to beginners is the USB-C hardware standard.",
            "Before USB-C, connecting hardware peripherals required micro-USB, Lightning, HDMI, DisplayPort, and proprietary barrel plugs. USB-C unified power and data transfer under a single standard connector.",
            "MCP does the same thing for AI software. Instead of writing custom code for every combination of AI host and data tool, developers write one MCP server that plugs into any MCP-compatible AI client.",
            "However, unlike physical USB-C cables carrying raw electricity, MCP is a stateful software protocol operating over transports like stdio and HTTP/SSE with capability negotiation, schema validation, and security handshakes."
        ],
        "diagram": {
            "id": "usb-c-analogy-diagram",
            "title": "The USB-C Standard Analogy for AI Integrations",
            "description": "Visual comparison showing fragmented integrations versus standardized MCP connectors.",
            "type": "usb-c",
            "steps": [
                { "label": "Fragmented Custom Connectors", "sub": "N × M Complexity", "desc": "Hardcoded proprietary APIs for every single application pair." },
                { "label": "Standardized MCP Port", "sub": "1 Universal Protocol Standard", "desc": "AI clients implement 1 MCP client interface; tools expose 1 MCP server interface." }
            ]
        }
    },
    {
        "id": "integrations-without-mcp",
        "heading": "10. Integrations Without MCP",
        "paragraphs": [
            "To appreciate MCP, consider building AI integrations without a protocol standard.",
            "Suppose you build a SQL database tool. If 5 AI applications exist (Claude Desktop, Cursor, VS Code, LangChain, AutoGPT), you must write 5 separate custom plugins, each with different auth, payload formats, and error handling.",
            "If you have 10 data tools and 5 AI clients, the ecosystem requires 10 × 5 = 50 separate custom software integrations. Every API change breaks multiple fragile integrations."
        ]
    },
    {
        "id": "integrations-with-mcp",
        "heading": "11. Integrations With MCP",
        "paragraphs": [
            "With the Model Context Protocol, the N × M integration bottleneck is reduced to a clean 1 × N architecture.",
            "Tool developers build a single MCP Server for their database, filesystem, or API service. That server automatically works in Claude Desktop, Cursor IDE, Zed editor, and custom Python agent hosts.",
            "Similarly, AI client developers implement the MCP Client specification once, and users instantly gain access to community MCP servers exposing GitHub, PostgreSQL, Brave Search, and Google Drive."
        ],
        "diagram": {
            "id": "without-vs-with-mcp-diagram",
            "title": "Architectural Shift: Without MCP vs With MCP",
            "description": "Comparison between N*M custom spaghetti integrations and standardized 1*N MCP architecture.",
            "type": "without-vs-with"
        }
    },
    {
        "id": "complete-github-workflow",
        "heading": "12. A Complete GitHub Workflow",
        "paragraphs": [
            "Let us examine how an MCP-enabled AI client handles a multi-step engineering task: creating a new feature branch and pushing a bugfix to GitHub.",
            "1. User Request: 'Find the bug in auth.py, fix it, and create a pull request on GitHub.'",
            "2. Capability Discovery: During startup, the AI client connected to the GitHub MCP Server and received available tools: search_code, read_file, create_branch, commit_changes, and create_pull_request.",
            "3. Search & Read: The LLM calls search_code(query='auth.py'). The GitHub MCP server queries GitHub API and returns the file content.",
            "4. Reasoning & Editing: The LLM analyzes the code, finds a missing null check, and generates corrected python code.",
            "5. Branch & Commit: The LLM calls create_branch(name='fix-auth-null-check') followed by commit_changes(file='auth.py', content=...).",
            "6. Pull Request: The LLM calls create_pull_request(title='Fix null check in auth.py', body=...).",
            "Throughout this workflow, the LLM never possessed your GitHub access token. The GitHub MCP server safely handled authentication and API interactions."
        ]
    },
    {
        "id": "choosing-exposed-tools",
        "heading": "13. How Server Developers Choose Exposed Tools",
        "paragraphs": [
            "When designing an MCP server, developers decide which functions to expose to AI hosts. Exposing too few tools limits usefulness, while exposing too many creates prompt overhead.",
            "Server developers evaluate three core criteria when selecting exposed tools:",
            "1. Atomic Functionality: Tools should perform distinct, single-purpose actions (e.g., fetch_issue vs update_issue) rather than monolithic operations.",
            "2. Strict Input Validation: Exposed tools must accept well-defined JSON parameters validated against rigid schemas.",
            "3. Security Impact: High-risk operations (such as delete_database) must be segregated, requiring explicit human authorization."
        ]
    },
    {
        "id": "tool-definition-schema",
        "heading": "14. A Simplified Tool Definition and Input Schema",
        "paragraphs": [
            "Under the MCP 2025-11-25 specification, every tool exposed by an MCP server is declared using a structured JSON object containing name, description, and inputSchema.",
            "Below is a simplified code example showing a tool declaration for a query_database tool:"
        ],
        "code": {
            "language": "json",
            "filename": "mcp_tool_definition_schema.json",
            "code": "{\n  \"name\": \"query_database\",\n  \"description\": \"Executes a read-only SQL query against the production PostgreSQL analytics database.\",\n  \"inputSchema\": {\n    \"type\": \"object\",\n    \"properties\": {\n      \"sql_query\": { \"type\": \"string\", \"description\": \"The SELECT SQL query statement to execute.\" }\n    },\n    \"required\": [\"sql_query\"]\n  }\n}"
        }
    },
    {
        "id": "tool-unavailable-behavior",
        "heading": "15. What Happens When a Requested Tool Is Unavailable",
        "paragraphs": [
            "In complex agent environments, an AI model might attempt to invoke a tool that is not installed, disconnected, or disabled due to permissions.",
            "When an AI client receives a tool request for an unavailable tool name, it returns a standard JSON-RPC error response with error code -32601 (Method not found) or a structured tool_result with isError: true.",
            "Upon receiving this error result in its context window, a well-trained LLM gracefully adapts. It informs the user that the requested tool is unavailable and suggests an alternative approach."
        ]
    },
    {
        "id": "broad-vs-narrow-tools",
        "heading": "16. Broad Tools Versus Narrow Tools",
        "paragraphs": [
            "An important decision in tool design is choosing between Broad Tools and Narrow Tools.",
            "A Broad Tool is a versatile interface such as execute_bash_command. Broad tools give the AI flexibility because a single tool performs many operations. However, broad tools carry high security risks.",
            "A Narrow Tool is a specialized interface such as get_user_by_id. Narrow tools are easy to validate, highly secure, and have high execution accuracy.",
            "Best Practice: Use narrow tools for production business applications where safety is critical. Reserve broad tools for isolated developer environments."
        ]
    },
    {
        "id": "tools-resources-prompts",
        "heading": "17. Tools, Resources, and Prompts",
        "paragraphs": [
            "The MCP specification defines three distinct core primitives that an MCP server can expose to an AI host: Tools, Resources, and Prompts.",
            "1. Tools (Model-Controlled Executables): Dynamic functions that an AI model decides to invoke to modify state or fetch data (e.g., send_email, write_file, execute_query).",
            "2. Resources (Application-Controlled Data): Passive data feeds (files, logs, database schemas) that the host application or user attaches to the context window as read-only context (URIs like file:///logs/app.log or postgres://schema).",
            "3. Prompts (User-Controlled Templates): Pre-configured context templates that users select from a menu to guide the AI's behavior."
        ],
        "table": {
            "headers": ["Primitive", "Controlled By", "Primary Purpose", "Example URI / Name"],
            "rows": [
                ["Tools", "AI Model (LLM)", "Perform actions & side effects", "read_file, create_issue"],
                ["Resources", "Host / User", "Attach read-only context", "file:///src/App.tsx, db://schema"],
                ["Prompts", "User", "Reusable workflow templates", "git-commit-message, code-review"]
            ]
        }
    },
    {
        "id": "mcp-vs-api",
        "heading": "18. MCP Versus API",
        "paragraphs": [
            "Developers often ask: 'How does MCP differ from a standard REST or GraphQL API?'",
            "A traditional API is designed for human developers, exposing HTTP endpoints with specific headers and payload formats for apps.",
            "MCP is a meta-protocol designed for AI agents. It wraps underlying REST, GraphQL, or database APIs inside a standardized discovery and execution layer. MCP tells the AI model: 'Here is what this server can do, here are its exact JSON inputs, and here is how you call it.' MCP provides the standardization layer on top of APIs."
        ]
    },
    {
        "id": "mcp-vs-function-calling",
        "heading": "19. MCP Versus Function Calling",
        "paragraphs": [
            "Another source of confusion is the distinction between LLM 'Function Calling' and the Model Context Protocol.",
            "Function Calling is a model feature referring to an LLM's ability to inspect JSON function definitions and output structured tool call JSON instead of plain text.",
            "MCP is a system architecture protocol. Function calling is just one component of MCP. MCP defines how clients discover servers, establish transport connections, exchange JSON-RPC messages, negotiate capabilities, stream notifications, and enforce security policies."
        ]
    },
    {
        "id": "what-mcp-is-not",
        "heading": "20. What MCP Is Not",
        "paragraphs": [
            "To maintain clear boundaries, let us explicitly clarify what MCP is NOT:",
            "• MCP is NOT a new programming language.",
            "• MCP is NOT an AI model or LLM replacement.",
            "• MCP is NOT a proprietary cloud service (it is an open-source specification).",
            "• MCP is NOT restricted to Anthropic models (it works with OpenAI, Gemini, Ollama, and open-source models).",
            "• MCP is NOT a database (it is the protocol that connects AI models to databases)."
        ]
    },
    {
        "id": "security-fundamentals",
        "heading": "21. Security Fundamentals",
        "paragraphs": [
            "Security is a core design principle of the Model Context Protocol specification.",
            "Key Security Rule 1: Human-in-the-Loop Approval. MCP hosts ask the user for explicit confirmation before executing tools that perform side effects (such as modifying files or writing to databases).",
            "Key Security Rule 2: Transport Isolation. Local stdio MCP servers run bounded by host process permissions. Remote MCP servers operate over HTTP/SSE with TLS encryption and OAuth 2.0 token authentication.",
            "Key Security Rule 3: Parameter Validation. Every tool payload is strictly validated against JSON Schemas before execution, preventing injection attacks."
        ],
        "callout": {
            "type": "security-note",
            "title": "Never Hardcode Secrets in MCP Servers",
            "content": "MCP servers should ingest API keys and access tokens via environment variables managed securely by the host application. Never hardcode credentials into server source code."
        }
    },
    {
        "id": "real-world-scenarios",
        "heading": "22. Three Real-World MCP Scenarios",
        "paragraphs": [
            "To see MCP in action, let us analyze three complete real-world architectural scenarios.",
            "Scenario 1: AI Reads and Edits a GitHub Repository. A developer asks Claude Desktop to fix a bug. Claude Desktop (Host) routes the tool call through the GitHub MCP Client to the GitHub MCP Server. The server executes git commands via GitHub API and returns updated repository state.",
            "Scenario 2: AI Searches Approved Company Documentation. An employee asks an AI assistant for vacation rollover policies. The Host delegates to a Vector DB MCP Server. The server queries internal company docs and returns exact policy paragraphs with citations.",
            "Scenario 3: AI Creates a Draft and Publishes a Website Article. A content editor prompts an AI writer to draft an announcement. The AI generates markdown, formats images, and uses a CMS MCP Server to publish a draft to WordPress."
        ],
        "diagram": {
            "id": "scenario-1-github-diagram",
            "title": "Real-World Scenario 1: AI Reads & Edits GitHub Repository",
            "description": "Step-by-step flow showing User Request -> AI Host -> MCP Client -> MCP Server -> GitHub API -> Result",
            "type": "scenario-1-github",
            "nodes": [
                { "name": "User Request", "role": "Prompt input", "highlight": False },
                { "name": "AI Host", "role": "Claude Desktop / Cursor", "highlight": False },
                { "name": "MCP Client", "role": "Protocol Router", "highlight": True },
                { "name": "MCP Server", "role": "GitHub Tool Server", "highlight": True },
                { "name": "External System", "role": "GitHub REST/GraphQL API", "highlight": False },
                { "name": "Result", "role": "Branch Created & Code Edited", "highlight": False }
            ]
        }
    },
    {
        "id": "interactive-design-exercise",
        "heading": "23. An Interactive Design Exercise",
        "paragraphs": [
            "Exercise Challenge: Design an MCP Server for a Weather & Incident Notification System.",
            "Imagine you are building an MCP server for an emergency response team. Your system needs to provide weather forecasts and dispatch SMS alerts to ground personnel.",
            "Design Task: Identify 2 Tools and 1 Resource for this server.",
            "Proposed Solution:",
            "• Tool 1: get_weather_forecast(latitude: float, longitude: float) -> Returns temperature, precipitation, and wind conditions.",
            "• Tool 2: send_sms_alert(phone_number: string, message: string) -> Sends urgent SMS via Twilio API.",
            "• Resource 1: weather://radar/active-alerts -> Live stream of active national weather warnings."
        ]
    },
    {
        "id": "common-misconceptions",
        "heading": "24. Common Misconceptions",
        "paragraphs": [
            "Let us clear up four common misconceptions developers encounter when first learning MCP:",
            "Misconception 1: 'MCP requires sending my private data to Anthropic.' -> False. MCP is an open-source protocol. Local stdio MCP servers process all data locally on your computer.",
            "Misconception 2: 'MCP slows down AI responses.' -> False. MCP JSON-RPC messages execute in milliseconds over local IPC pipes.",
            "Misconception 3: 'I have to rewrite all my existing REST APIs.' -> False. MCP servers act as lightweight wrappers around your existing REST, gRPC, or GraphQL APIs.",
            "Misconception 4: 'MCP only works for coding assistants.' -> False. MCP is used for healthcare records, financial analytics, customer support CRM, and marketing workflows."
        ]
    },
    {
        "id": "frequently-asked-questions",
        "heading": "25. Frequently Asked Questions (FAQs)",
        "paragraphs": [
            "Here are answers to the six most frequently asked questions about MCP Fundamentals:",
            "Q1: Is MCP free and open-source?\nYes. MCP is released under the permissive MIT open-source license by Anthropic.",
            "Q2: What programming languages support MCP?\nOfficial SDKs exist for TypeScript/JavaScript, Python, Kotlin, and Go, with community SDKs for Rust and C#.",
            "Q3: Can I run MCP servers locally on my laptop?\nYes! Most developer tools run as local stdio processes on macOS, Linux, and Windows.",
            "Q4: How does MCP handle authentication for remote servers?\nRemote servers over SSE use standard HTTP Authorization headers with Bearer tokens or OAuth 2.0 authentication flows.",
            "Q5: What is the difference between a Host and a Client in MCP?\nThe Host is the user-facing app (like Claude Desktop). The Client is the protocol engine embedded inside the Host that connects to Servers.",
            "Q6: Where can I find pre-built MCP servers?\nThe official MCP GitHub repository and community registries list hundreds of open-source servers for PostgreSQL, GitHub, Slack, Brave, and SQLite."
        ]
    },
    {
        "id": "interactive-checkpoint-quiz",
        "heading": "26. Interactive Checkpoint Quiz",
        "paragraphs": [
            "Test your understanding of MCP Fundamentals before moving on to Module 1 Part 2 (Architecture)."
        ],
        "quizzes": [
            {
                "id": "quiz-fund-1",
                "question": "What is the primary purpose of the Model Context Protocol (MCP)?",
                "options": [
                    "To replace Python with a new AI programming language",
                    "To provide a universal open standard for connecting AI models to data tools and host systems",
                    "To train Large Language Models on private data faster",
                    "To encrypt internet traffic using quantum cryptography"
                ],
                "correctIndex": 1,
                "explanation": "MCP provides a standardized protocol for connecting AI models to local filesystems, databases, tools, and enterprise workflows without custom N*M code."
            },
            {
                "id": "quiz-fund-2",
                "question": "In the 'AI has a brain but needs hands' mental model, what represents the 'hands'?",
                "options": [
                    "The pre-trained LLM weights",
                    "The user's keyboard",
                    "Deterministic software tools exposed by MCP servers",
                    "The cloud data center GPU hardware"
                ],
                "correctIndex": 2,
                "explanation": "External tools exposed by MCP servers act as the 'hands', executing physical actions like reading files or querying databases."
            },
            {
                "id": "quiz-fund-3",
                "question": "Which primitive in MCP represents dynamic, model-executed functions?",
                "options": [
                    "Resources",
                    "Prompts",
                    "Tools",
                    "Transports"
                ],
                "correctIndex": 2,
                "explanation": "Tools are model-controlled executable functions with JSON Schema parameters. Resources are read-only data attachments, and Prompts are templates."
            },
            {
                "id": "quiz-fund-4",
                "question": "How does MCP simplify an ecosystem with 10 data sources and 5 AI host applications?",
                "options": [
                    "It requires writing 50 custom plugins",
                    "It reduces integrations from 50 custom pairs to 10 MCP servers plugging into 5 MCP clients",
                    "It eliminates the need for data tools entirely",
                    "It forces all applications to use cloud databases"
                ],
                "correctIndex": 1,
                "explanation": "MCP transforms N*M complex integrations into a clean 1*N architecture using a shared protocol standard."
            },
            {
                "id": "quiz-fund-5",
                "question": "What happens if an LLM requests a tool that is currently unavailable?",
                "options": [
                    "The entire operating system crashes",
                    "The MCP client returns a JSON-RPC error response, allowing the LLM to gracefully explain the issue to the user",
                    "The LLM automatically writes new C++ code to fix the tool",
                    "The user is immediately logged out of their account"
                ],
                "correctIndex": 1,
                "explanation": "MCP clients return structured error responses (e.g. Method Not Found -32601), allowing the AI model to adapt gracefully."
            },
            {
                "id": "quiz-fund-6",
                "question": "What security mechanism protects users from unwanted tool side effects?",
                "options": [
                    "Human-in-the-Loop confirmation prompts",
                    "Disabling internet connections completely",
                    "Deleting all source code after every session",
                    "Encrypting local RAM hardware"
                ],
                "correctIndex": 0,
                "explanation": "MCP hosts enforce Human-in-the-Loop confirmation, requiring user approval before executing sensitive tool side effects."
            }
        ]
    },
    {
        "id": "key-takeaways",
        "heading": "27. Key Takeaways",
        "paragraphs": [
            "Congratulations! You have completed Part 1 of Module 1. Here is a summary of the foundational concepts you mastered:"
        ],
        "bullets": [
            "Standardized Protocol: MCP replaces fragmented custom AI integrations with a universal client-server open standard based on JSON-RPC 2.0.",
            "Reasoning vs Execution: AI models provide reasoning ('the brain'), while MCP servers provide execution ('the hands').",
            "Core Primitives: MCP servers expose Tools (executable actions), Resources (read-only data feeds), and Prompts (reusable context templates).",
            "1×N Architecture: Developers build one MCP server that works across Claude Desktop, Cursor, Zed, and custom AI host applications.",
            "Security First: MCP incorporates Human-in-the-Loop approvals, transport isolation, and rigid schema validation to keep private data safe."
        ]
    }
]

print("Fundamentals sections ready:", len(fundamentals_sections))
