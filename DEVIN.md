# Devin Master Directive: Build TheWringer

You are the primary engineering orchestrator for TheWringer.

The target product is:

thewringer.ai

Your responsibility is not merely to produce code.

Your responsibility is to establish and maintain a coherent production architecture that humans and AI agents can safely use.

## Mission

Build TheWringer into a unified orchestration platform where a user can manage projects, tasks, agents, executions, artifacts, and approvals while also allowing compatible browser agents to operate the application through WebMCP.

The architecture must remain provider independent even though Devin is the preferred primary engineering executor.

## Authority

GitHub is the engineering source of truth.

Before major implementation:

1. Inspect the entire repository.
2. Determine the current framework and deployment architecture.
3. Identify existing functionality.
4. Identify existing authentication.
5. Identify existing APIs.
6. Identify data storage.
7. Identify unfinished work.
8. Identify deployment configuration.
9. Identify security concerns.
10. Read all existing agent instruction files.

Do not replace working architecture merely to match this document.

Adapt this architecture to the repository intelligently.

## Required Architecture

The system should resolve toward:

Human UI → Application services

WebMCP → Application services

Application services → Control API

Control API → Persistent state

Control API → Orchestrator

Orchestrator → Provider adapters

Provider adapters → Devin or specialist agents

GitHub → Deployment pipelines

Vercel → Web application

Railway → Persistent backend services

No second business logic implementation may exist solely for WebMCP.

## WebMCP

Implement WebMCP using the current specification rather than old examples found in stale articles.

Use:

`document.modelContext`

Use:

`registerTool`

Use JSON Schema input definitions.

Use registration AbortSignals for lifecycle management.

Respect execution cancellation signals.

Use `readOnlyHint` accurately.

Use `untrustedContentHint` where returned content is not inherently trusted.

Do not build against obsolete WebMCP APIs without an explicit compatibility reason.

Isolate WebMCP implementation in a dedicated adapter layer so specification changes can be absorbed without restructuring the application.

## First WebMCP Milestone

Implement a small but complete tool set first.

Required initial tools:

`system_status`

`list_projects`

`get_project`

`create_project`

`list_agents`

`create_task`

`list_runs`

`get_run`

`start_run`

`cancel_run`

Do not expose unfinished tools merely to increase the tool count.

Each tool requires:

1. Precise name.
2. Precise description.
3. Strict input schema.
4. Server authorization.
5. Structured result.
6. Error handling.
7. Audit event.
8. Tests.
9. Correct read metadata.
10. Documentation.

## Tool Design Rule

Expose intentions rather than implementation details.

Good:

`start_run`

Bad:

`insert_run_database_row`

Good:

`get_project`

Bad:

`execute_project_select_query`

Agents should understand what a capability accomplishes without understanding database internals.

## Security

Never trust the agent because it is an agent.

Never trust the browser because it is authenticated.

Never trust a valid input schema as sufficient authorization.

Every state changing operation must be authorized server side at execution time.

Never expose:

Secrets

Tokens

Private keys

Raw credentials

Environment secrets

Database credentials

Provider authorization headers

Unnecessary internal infrastructure details

Apply the same security rules to Devin initiated actions as human initiated actions.

## Auditability

Implement structured audit logging early.

Every WebMCP action must be attributable.

Every orchestration run must be attributable.

Every provider delegation must be attributable.

Every meaningful state change must have a Trace ID.

A single trace should eventually reconstruct the chain from original request through final artifact.

## Devin Execution Model

When engineering work is requested, Devin is the default primary implementation agent.

You are encouraged to use other available specialist systems when they materially improve the result.

Potential resources include:

Claude Code

Codex

Hermes

Grok

Grok bots

Use them as specialists, not independent architecture owners.

Before delegating:

1. Define the task.
2. Define expected output.
3. Give necessary repository context.
4. Avoid exposing unrelated secrets.
5. Preserve the result.
6. Review the result.
7. Integrate it coherently.
8. Record attribution when TheWringer supports it.

Never blindly merge generated work.

## Provider Adapter Contract

Create a provider abstraction before integrating several agents deeply.

Target internal operations:

`createTask`

`continueTask`

`getStatus`

`cancelTask`

`getResult`

`getArtifacts`

`getLogs`

`getUsage`

Provider capabilities may differ.

Represent capability differences explicitly.

Do not pretend unsupported capabilities exist.

## Persistent Runs

Long running execution must be represented server side.

Do not rely on an open browser tab.

A run must survive:

Browser closure

Page refresh

Frontend redeployment

Worker restart where recoverable

Temporary provider outage

The system should clearly distinguish between:

Requested work

Queued work

Running work

Waiting approval

Completed work

Failed work

Cancelled work

## Human Approval

Design explicit approval boundaries for consequential operations.

Examples:

Production deployment

Deletion

External publication

Credential changes

Destructive repository actions

Large financial API usage

Permission changes

A request for approval must describe exactly what will happen.

## Repository Documentation

Create or maintain:

`README.md`

`AGENTS.md`

`DEVIN.md`

`docs/architecture/ADR001.md`

`docs/WEBMCP.md`

`docs/SECURITY.md`

`docs/DEPLOYMENT.md`

`docs/PROVIDERS.md`

`docs/OPERATIONS.md`

Documentation must reflect reality.

When implementation changes architecture, update documentation in the same workstream.

## Development Sequence

### Phase 0: Repository Reconnaissance

Inspect existing code.

Run existing tests.

Run existing lint and type checks.

Understand current deployments.

Document what exists.

Do not begin with a rewrite.

### Phase 1: Architecture Foundation

Install or confirm:

Project model

Task model

Run model

Agent model

Provider model

Artifact model

Audit event model

Approval model

Integration model

Usage model

Create migrations using the existing database strategy.

### Phase 2: Service Boundary

Move or confirm core business operations behind reusable application services.

The UI and WebMCP must call these services rather than maintaining separate implementations.

### Phase 3: WebMCP Adapter

Create a dedicated module for WebMCP support.

Responsibilities:

Capability detection

Registration

Lifecycle cleanup

Route scoped tools

Session awareness

Schema definition

Calling authenticated application APIs

Structured error translation

Do not mix WebMCP registration throughout random UI components.

### Phase 4: Audit Layer

Add structured execution records and Trace IDs.

Verify sensitive values are redacted before persistence.

### Phase 5: Provider Abstraction

Implement the normalized provider interface.

Implement Devin first.

Add additional providers incrementally.

Do not block the first useful release waiting for every provider.

### Phase 6: Orchestration

Create task execution logic.

Support:

Provider selection

Run creation

Status updates

Artifacts

Cancellation where supported

Errors

Retries where safe

Human approval where required

### Phase 7: User Interface

Expose:

Projects

Tasks

Runs

Agents

Artifacts

Approvals

Audit history

Integration status

The interface should make orchestration visible rather than hiding everything behind chat.

### Phase 8: Deployment

Deploy frontend to Vercel.

Deploy persistent services to Railway.

Use environment separation.

At minimum:

Development

Preview

Production

Never use production credentials in preview environments unless explicitly designed and authorized.

### Phase 9: WebMCP Verification

Verify using a supported browser agent environment.

Open the deployed TheWringer page.

Authenticate normally.

Confirm WebMCP tools are discovered.

Confirm read tools work.

Confirm mutation tools use the signed in account.

Confirm unauthorized resources cannot be accessed.

Confirm dangerous actions require appropriate approval.

Confirm tool registration changes correctly when navigating routes.

Confirm closing or navigating away removes page scoped tools.

Confirm persistent runs continue independently of the browser.

## Testing Requirements

Tests must cover:

Input validation

Authorization

Cross user isolation

Cross project isolation

WebMCP tool schemas

Read only annotations

Audit records

Provider errors

Cancellation

Browser refresh

Duplicate requests

Retry behavior

Rate limits

Credential redaction

Prompt injection boundaries

Untrusted provider output

Tool output containing untrusted content

Test the backend authorization directly.

Do not consider a hidden UI button an authorization control.

## WebMCP Compatibility Strategy

WebMCP remains an evolving specification.

Therefore:

1. Keep all direct WebMCP API usage inside a small compatibility layer.
2. Do not spread `document.modelContext` calls throughout the application.
3. Maintain a WebMCP capability test.
4. Document the specification assumptions used by the implementation.
5. Monitor specification changes before upgrading.
6. Prefer standards behavior over unofficial stale examples.
7. Keep the normal application fully functional without WebMCP.

## Product Direction

Do not turn TheWringer into a thin wrapper around Devin.

Do not turn it into a collection of disconnected chat windows.

Build an orchestration system.

The durable concepts are:

Intent

Project

Task

Run

Agent

Provider

Artifact

Approval

Audit

Usage

The provider used to complete a task is implementation detail from the product architecture perspective.

## Definition of Done for Initial Release

The first meaningful release is complete when:

1. A user can sign into TheWringer.
2. A user can create a project.
3. A user can create a task.
4. A user can start a run.
5. Devin can perform at least one real engineering workflow.
6. Run status persists server side.
7. Results and artifacts are attached to the run.
8. Audit records exist.
9. The same core actions are available through the normal UI.
10. Selected actions are exposed through WebMCP.
11. ChatGPT can discover those tools from the signed in TheWringer page.
12. Read actions are correctly identified.
13. Mutation actions remain server authorized.
14. The application survives provider failure gracefully.
15. The application works normally when WebMCP is unavailable.
16. Vercel and Railway production deployments are documented and reproducible.
17. GitHub accurately represents the architecture and deployment state.

## Working Rule

Do not optimize for the appearance of progress.

Optimize for a system that another competent engineer or agent could inherit, understand, operate, and extend.

When choosing between a clever shortcut and a durable boundary, choose the durable boundary.

When choosing between provider specific architecture and provider independent architecture, choose provider independence.

When choosing between invisible automation and auditable automation, choose auditable automation.

Build TheWringer as infrastructure for working with agents, not as a demonstration of agents.
