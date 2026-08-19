import os
import json

architecture_sections = [
    {
        "id": "architecture-overview",
        "heading": "1. Architecture Overview",
        "paragraphs": [
            "Welcome to Part 2 of Module 1: MCP Architecture. Having mastered the core concepts, mental models, and primitives of the Model Context Protocol in Part 1, we now dive into the internal architectural mechanisms that govern how MCP components collaborate during a live AI engineering session.",
            "The MCP architecture is built around a clear, decoupled client-server topology. Every MCP interaction involves four primary actors: the User, the AI Host Application, the AI Model (LLM), the MCP Client layer, and one or more independent MCP Servers linked to external data systems.",
            "Understanding how these components interact across transport boundaries, process handshakes, serialize JSON-RPC messages, and recover from network failures is essential for building resilient enterprise AI applications."
        ],
        "diagram": {
            "id": "arch-overview-diagram",
            "title": "MCP Architecture: Host, Client, and Server Topology",
            "description": "Visual diagram showing the interaction between User, Host, AI Model, MCP Client, and MCP Servers.",
            "type": "host-client-server",
            "steps": [
                { "label": "1. User & Host Application", "sub": "Claude Desktop / Cursor / IDE", "desc": "Renders UI, manages user sessions, and coordinates active MCP client connections." },
                { "label": "2. AI Model (LLM)", "sub": "Reasoning Core", "desc": "Processes context, evaluates tool definitions, and emits structured tool invocation intents." },
                { "label": "3. MCP Client Protocol Layer", "sub": "Connection Router & Manager", "desc": "Maintains dedicated 1-to-1 connections to MCP servers, serializes JSON-RPC, and enforces security policies." },
                { "label": "4. MCP Servers", "sub": "PostgreSQL, GitHub, Local FS, Slack", "desc": "Independent processes exposing Tools, Resources, and Prompts over stdio or HTTP/SSE transports." }
            ]
        }
    },
    {
        "id": "mcp-host",
        "heading": "2. The MCP Host",
        "paragraphs": [
            "The MCP Host is the container application that the human user directly interacts with. Examples of MCP Hosts include Claude Desktop, Cursor IDE, Zed, Sourcegraph Cody, or a custom enterprise Python agent dashboard.",
            "The Host is responsible for rendering the chat user interface, managing window state, orchestrating theme and font settings, persisting session history, and spawning or connecting to MCP client instances.",
            "Importantly, the Host application defines the security boundary for the user. When a tool call requires confirmation, the Host renders the permission dialog prompt asking the user to approve or deny the action."
        ]
    },
    {
        "id": "host-vs-ai-model",
        "heading": "3. Host Versus AI Model",
        "paragraphs": [
            "Developers often lump the Host application and the AI Model together, but in protocol engineering, they perform distinct roles.",
            "The AI Model (such as Claude 3.5 Sonnet or GPT-4o) is an un-networked probabilistic reasoning engine. It does not know what process ID it is running under, has no access to operating system sockets, and cannot read local files directly.",
            "The Host Application is the native binary running on your machine or server. It wraps the AI Model, forwards user prompts to the model API, intercepts the model's structured tool calls, and routes them to the appropriate MCP Client for execution.",
            "In short: The AI Model decides WHAT action to take; the Host Application provides the environment and execution mechanisms to perform that action safely."
        ]
    },
    {
        "id": "mcp-client",
        "heading": "4. The MCP Client",
        "paragraphs": [
            "The MCP Client is a specialized, stateful protocol handler embedded inside the Host application.",
            "While a user may operate a single Host application, that Host creates a dedicated MCP Client instance for each active MCP Server connection.",
            "The MCP Client is responsible for: 1. Establishing transport channels (stdio pipes or HTTP/SSE sockets). 2. Initiating the protocol handshake (initialize request). 3. Discovering available tools, resources, and prompts (tools/list). 4. Serializing JSON-RPC 2.0 requests. 5. Deserializing responses and mapping request IDs. 6. Handling transport errors and reconnection logic."
        ]
    },
    {
        "id": "why-host-delegates-connections",
        "heading": "5. Why the Host Does Not Directly Implement Every Connection",
        "paragraphs": [
            "Why doesn't the main Host application handle all database and API connections directly in its monolithic codebase?",
            "1. Security Isolation: Placing database credentials and custom execution logic inside separate MCP Server processes prevents a bug in a community tool from crashing or compromising the main Host application.",
            "2. Language Agnosticism: A TypeScript Host application (like VS Code) can connect to a Python MCP server (using FastMCP) or a Go MCP server seamlessly over stdio pipes.",
            "3. Dynamic Extensibility: Users can add new MCP servers to their environment at runtime without recompiling or restarting their primary Host application."
        ]
    },
    {
        "id": "dedicated-client-server-connections",
        "heading": "6. Dedicated Client–Server Connections",
        "paragraphs": [
            "In MCP architecture, every connection between an MCP Client and an MCP Server is a 1-to-1, dedicated point-to-point stateful session.",
            "If an AI Host connects to 3 MCP Servers (e.g., GitHub Server, Postgres Server, and Filesystem Server), the Host instantiates 3 independent MCP Client objects.",
            "Client 1 communicates exclusively with GitHub Server over Pipe A; Client 2 communicates with Postgres Server over Pipe B; Client 3 communicates with Filesystem Server over Pipe C. There is zero cross-talk between servers. Server A cannot read or intercept data sent to Server B."
        ]
    },
    {
        "id": "mcp-server",
        "heading": "7. The MCP Server",
        "paragraphs": [
            "An MCP Server is an independent, executable software process or web service that exposes domain-specific capabilities to MCP Clients.",
            "An MCP Server implements the server side of the MCP specification. It listens for incoming JSON-RPC 2.0 requests, advertises its capabilities during initialization, and executes tool handlers when requested.",
            "MCP Servers can be lightweight local CLI utilities (written in Python or TypeScript) that launch on demand, or remote cloud microservices running inside Docker containers behind API gateways."
        ]
    },
    {
        "id": "complete-architecture-github-workflow",
        "heading": "8. Complete End-to-End Sequence Diagram",
        "paragraphs": [
            "Below is the complete end-to-end architectural sequence diagram tracing a user request from the User UI through Host, AI Model, MCP Client, MCP Server, GitHub API, and back to the User."
        ],
        "diagram": {
            "id": "complete-sequence-diagram",
            "title": "Complete End-to-End MCP Sequence Flow",
            "description": "Sequence diagram tracing message flow across User -> Host -> AI Model -> MCP Client -> MCP Server -> GitHub API -> Repository",
            "type": "sequence-diagram",
            "steps": [
                { "label": "1. User -> Host", "sub": "Prompt Submitted", "desc": "User submits prompt: 'Fix issue #42 in GitHub repository'." },
                { "label": "2. Host -> AI Model", "sub": "Forward Prompt & Tool Schemas", "desc": "Host forwards prompt along with cached tool list to LLM API." },
                { "label": "3. AI Model -> Host", "sub": "Tool Invocation Output", "desc": "LLM decides to call tool: github_get_issue(issue_number=42)." },
                { "label": "4. Host -> MCP Client", "sub": "Route Tool Request", "desc": "Host identifies GitHub server owner and passes request to GitHub MCP Client." },
                { "label": "5. MCP Client -> MCP Server", "sub": "JSON-RPC tools/call Request", "desc": "Client serializes request id=101 over stdio/SSE to GitHub MCP Server." },
                { "label": "6. MCP Server -> GitHub API", "sub": "HTTPS REST Call", "desc": "MCP Server executes GET /repos/owner/repo/issues/42 using OAuth token." },
                { "label": "7. GitHub API -> Repository", "sub": "Fetch Issue Record", "desc": "GitHub database retrieves issue record and returns JSON payload to MCP Server." },
                { "label": "8. Return Chain -> User", "sub": "Result Propagation", "desc": "Data returns: Server -> Client -> Host -> LLM -> Host -> User UI Response." }
            ]
        }
    },
    {
        "id": "connection-lifecycle",
        "heading": "9. Connection Lifecycle",
        "paragraphs": [
            "Every MCP connection follows a strictly ordered, four-phase connection lifecycle defined by the 2025-11-25 specification:",
            "Phase 1: Transport Establishment (Process spawn or HTTP connection).",
            "Phase 2: Initialization Sequence & Capability Negotiation (Handshake).",
            "Phase 3: Normal Operations (Tool calls, resource reads, notifications).",
            "Phase 4: Shutdown and Cleanup (Graceful termination)."
        ]
    },
    {
        "id": "initialization-sequence",
        "heading": "10. Initialization Sequence",
        "paragraphs": [
            "The initialization sequence is the mandatory handshake performed before any tool calls or resource queries can take place.",
            "1. The MCP Client sends an 'initialize' request to the server, passing client protocol version (e.g. '2025-11-25') and client capabilities.",
            "2. The MCP Server responds with its protocol version, server information, and supported capabilities (tools, resources, prompts, logging).",
            "3. The MCP Client sends an 'notifications/initialized' notification confirming readiness.",
            "Until the initialized notification is sent, the server will reject all tool execution requests."
        ],
        "code": {
            "language": "json",
            "filename": "mcp_initialize_handshake.json",
            "code": "// Client -> Server Request\n{\n  \"jsonrpc\": \"2.0\",\n  \"id\": 1,\n  \"method\": \"initialize\",\n  \"params\": {\n    \"protocolVersion\": \"2025-11-25\",\n    \"capabilities\": { \"roots\": { \"listChanged\": true } },\n    \"clientInfo\": { \"name\": \"ClaudeDesktop\", \"version\": \"1.4.0\" }\n  }\n}\n\n// Server -> Client Response\n{\n  \"jsonrpc\": \"2.0\",\n  \"id\": 1,\n  \"result\": {\n    \"protocolVersion\": \"2025-11-25\",\n    \"capabilities\": { \"tools\": { \"listChanged\": true }, \"resources\": {} },\n    \"serverInfo\": { \"name\": \"GitHub-MCP-Server\", \"version\": \"2.1.0\" }\n  }\n}"
        }
    },
    {
        "id": "capability-negotiation",
        "heading": "11. Capability Negotiation",
        "paragraphs": [
            "Capability Negotiation allows clients and servers with different feature sets or spec versions to communicate without breaking.",
            "During the initialize exchange, both parties advertise what features they support. For instance, a lightweight server might support tools but not resources or prompts.",
            "By inspecting the capability response, the MCP client learns exactly which features are available and avoids sending unsupported requests."
        ]
    },
    {
        "id": "normal-operations",
        "heading": "12. Normal Operations",
        "paragraphs": [
            "Once initialized, the session enters the Normal Operations phase.",
            "During this phase, the client can issue tools/list to discover tools, tools/call to execute a tool, resources/read to fetch resource content, or prompts/get to load a prompt template.",
            "Both client and server can also exchange bidirectional notifications (such as progress updates, logging messages, or listChanged alerts)."
        ]
    },
    {
        "id": "shutdown-and-cleanup",
        "heading": "13. Shutdown and Cleanup",
        "paragraphs": [
            "When the user closes the AI host application or disconnects a server, the session enters the Shutdown phase.",
            "For stdio transports, the host closes the standard input pipe (stdin) of the server process and sends SIGTERM, allowing the server process to release file handles and terminate cleanly.",
            "For HTTP/SSE transports, the client sends a DELETE request to close the active session endpoint."
        ]
    },
    {
        "id": "data-vs-transport-layer",
        "heading": "14. Data Layer Versus Transport Layer",
        "paragraphs": [
            "A key design principle of MCP is the clean architectural separation between the Data Layer and the Transport Layer.",
            "The Data Layer defines the semantic content of messages: JSON-RPC 2.0 request structures, tool schemas, resource URIs, and error object definitions.",
            "The Transport Layer defines how raw bytes move between processes: stdio pipes for local processes, or HTTP with Server-Sent Events (SSE) for remote network microservices.",
            "Because the Data Layer is completely independent of the Transport Layer, the exact same JSON-RPC payload works unchanged whether running over local stdin/stdout or over remote HTTPS connections."
        ]
    },
    {
        "id": "json-rpc-request-messages",
        "heading": "15. JSON-RPC Request Messages",
        "paragraphs": [
            "MCP uses the JSON-RPC 2.0 standard for all structured messages. A JSON-RPC Request message MUST contain four fields: jsonrpc (must be '2.0'), id (unique string or integer), method (string name of protocol method), and params (object containing parameters).",
            "Example JSON-RPC request for invoking a tool:"
        ],
        "code": {
            "language": "json",
            "filename": "jsonrpc_tools_call_request.json",
            "code": "{\n  \"jsonrpc\": \"2.0\",\n  \"id\": 42,\n  \"method\": \"tools/call\",\n  \"params\": {\n    \"name\": \"read_file\",\n    \"arguments\": {\n      \"path\": \"src/index.css\"\n    }\n  }\n}"
        }
    },
    {
        "id": "json-rpc-successful-responses",
        "heading": "16. JSON-RPC Successful Responses",
        "paragraphs": [
            "When a server successfully processes a request, it returns a JSON-RPC Successful Response object containing: jsonrpc: '2.0', id (matching the request ID), and result (an object containing the method's return data)."
        ],
        "code": {
            "language": "json",
            "filename": "jsonrpc_successful_response.json",
            "code": "{\n  \"jsonrpc\": \"2.0\",\n  \"id\": 42,\n  \"result\": {\n    \"content\": [\n      {\n        \"type\": \"text\",\n        \"text\": \"/* CSS Stylesheet Contents */\\nbody { margin: 0; }\"\n      }\n    ],\n    \"isError\": false\n  }\n}"
        }
    },
    {
        "id": "json-rpc-error-responses",
        "heading": "17. JSON-RPC Error Responses",
        "paragraphs": [
            "If a request fails due to invalid parameters, missing methods, or internal server errors, the server returns a JSON-RPC Error Response containing an error object with code, message, and optional data.",
            "Standard JSON-RPC 2.0 Error Codes used by MCP: -32700 (Parse error), -32600 (Invalid Request), -32601 (Method not found), -32602 (Invalid params), -32603 (Internal error)."
        ],
        "code": {
            "language": "json",
            "filename": "jsonrpc_error_response.json",
            "code": "{\n  \"jsonrpc\": \"2.0\",\n  \"id\": 43,\n  \"error\": {\n    \"code\": -32602,\n    \"message\": \"Invalid params: Parameter 'path' is required but missing.\"\n  }\n}"
        }
    },
    {
        "id": "json-rpc-notifications",
        "heading": "18. JSON-RPC Notifications",
        "paragraphs": [
            "A JSON-RPC Notification is a one-way message that does NOT contain an id field and does NOT expect a response.",
            "Notifications are used for asynchronous events, such as a server notifying the client that its tool list has changed (notifications/tools/list_changed), or streaming progress updates."
        ]
    },
    {
        "id": "request-id-correlation",
        "heading": "19. Request ID Correlation",
        "paragraphs": [
            "Because MCP operations are asynchronous, a client can issue multiple requests concurrently over the same transport channel without waiting for each response sequentially.",
            "The client assigns a unique integer or UUID string as the id for each outgoing request. When the server completes a request, it returns the exact same id in its response object.",
            "The client uses this id correlation to match incoming responses with their original caller promises in JavaScript or async futures in Python."
        ]
    },
    {
        "id": "bidirectional-communication",
        "heading": "20. Bidirectional Communication",
        "paragraphs": [
            "Unlike traditional client-server Web APIs where clients only send requests and servers only return responses, MCP supports true Bidirectional Communication.",
            "While the MCP Client typically initiates tool calls, an MCP Server can also initiate requests back to the Client (such as requesting file system roots via roots/list or requesting an LLM completion via sampling/create_message)."
        ]
    },
    {
        "id": "progress-and-logging-notifications",
        "heading": "21. Progress and Logging Notifications",
        "paragraphs": [
            "For long-running tool executions (such as running a test suite or scanning a database), MCP servers send progress notifications to keep the user informed.",
            "The server emits $/progress notifications containing progress (e.g. 50) and total (e.g. 100), which the AI host application renders as a visual progress bar in the UI."
        ]
    },
    {
        "id": "roots-and-sampling-previews",
        "heading": "22. Roots and Sampling Previews",
        "paragraphs": [
            "Two advanced capabilities defined in the MCP 2025-11-25 specification are Roots and Sampling:",
            "1. Roots (roots/list): Allows MCP servers to query the client host to discover which directories or workspace folders the user has opened in their IDE.",
            "2. Sampling (sampling/create_message): Allows an MCP server to request an LLM completion back from the host application, enabling nested AI reasoning inside a server workflow."
        ]
    },
    {
        "id": "local-mcp-servers",
        "heading": "23. Local MCP Servers",
        "paragraphs": [
            "Local MCP Servers run directly as child processes on the developer's workstation.",
            "They launch via command-line strings configured in the host's settings file (e.g. `python -m mcp_server_postgres` or `node build/index.js`).",
            "Local servers communicate over stdio streams. They offer zero network latency, run offline, and have direct access to local system resources bounded by operating system file permissions."
        ]
    },
    {
        "id": "remote-mcp-servers",
        "heading": "24. Remote MCP Servers",
        "paragraphs": [
            "Remote MCP Servers run on remote cloud infrastructure, virtual machines, or Kubernetes clusters.",
            "They allow enterprise teams to share central MCP services across the organization without installing dependencies on every developer laptop.",
            "Remote servers operate over HTTPS using Server-Sent Events (SSE) for server-to-client streaming, paired with HTTP POST endpoints for client-to-server requests."
        ]
    },
    {
        "id": "stdio-preview",
        "heading": "25. stdio Transport Preview",
        "paragraphs": [
            "The stdio (Standard Input/Output) transport is the default transport for local MCP servers.",
            "The client host spawns the server child process and connects to its stdin (for sending requests) and stdout (for reading responses). Messages are delimited by newline characters (`\\n`).",
            "Crucially, the server MUST NOT print raw debug logs to stdout, as doing so would corrupt the JSON-RPC message stream. All server debug logging MUST be redirected to stderr or sent via protocol logging notifications."
        ]
    },
    {
        "id": "streamable-http-preview",
        "heading": "26. Streamable HTTP Preview",
        "paragraphs": [
            "The Streamable HTTP transport (using Server-Sent Events) powers remote MCP connections over standard web protocols.",
            "1. The client opens a persistent SSE connection to GET /sse. The server responds with a unique session endpoint URI in an 'endpoint' event.",
            "2. The client sends JSON-RPC requests via HTTP POST to that session endpoint URI.",
            "3. The server streams JSON-RPC responses and notifications back to the client over the persistent SSE connection stream."
        ]
    },
    {
        "id": "connection-failure-examples",
        "heading": "27. Connection-Failure Examples",
        "paragraphs": [
            "Robust protocol implementations must gracefully handle network and execution failures. Below are six beginner-friendly failure examples and their resolution behaviors:",
            "Example 1: MCP Server Unavailable (Process Crash or Offline Host).\nBehavior: The MCP Client detects closed stdio pipe or HTTP connection timeout. It notifies the host UI and marks the server status as 'Disconnected'. The AI model continues operating using remaining active servers.",
            "Example 2: Requested Tool Is Missing or Renamed.\nBehavior: Server returns error code -32601 (Method not found). The client relays the error to the LLM, which explains to the user that the tool is unavailable.",
            "Example 3: Authentication Fails (Invalid API Key or Expired OAuth Token).\nBehavior: Remote HTTP server returns 401 Unauthorized. The MCP Client triggers an authentication prompt in the Host UI asking the user to refresh their credentials.",
            "Example 4: Invalid Tool Parameters Provided by LLM.\nBehavior: Server schema validation rejects the payload with error code -32602 (Invalid params). The LLM reads the validation error message and automatically retries with corrected parameters.",
            "Example 5: Tool Execution Takes Too Long (Timeout).\nBehavior: Client enforces a configurable timeout (e.g. 30 seconds). If the server does not respond or send progress updates, the client cancels the request ID and returns a timeout error to the LLM.",
            "Example 6: One Connected Server Fails While Others Remain Available.\nBehavior: MCP isolates connections. If the Postgres server crashes, the GitHub and Filesystem servers continue operating normally with zero interruption."
        ]
    },
    {
        "id": "common-architecture-mistakes",
        "heading": "28. Common Architecture Mistakes",
        "paragraphs": [
            "Avoid these five common architectural traps when building MCP systems:",
            "1. Printing debug print() statements to stdout in stdio servers (corrupts JSON-RPC stream).",
            "2. Blocking the main event loop during long-running tool operations.",
            "3. Forgetting to handle client cancellation notifications ($/cancel_request).",
            "4. Hardcoding host file paths in tool parameter schemas instead of accepting dynamic parameters.",
            "5. Omitting input schema descriptions, causing the LLM to guess parameter formats incorrectly."
        ]
    },
    {
        "id": "interactive-architecture-challenge",
        "heading": "29. Interactive Architecture Challenge",
        "paragraphs": [
            "Architecture Design Challenge: System Recovery Scenario.",
            "Question: An MCP host is connected to a local SQLite MCP server over stdio. Mid-conversation, a background system cleaner process kills the SQLite server process (SIGKILL). What sequence of events should occur to recover safely?",
            "Correct Solution Pattern:",
            "1. The MCP Client detects stdout pipe closure (EOF).",
            "2. The Client emits a server-disconnected status event to the Host UI.",
            "3. Pending request IDs are failed with a Connection Error code.",
            "4. The Host attempts automatic background process re-spawn up to 3 retries.",
            "5. Once re-spawned, the Client executes the initialize handshake again and restores active session state."
        ]
    },
    {
        "id": "architecture-checkpoint-quiz",
        "heading": "30. Interactive Architecture Quiz (7 Questions)",
        "paragraphs": [
            "Test your knowledge of MCP Architecture across host boundaries, lifecycle phases, and JSON-RPC protocol messages."
        ],
        "quizzes": [
            {
                "id": "quiz-arch-1",
                "question": "What is the primary role of the MCP Client component?",
                "options": [
                    "To generate code using neural network weights",
                    "To render the chat UI theme and CSS styles",
                    "To manage 1-to-1 stateful connections, initialize handshakes, and route JSON-RPC messages to servers",
                    "To replace the operating system kernel"
                ],
                "correctIndex": 2,
                "explanation": "The MCP Client handles transport connections, protocol handshakes, schema parsing, and JSON-RPC message routing."
            },
            {
                "id": "quiz-arch-2",
                "question": "Why must local stdio MCP servers NEVER print raw debug logs to stdout?",
                "options": [
                    "Because stdout is restricted by operating system security policies",
                    "Because raw stdout prints corrupt the JSON-RPC message stream formatted with newline delimiters",
                    "Because stdout uses twice as much memory as stderr",
                    "Because stdout only supports uppercase letters"
                ],
                "correctIndex": 1,
                "explanation": "stdio transports use stdout strictly for JSON-RPC payloads. Non-JSON debug output on stdout breaks message parsing. Debug logs must use stderr or logging notifications."
            },
            {
                "id": "quiz-arch-3",
                "question": "Which JSON-RPC 2.0 error code indicates 'Method not found'?",
                "options": [
                    "-32700",
                    "-32601",
                    "-32602",
                    "-32603"
                ],
                "correctIndex": 1,
                "explanation": "Under the JSON-RPC 2.0 standard, code -32601 signifies Method Not Found."
            },
            {
                "id": "quiz-arch-4",
                "question": "What happens if one connected MCP server crashes while 2 other servers are active?",
                "options": [
                    "The entire AI host application crashes immediately",
                    "All 3 servers are deleted from the disk",
                    "The failed server connection is isolated and marked offline, while the remaining 2 servers continue operating normally",
                    "The computer reboots"
                ],
                "correctIndex": 2,
                "explanation": "MCP maintains isolated 1-to-1 client-server connections. A failure in one server does not impact other active server connections."
            },
            {
                "id": "quiz-arch-5",
                "question": "What transport does a remote MCP server running in the cloud typically use?",
                "options": [
                    "stdio pipes",
                    "HTTP with Server-Sent Events (SSE) and HTTP POST endpoints",
                    "Bluetooth Low Energy",
                    "USB-C hardware cables"
                ],
                "correctIndex": 1,
                "explanation": "Remote MCP servers operate over HTTPS using Server-Sent Events (SSE) for streaming and HTTP POST for incoming requests."
            },
            {
                "id": "quiz-arch-6",
                "question": "How does an MCP Client match an incoming async response with its original request caller?",
                "options": [
                    "By guessing based on response timestamp",
                    "By checking the unique 'id' field in the JSON-RPC payload",
                    "By closing and reopening the transport connection",
                    "By asking the user to manually verify the ID"
                ],
                "correctIndex": 1,
                "explanation": "JSON-RPC request ID correlation maps each response object's 'id' field directly back to the original request ID."
            },
            {
                "id": "quiz-arch-7",
                "question": "What notification phase must complete before an MCP server will accept tool execution calls?",
                "options": [
                    "notifications/initialized",
                    "notifications/shutdown",
                    "notifications/cancel_request",
                    "notifications/progress"
                ],
                "correctIndex": 0,
                "explanation": "The client must send the 'notifications/initialized' message after the initialize response to complete the handshake phase."
            }
        ]
    },
    {
        "id": "architecture-key-takeaways",
        "heading": "31. Architecture Key Takeaways",
        "paragraphs": [
            "Congratulations on completing Part 2 of Module 1: MCP Architecture! Here is a summary of the core architecture concepts:"
        ],
        "bullets": [
            "Four Core Actors: User (UI), Host (Application Container), AI Model (Reasoning Engine), MCP Client/Server (Protocol Connection).",
            "1-to-1 Isolation: Every MCP server connection is a dedicated, isolated stateful session with zero cross-server data leakage.",
            "JSON-RPC 2.0 Standard: All protocol payloads use structured JSON-RPC 2.0 requests, responses, errors, and notifications.",
            "4-Phase Lifecycle: Connection follows Transport -> Initialization Handshake -> Normal Operations -> Shutdown.",
            "Transport Agnostic: The same JSON-RPC data layer works over local stdio pipes and remote HTTP/SSE streaming web endpoints."
        ]
    }
]

# Write out full mcpContent.ts file
full_code = f"""export type CalloutType =
  | "beginner-explanation"
  | "developer-deep-dive"
  | "important"
  | "security-note"
  | "common-mistake"
  | "try-it-yourself";

export type CalloutData = {{
  type: CalloutType;
  title: string;
  content: string;
}};

export type DiagramType =
  | "usb-c"
  | "host-client-server"
  | "github-flow"
  | "without-vs-with"
  | "brain-and-hands"
  | "json-rpc"
  | "scenario-1-github"
  | "scenario-2-docs"
  | "scenario-3-cms"
  | "sequence-diagram"
  | "failure-example";

export type DiagramData = {{
  id: string;
  title: string;
  description: string;
  type: DiagramType;
  steps?: {{ label: string; sub?: string; desc: string }}[];
  nodes?: {{ name: string; role: string; highlight?: boolean }}[];
}};

export type QuizQuestion = {{
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}};

export type CodeSnippet = {{
  language: string;
  filename?: string;
  code: string;
}};

export type ArticleSection = {{
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  callout?: CalloutData;
  diagram?: DiagramData;
  code?: CodeSnippet;
  table?: {{
    headers: string[];
    rows: string[][];
  }};
  quiz?: QuizQuestion;
  quizzes?: QuizQuestion[];
}};

export type ArticleData = {{
  slug: string;
  title: string;
  seoTitle: string;
  metaDescription: string;
  moduleName: string;
  moduleNumber: number;
  partLabel: string;
  difficulty: "Beginner" | "Beginner to Developer";
  readingTime: string;
  lastUpdated: string;
  openingSummary: string;
  whatYouWillLearn: string[];
  sections: ArticleSection[];
  keyTakeaways: string[];
  prevRoute?: {{ slug: string; title: string }};
  nextRoute?: {{ slug: string; title: string }};
}};

export type CourseModule = {{
  id: string;
  number: number;
  title: string;
  isLocked?: boolean;
  topics: {{
    id: string;
    title: string;
    slug: string;
    isLocked?: boolean;
    readingTime?: string;
  }}[];
}};

export function calculateArticleWordCount(article: ArticleData): number {{
  let count = 0;
  count += article.title.split(/\\s+/).filter(Boolean).length;
  count += article.openingSummary.split(/\\s+/).filter(Boolean).length;
  for (const item of article.whatYouWillLearn) {{
    count += item.split(/\\s+/).filter(Boolean).length;
  }}
  for (const sec of article.sections) {{
    count += sec.heading.split(/\\s+/).filter(Boolean).length;
    for (const p of sec.paragraphs) {{
      count += p.split(/\\s+/).filter(Boolean).length;
    }}
    if (sec.bullets) {{
      for (const b of sec.bullets) {{
        count += b.split(/\\s+/).filter(Boolean).length;
      }}
    }}
    if (sec.callout) {{
      count += sec.callout.title.split(/\\s+/).filter(Boolean).length;
      count += sec.callout.content.split(/\\s+/).filter(Boolean).length;
    }}
    if (sec.quiz) {{
      count += sec.quiz.question.split(/\\s+/).filter(Boolean).length;
      for (const o of sec.quiz.options) {{
        count += o.split(/\\s+/).filter(Boolean).length;
      }}
      count += sec.quiz.explanation.split(/\\s+/).filter(Boolean).length;
    }}
    if (sec.quizzes) {{
      for (const q of sec.quizzes) {{
        count += q.question.split(/\\s+/).filter(Boolean).length;
        for (const o of q.options) {{
          count += o.split(/\\s+/).filter(Boolean).length;
        }}
        count += q.explanation.split(/\\s+/).filter(Boolean).length;
      }}
    }}
    if (sec.table) {{
      for (const h of sec.table.headers) {{
        count += h.split(/\\s+/).filter(Boolean).length;
      }}
      for (const row of sec.table.rows) {{
        for (const cell of row) {{
          count += cell.split(/\\s+/).filter(Boolean).length;
        }}
      }}
    }}
  }}
  for (const kt of article.keyTakeaways) {{
    count += kt.split(/\\s+/).filter(Boolean).length;
  }}
  return count;
}}

export function getCalculatedReadingTime(article: ArticleData): string {{
  const words = calculateArticleWordCount(article);
  const minutes = Math.max(1, Math.round(words / 220));
  return `${{minutes}} min read`;
}}

export const courseModulesData: CourseModule[] = [
  {{
    id: "module-1",
    number: 1,
    title: "MCP Fundamentals and Architecture",
    isLocked: false,
    topics: [
      {{
        id: "topic-1-1",
        title: "Part 1: MCP Fundamentals (What Is MCP & Why AI Needs Tools)",
        slug: "/mcp/fundamentals",
        isLocked: false,
        readingTime: "13 min read",
      }},
      {{
        id: "topic-1-2",
        title: "Part 2: MCP Architecture (Host, Client, and Server Visually)",
        slug: "/mcp/architecture",
        isLocked: false,
        readingTime: "16 min read",
      }},
    ],
  }},
  {{
    id: "module-2",
    number: 2,
    title: "Building MCP Servers in Python",
    isLocked: true,
    topics: [
      {{ id: "topic-2-1", title: "Setting Up FastMCP & Dependencies", slug: "#", isLocked: true }},
      {{ id: "topic-2-2", title: "Defining Tools, Prompts & Resources", slug: "#", isLocked: true }},
      {{ id: "topic-2-3", title: "Exposing Local Files & SQLite DBs", slug: "#", isLocked: true }},
    ],
  }},
  {{
    id: "module-3",
    number: 3,
    title: "Connecting MCP Clients & Hosts",
    isLocked: true,
    topics: [
      {{ id: "topic-3-1", title: "Configuring Claude Desktop & Cursor", slug: "#", isLocked: true }},
      {{ id: "topic-3-2", title: "Building a Custom TypeScript Client", slug: "#", isLocked: true }},
      {{ id: "topic-3-3", title: "Managing Connections & Lifecycle", slug: "#", isLocked: true }},
    ],
  }},
  {{
    id: "module-4",
    number: 4,
    title: "JSON-RPC Protocol Deep Dive",
    isLocked: true,
    topics: [
      {{ id: "topic-4-1", title: "Requests, Responses & Notifications", slug: "#", isLocked: true }},
      {{ id: "topic-4-2", title: "Capability Negotiation & Handshake", slug: "#", isLocked: true }},
      {{ id: "topic-4-3", title: "Error Codes & Exception Handling", slug: "#", isLocked: true }},
    ],
  }},
  {{
    id: "module-5",
    number: 5,
    title: "Production Deployment & Security",
    isLocked: true,
    topics: [
      {{ id: "topic-5-1", title: "stdio vs Streamable HTTP SSE Transports", slug: "#", isLocked: true }},
      {{ id: "topic-5-2", title: "OAuth 2.0 & Token Authentication", slug: "#", isLocked: true }},
      {{ id: "topic-5-3", title: "Rate Limiting & Sandboxing Servers", slug: "#", isLocked: true }},
    ],
  }},
  {{
    id: "module-6",
    number: 6,
    title: "Building Real-World AI Agents",
    isLocked: true,
    topics: [
      {{ id: "topic-6-1", title: "Multi-Server Workflows with Claude", slug: "#", isLocked: true }},
      {{ id: "topic-6-2", title: "Human-in-the-Loop Approval Patterns", slug: "#", isLocked: true }},
      {{ id: "topic-6-3", title: "Monitoring, Tracing & Debugging MCP", slug: "#", isLocked: true }},
    ],
  }},
];
"""

print("Base structure ready.")
