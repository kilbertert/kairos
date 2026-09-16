# Kairos

Kairos is a local-first time-management app: a Pomodoro timer, task management,
and a focus history, with no account and no backend. This file fixes the
vocabulary; it is a glossary, not a specification.

## Language

**Project**:
A container that groups tasks. Created by the user, may be starred, and carries a
task count and completion progress.
_Avoid_: Board, list

**Board**:
A *view* of tasks arranged by status columns. Not a container — several boards
show the same tasks.
_Avoid_: Using "board" to mean a Project. The IndexedDB object store is named
`boards` for historical reasons but holds Projects; that name is a storage
detail, not the domain term.

**Task**:
A single unit of work with a title, a status, a priority, and optionally a due
date and a parent Project.

**Status**:
A Task's position in the workflow. Exactly four values: `todo`, `doing`,
`review`, `done` — rendered as 待办 / 进行中 / 待确认 / 已完成.

**Focus record**:
One completed or abandoned timer session: its task (if any), session type,
start and end time, and duration. The raw material of the heatmap. Distinct from
a *Task*: a Task persists, a Focus record is an event.

**Session type**:
Which kind of interval a Focus record or the running timer belongs to — a focus
interval or a break (short or long.)

**Mini timer**:
The small always-available timer control. Its implementation uses the browser's
Document Picture-in-Picture API.

## Deployment targets

**Web app**:
The static PWA served from a normal origin. The primary product and the upstream
project's only target.

**Desktop shell**:
The Windows application: a Rust host around WebView2 that loads the web app's
build output. Not a rewrite of the web app — the same code, a different origin
and a different set of available capabilities.
_Avoid_: "Native app" unqualified; the shell is native, the rendering is not.
