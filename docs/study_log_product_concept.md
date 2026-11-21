# Study Log — Product Concept

**A mini app to organise courses, track academic completion, and measure actual study time.**

Study Log is a hierarchical Academic Progress Tracker + Study Time Logger. Users can create multiple courses, organise their academic content into nested levels, track completion with checklists, and log study time at any level. Time logged against a specific concept automatically rolls up to its parent chapter, module, subject, and course.

## 1. Academic Structure

Users can create multiple courses, such as:

- Class 12
- B.Com
- CA

Each course has its own hierarchy:

```text
Course: CA
└── Subject: Taxation
    └── Module: Direct Tax
        └── Chapter: PGBP
            ├── Concept: Depreciation
            ├── Concept: Allowable expenses
            └── Concept: Disallowable expenses
```

Users should be able to expand and collapse levels to navigate the structure easily.

The hierarchy should be flexible. Users can create, rename, and organise levels to suit different courses, since every course may have a different structure.

## 2. Checklist and Completion Tracking

Every chapter or concept can have checklist items or subpoints.

Example:

**Depreciation**

- [x] Understand the concept
- [x] Read the provisions
- [ ] Solve practical questions
- [ ] Revise the concept

### Completion logic

- All subpoints completed → the parent is automatically marked as completed.
- Some subpoints completed → the parent shows partial progress.
- No subpoints completed → the parent remains pending.

This should work consistently across the entire hierarchy, not just at the concept level.

## 3. Study Time Logging

Users can log study time against **any level** of the hierarchy:

- A specific concept
- An entire chapter
- A module
- A subject
- An entire course

Example: A user studies Depreciation for 45 minutes and creates this study log:

| Field | Example |
|---|---|
| Selected concept | Depreciation |
| Hierarchy | CA → Taxation → Direct Tax → PGBP → Depreciation |
| Study duration | 45 minutes |
| Course credited | CA |

The logging feature should support both:

- **Running timer:** Start, pause, resume, and stop a study session.
- **Manual entry:** Enter a duration after studying.

Every study log should preserve its date and duration so users can review their history.

## 4. Automatic Time Aggregation

This is the core intelligence of the app.

When a user logs 45 minutes against Depreciation, the same 45 minutes should automatically appear in the time totals of all its parent levels.

Example:

```text
CA                                      45 min
└── Taxation                            45 min
    └── Direct Tax                      45 min
        └── PGBP                        45 min
            └── Depreciation            45 min
```

**Important:** This is roll-up reporting, not multiple time entries. The original 45 minutes is stored once and counted only once in overall totals. Parent-level totals are calculated from the study logs belonging to their descendants.

## 5. Overall Dashboard

The dashboard should give users an instant overview of academic effort and progress.

### Key metrics

- Total study time
- Completed concepts
- Overall completion percentage
- Course-wise study time

### Example dashboard data

| Course | Study time | Share of total (approx.) |
|---|---:|---:|
| CA | 52h 30m | 61% |
| B.Com | 24h | 28% |
| Class 12 | 10h | 12% |
| **Total** | **86h 30m** | **100%** |

*Illustrative dashboard with sample figures.*

### Other useful views

- Daily and weekly study time
- Subject-wise study time
- Chapter-wise and concept-wise study time
- Completion percentage by course
- Study history by date

## 6. Important Product Decisions

1. **Flexible hierarchy:** Allow users to create and rename levels, because different courses may have different structures.
2. **Timer and manual entry:** Support both a running study timer and manual time logging.
3. **Time and completion are separate:** Logging time must not automatically mark a topic complete.
4. **Date-wise history:** Every study log should preserve its date and duration.
5. **No double counting:** Parent-level totals must aggregate child logs rather than create duplicate entries.

## 7. Product Summary

**Study Log allows users to organise all their academic studies into a nested structure, track completion through checklists, and log study time at any level — with automatic progress and time aggregation from individual concepts all the way up to the entire course.**

## 8. Suggested Initial Build Scope

Build a simple, clean mini app focused on these core capabilities first:

1. Course, subject, module, chapter, and concept management
2. Checklists and automatic completion roll-up
3. Study time logging at any hierarchy level
4. Automatic time aggregation and overall dashboard

Reminders and advanced analytics can be considered after the core experience works well.
