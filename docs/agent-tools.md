# Business tools

| Tool                   | Behavior                                       | Write policy                                                          |
| ---------------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| searchKnowledge        | FTS5 search, enabled entries, bounded snippets | Read only                                                             |
| getBusinessInformation | Configured contact, services and hours         | Read only                                                             |
| captureLead            | Stores a contact request with status `new`     | Visitor submits validated form with consent                           |
| requestAppointment     | Stores preferences with status `pending`       | Visitor submits validated form; business-local date cannot be in past |
| requestHumanHandoff    | Writes inbox action and sets `needs_attention` | Scoped visitor or model request; no notification                      |

Model contact/appointment calls return an instruction to use the form, never success at persistence. The public action endpoint runs `executeTool` with confirmation established by that form submission. All execution reloads enabled tools from D1. Invalid arguments, expired/missing conversations, disabled tools, or tool rate exhaustion fail before writes. The normalized input plus conversation and tool form a deterministic action ID. Repeated identical submissions return the original ID; no new row is created. To submit a genuinely separate request with identical details, start a new conversation.

Support requests use human handoff rather than a separate ticketing subsystem. Lead qualification means recording the visitor's expressed service interest; no fabricated qualification score is produced. No outgoing mail/SMS or external calendar is connected. Only admin API routes can set appointment status to confirmed.

To add a tool: define a Zod input schema, register its name in the shared configuration enum, add permission/policy checks in the executor, expose the appropriate AI SDK tool, and test failures as well as writes. Never dispatch a model-selected arbitrary function name or execute downloaded code.
