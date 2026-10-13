┌──────────────────────────────────────────────────────────────────┐
│                           USERS COLLECTION                       │
├──────────────────────┬──────────────┬──────────┬─────────────────┤
│ Field                │ Type         │ Required │ Notes           │
├──────────────────────┼──────────────┼──────────┼─────────────────┤
│ _id                  │ ObjectId     │    ✔     │ Primary key     │
│ username             │ string       │    ✔     │                 │
│ email                │ string       │    ✔     │                 │
│ password             │ string|null  │    ✔     │ null = not set  │
│ role                 │ string       │    ✔     │                 │
│ is_active            │ boolean      │    ✔     │                 │
│ created_at           │ Date         │    ✔     │                 │
├──────────────────────┼──────────────┼──────────┼─────────────────┤
│ status               │ string       │    ○     │                 │
│ created_by           │ string       │    ○     │                 │
│ invite_token         │ string       │    ○     │ Invite flow     │
│ activated_at         │ Date         │    ○     │ Invite flow     │
│ reset_token          │ string       │    ○     │ Reset flow      │
│ reset_requested_at   │ Date         │    ○     │ Reset flow      │
└──────────────────────┴──────────────┴──────────┴─────────────────┘
  ✔ = required     ○ = optional


┌──────────────────────────────────────────────────────────────────────┐
│                          EVENTS COLLECTION                           │
├──────────────────────┬──────────────┬──────────┬─────────────────────┤
│ Field                │ Type         │ Required │ Notes               │
├──────────────────────┼──────────────┼──────────┼─────────────────────┤
│ _id                  │ integer      │    ✔     │ Primary key (int)   │
│ eventName            │ string       │    ✔     │                     │
│ description          │ string       │    ✔     │                     │
│ type                 │ string       │    ✔     │                     │
│ venue                │ string       │    ✔     │                     │
│ date                 │ Date         │    ✔     │ Event date          │
│ status               │ string       │    ✔     │ Event state         │
│ judgingStatus        │ string       │    ✔     │ Judging state       │
│ assignedjudges       │ ObjectId[]   │    ✔     │ → users._id         │
│ tabulators           │ ObjectId[]   │    ✔     │ → users._id         │
│ createdBy            │ ObjectId     │    ✔     │ → users._id         │
│ createdAt            │ Date         │    ✔     │                     │
│ updatedAt            │ Date         │    ✔     │                     │
└──────────────────────┴──────────────┴──────────┴─────────────────────┘
  ✔ = required (all fields in this schema are required)

┌──────────────────────────────────────────────────────┐
│                   LOGS COLLECTION                    │
├───────────┬──────────┬──────────┬────────────────────┤
│ Field     │ Type     │ Required │ Notes              │
├───────────┼──────────┼──────────┼────────────────────┤
│ _id       │ ObjectId │    ✓     │ Primary key        │
│ action    │ string   │    ✓     │                    │
│ details   │ string   │    ✓     │                    │
│ role      │ string   │    ✓     │                    │
│ timestamp │ Date     │    ✓     │                    │
│ userId    │ ObjectId │    ✓     │ → users._id        │
│ username  │ string   │    ✓     │                    │
└───────────┴──────────┴──────────┴────────────────────┘

 ✓ = required (all fields in this schema are required)


┌────────────────────────────────────────────────────────┐
│                NOTIFICATIONS COLLECTION                │
├─────────────┬──────────┬──────────┬────────────────────┤
│ Field       │ Type     │ Required │ Notes              │
├─────────────┼──────────┼──────────┼────────────────────┤
│ _id         │ ObjectId │    ✓     │ Primary key        │
│ created_at  │ Date     │    ✓     │                    │
│ event_id    │ integer  │    ✓     │ → events._id       │
│ is_read     │ boolean  │    ✓     │                    │
│ message     │ string   │    ✓     │                    │
│ role        │ string   │          │                    │
│ status      │ string   │          │                    │
│ target_role │ string   │          │                    │
│ title       │ string   │    ✓     │                    │
│ type        │ string   │    ✓     │                    │
│ updated_at  │ Date     │          │                    │
│ user_id     │ ObjectId │    ✓     │ → users._id        │
└─────────────┴──────────┴──────────┴────────────────────┘

 ✓ = required (blank = optional)

┌───────────────────────────────────────────────────────────────┐
│                      EVENTS COLLECTION                        │
├─────────────────┬────────────┬──────────┬─────────────────────┤
│ Field           │ Type       │ Required │ Notes               │
├─────────────────┼────────────┼──────────┼─────────────────────┤
│ _id             │ integer    │    ✓     │ Primary key (int)   │
│ eventName       │ string     │    ✓     │                     │
│ description     │ string     │    ✓     │                     │
│ type            │ string     │    ✓     │                     │
│ venue           │ string     │    ✓     │                     │
│ date            │ Date       │    ✓     │ Event date          │
│ status          │ string     │    ✓     │ Event state         │
│ judgingStatus   │ string     │    ✓     │ Judging state       │
│ assignedjudges  │ ObjectId[] │    ✓     │ → users._id         │
│ tabulators      │ ObjectId[] │    ✓     │ → users._id         │
│ confirmed_users │ ObjectId[] │          │ → users._id         │
│ createdBy       │ ObjectId   │    ✓     │ → users._id         │
│ createdAt       │ Date       │    ✓     │                     │
│ updatedAt       │ Date       │    ✓     │                     │
└─────────────────┴────────────┴──────────┴─────────────────────┘

 ✓ = required (blank = optional)


┌──────────────────────────────────────────────────────────┐
│                  CONTESTANTS COLLECTION                  │
├───────────────────┬──────────┬──────────┬────────────────┤
│ Field             │ Type     │ Required │ Notes          │
├───────────────────┼──────────┼──────────┼────────────────┤
│ _id               │ string   │    ✓     │ Primary key    │
│ contestant_number │ integer  │    ✓     │                │
│ name              │ string   │    ✓     │                │
│ department_or_org │ string   │    ✓     │                │
│ description       │ string   │    ✓     │                │
│ event_id          │ integer  │    ✓     │ → events._id   │
│ created_at        │ string   │    ✓     │                │
└───────────────────┴──────────┴──────────┴────────────────┘

 ✓ = required (all fields in this schema are required)



┌──────────────────────────────────────────────────────┐
│                  CRITERIA COLLECTION                 │
├─────────────┬──────────┬──────────┬──────────────────┤
│ Field       │ Type     │ Required │ Notes            │
├─────────────┼──────────┼──────────┼──────────────────┤
│ _id         │ string   │    ✓     │ Primary key      │
│ title       │ string   │    ✓     │                  │
│ description │ string   │    ✓     │                  │
│ event_id    │ integer  │    ✓     │ → events._id     │
│ max_points  │ integer  │    ✓     │                  │
│ percentage  │ integer  │    ✓     │ Weight of score  │
│ created_at  │ string   │    ✓     │                  │
└─────────────┴──────────┴──────────┴──────────────────┘

 ✓ = required (all fields in this schema are required)


┌─────────────────────────────────────────────────────────────┐
│                      SCORES COLLECTION                      │
├─────────────────┬──────────┬──────────┬─────────────────────┤
│ Field           │ Type     │ Required │ Notes               │
├─────────────────┼──────────┼──────────┼─────────────────────┤
│ _id             │ string   │    ✓     │ Primary key         │
│ contestant_id   │ string   │    ✓     │ → contestants._id   │
│ criteria_scores │ object[] │    ✓     │ See sub-fields      │
│  ├ criteria_id  │ string   │    ✓     │ → criteria._id      │
│  ├ max          │ integer  │    ✓     │                     │
│  └ score        │ integer  │    ✓     │                     │
│ event_id        │ integer  │    ✓     │ → events._id        │
│ judge_id        │ string   │    ✓     │ → users._id (?)     │
│ status          │ string   │    ✓     │                     │
│ submitted_at    │ string   │    ✓     │                     │
│ total_score     │ double   │    ✓     │                     │
└─────────────────┴──────────┴──────────┴─────────────────────┘

 ✓ = required (all fields in this schema are required)