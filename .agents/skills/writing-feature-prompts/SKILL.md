---
name: writing-feature-prompts
description: Write a ready-to-run implementation prompt for a feature request or a bug fix in the current repository and save it outside the repo. A feature prompt runs whatever design, requirements, documentation and incremental test-first implementation phases the repo's own rules call for, end to end, without stopping. A bug-fix prompt runs reproduce, root cause, fix and doc alignment. Use whenever the user asks to "create a prompt", "write a prompt for this feature" or "for this bug", or wants a "prompt to build X" or "prompt to fix Y".
---

# Writing feature prompts

Turn a feature request or a bug report into one prompt that another agent can run from start to finish. The
prompt directs the work. Do not design the solution here.

The skill is project- and platform-agnostic. Never assume a stack, folder layout, tool or skill name. Learn them
from the repository, and use only what exists.

## Steps

1. **Gather context (read-only, quick).**
   - Read the repo's agent instructions (`AGENTS.md`, `CLAUDE.md`, `README`, contributing docs) to learn its
     rules, mandatory workflow, test approach, doc locations, branch/PR conventions and the commands for
     build, test and lint.
   - List the skills available to the agent (for example `.claude/skills/`, `.agents/skills/`) and note which
     ones match a phase of the work.
   - Grep for what the request touches: the relevant code, tests, docs, specs, designs, ADRs and the next free
     requirement number if the repo numbers them. Name real paths in the prompt.
2. **Choose the template:** Feature or Bug fix (below).
3. **Decide the phases from the repo, not from this file.** Include a phase only if the repo has that artifact
   or rule (for example mocks, a design system, requirements, detailed designs, ADRs, estimates, changelog).
   Order them as the repo's rules require. Name the repo skill for a phase when one exists.
4. **Write the prompt** to `<scratchpad>/<kebab-slug>-prompt.md`. Use the session's scratchpad directory if one
   is given, otherwise the OS temp directory (`$TMPDIR`, `%TEMP%`, or `/tmp`). Never write it into the
   repository.
5. **Open it for the user only if that is possible and wanted.** Pick the opener for the platform: `open` on
   macOS, `xdg-open` on Linux, `Start-Process` on Windows. In a headless or cloud session, skip this step.
6. **Reply** with the prompt's full absolute path and a brief summary of what it covers. In a session where the
   user can't open local files, also include the prompt text.

## Writing rules

- Fill in real paths, names and requirement numbers. Leave no `<placeholders>` in the finished prompt.
- Keep to what the user asked for. Put anything nearby under "deferred", not into the scope.
- List states and slices as suggestions the implementer can adjust.
- Write in plain, short sentences.
- Write commands and paths so they work on any OS: forward slashes, no shell-specific syntax unless the repo
  is tied to one shell. State the required runtime versions only if the repo states them.

## Shared sections (use in both templates, verbatim apart from the noun)

```markdown
## Finish the whole <feature|fix> in one run. Do not stop. (CRITICAL)

- You are authorised to take this <feature|fix> all the way: <the phases>, green tests and a PR. Go through
  every phase and every slice in one continuous run. Do not pause between phases to report, ask for approval,
  or wait for "continue".
- Do not end your turn until the "Done means" list at the bottom is fully true. A partial result, a plan, or
  "the next steps would be..." is not done.
- Where the repo's instructions say "stop and ask", treat this prompt as the confirmation in advance for
  everything in scope here. Choose the simplest option that fits the existing architecture, record it (an ADR
  or the design's open-questions section, if the repo has them), and keep going.
- If a shared library, component or design asset lacks something, that is not a reason to stop. Update it
  first, as the repo's rules require, then go on.
- When a test, build or command fails, find the root cause and fix it, then go on. Never weaken a test to make
  it pass, and never skip a step quietly.
- Only stop for a real blocker you cannot resolve yourself, such as missing credentials, or an action outside
  this repo that can't be undone, such as production deploys or data changes. If that happens, finish
  everything else first, then report the blocker clearly.
- Keep track of progress (a todo list), so that nothing gets left out after context is summarised.

## Rules (read first, binding)

- Follow the repo's agent instructions exactly, especially: <the specific rules found in step 1, such as scope
  limits, mandatory libraries, test approach, naming and file conventions, banned practices>.
- Work through the phases below **in order**, using the repo skill each phase names.
- Copy the house style of each folder. Read the existing neighbours before you write anything new.
```

## Feature template

```markdown
# Feature: <title>

## Goal

<What the user sees and can do, who can do it, where it appears today (real files), and what stays unchanged.>

<Shared sections>

## Phase N: <artifact the repo requires before code, e.g. mocks / requirements / design / ADR> (`<repo skill>`)
- <What to add or update, with real paths. Cover the states, behaviours, validation, and security and privacy
  concerns. Cross-reference existing requirements instead of copying them.>
(Repeat for each phase the repo's rules require, in the required order.)

## Phase N: Incremental implementation (`<repo skill, if any>`, test-first)
- Plan thin vertical slices, for example:
  1. <slice>
  2. <slice>
- For each slice:
  - Write the Given-When-Then criteria.
  - Write the acceptance test, following the repo's test approach and locations.
  - Run it and show that it fails for the expected reason.
  - Implement the minimum that makes it pass, and refactor while the tests are green.
  - Run the regression checks, then commit.
- When all slices are green, bring any progress tracking (estimates, changelog, docs) to its true state and
  keep the design artifacts aligned with what was built.

## Done means
- <The behaviour, stated end to end.>
- All the new and existing tests pass, using the repo's test commands.
- Docs and design artifacts agree with the code.
- The work is on a branch with a PR to the repo's default branch, following its conventions. Fetch and rebase
  onto the default branch first, because another session may have pushed to it.
- Only then end the run, with a short summary of what was built, the decisions made along the way, and
  anything deferred.
```

## Bug-fix template

```markdown
# Bug fix: <title>

## Bug

<What happens, what should happen, how to reproduce it, and where it lives (real files). The requirement it
breaks, if the repo tracks them.>

<Shared sections>

## Phase 1: Reproduce
- Write a failing test that shows the bug, at the level the repo's test approach calls for. Run it and show
  that it fails for the bug's reason.

## Phase 2: Root cause
- Find and state the cause, not the symptom. Check for the same cause elsewhere.

## Phase 3: Fix
- Make the smallest change that turns the test green. Refactor while it is green, run the regression checks,
  then commit.

## Phase 4: Align the docs (only if the behaviour or the spec was wrong or silent)
- Update the requirements, designs or other docs the repo keeps so they match.

## Done means
- The bug is gone, and the new test proves it.
- All the existing tests pass, using the repo's test commands.
- The work is on a branch with a PR to the repo's default branch. Fetch and rebase onto it first.
- Only then end the run, with a short summary of the cause, the fix and anything deferred.
```
