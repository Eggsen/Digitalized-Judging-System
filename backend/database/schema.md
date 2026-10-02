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