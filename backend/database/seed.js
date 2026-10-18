// This file is used to seed the documents with some data for MongoDB Atlas / mongosh

db.createCollection("users");
db.createCollection("events");
db.createCollection("logs");
db.createCollection("notifications");
db.createCollection("contestants");
db.createCollection("criteria");
db.createCollection("scores");

// 1. Users
db.users.updateOne(
  { username: "Admin" },
  {
    $set: {
      username: "Admin",
      email: "admin@buksu.edu.ph",
      password: "<hashed-password>",
      role: "admin",
      is_active: true,
      created_at: new Date(),
      status: "active",
      created_by: "system"
    }
  },
  { upsert: true }
);

db.users.updateOne(
  { username: "Judge1" },
  {
    $set: {
      username: "Judge1",
      email: "judge1@buksu.edu.ph",
      password: "<hashed-password>",
      role: "judge",
      is_active: true,
      created_at: new Date(),
      status: "active"
    }
  },
  { upsert: true }
);

db.users.updateOne(
  { username: "Tabulator1" },
  {
    $set: {
      username: "Tabulator1",
      email: "tabulator1@buksu.edu.ph",
      password: "<hashed-password>",
      role: "tabulator",
      is_active: true,
      created_at: new Date(),
      status: "active"
    }
  },
  { upsert: true }
);

const admin = db.users.findOne({ username: "Admin" });
const judge = db.users.findOne({ username: "Judge1" });
const tabulator = db.users.findOne({ username: "Tabulator1" });

// 2. Events
db.events.updateOne(
  { _id: 1 },
  {
    $set: {
      _id: 1,
      eventName: "BukSU Hudyaka Dance Competition 2026",
      description: "Annual university-wide dance and cultural choreography competition.",
      type: "Dance_Competition",
      venue: "University Gymnasium",
      date: new Date("2026-11-20T18:00:00Z"),
      status: "Ongoing",
      judgingStatus: "In Progress",
      assignedjudges: [judge._id],
      tabulators: [tabulator._id],
      confirmed_users: [judge._id, tabulator._id],
      createdBy: admin._id,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  },
  { upsert: true }
);

// 3. Contestants
db.contestants.updateOne(
  { _id: "contestant-001" },
  {
    $set: {
      _id: "contestant-001",
      contestant_number: 1,
      name: "Team Alpha",
      department_or_org: "College of Nursing",
      description: "Contemporary lyrical & synchronization showcase",
      event_id: 1,
      created_at: new Date().toISOString()
    }
  },
  { upsert: true }
);

db.contestants.updateOne(
  { _id: "contestant-002" },
  {
    $set: {
      _id: "contestant-002",
      contestant_number: 2,
      name: "Team Beta",
      department_or_org: "College of Arts & Sciences",
      description: "High-energy urban hip-hop & acrobatics",
      event_id: 1,
      created_at: new Date().toISOString()
    }
  },
  { upsert: true }
);

db.contestants.updateOne(
  { _id: "contestant-003" },
  {
    $set: {
      _id: "contestant-003",
      contestant_number: 3,
      name: "Team Gamma",
      department_or_org: "College of Business",
      description: "Theatrical folk-modern fusion performance",
      event_id: 1,
      created_at: new Date().toISOString()
    }
  },
  { upsert: true }
);

// 4. Criteria & Weights (Totals 100%)
db.criteria.updateOne(
  { _id: "criteria-001" },
  {
    $set: {
      _id: "criteria-001",
      title: "Choreography & Execution",
      description: "Precision, synchronization, degree of difficulty, and fluidity.",
      event_id: 1,
      max_points: 100,
      percentage: 40,
      created_at: new Date().toISOString()
    }
  },
  { upsert: true }
);

db.criteria.updateOne(
  { _id: "criteria-002" },
  {
    $set: {
      _id: "criteria-002",
      title: "Musicality & Rhythm",
      description: "Beat synchronization, dynamic interpretation, and timing.",
      event_id: 1,
      max_points: 100,
      percentage: 35,
      created_at: new Date().toISOString()
    }
  },
  { upsert: true }
);

db.criteria.updateOne(
  { _id: "criteria-003" },
  {
    $set: {
      _id: "criteria-003",
      title: "Stage Presence & Overall Impact",
      description: "Audience engagement, costume, projection, and poise.",
      event_id: 1,
      max_points: 100,
      percentage: 25,
      created_at: new Date().toISOString()
    }
  },
  { upsert: true }
);

// 5. Scores (Submitted Sample by Judge1)
db.scores.updateOne(
  { _id: "score-001" },
  {
    $set: {
      _id: "score-001",
      contestant_id: "contestant-001",
      event_id: 1,
      judge_id: judge._id.toString(),
      criteria_scores: [
        { criteria_id: "criteria-001", max: 100, score: 92 },
        { criteria_id: "criteria-002", max: 100, score: 88 },
        { criteria_id: "criteria-003", max: 100, score: 95 }
      ],
      total_score: 91.35,
      status: "submitted",
      submitted_at: new Date().toISOString()
    }
  },
  { upsert: true }
);

// 6. Logs & Notifications
db.logs.insertOne({
  action: "system_seed",
  details: "Seeded initial contestants, criteria, and sample scores.",
  role: "system",
  timestamp: new Date(),
  userId: admin._id,
  username: "Admin"
});

db.notifications.insertOne({
  created_at: new Date(),
  event_id: 1,
  is_read: false,
  message: "Judging period for BukSU Hudyaka Dance Competition 2026 is now in progress.",
  title: "Judging Session Active",
  type: "judging_period",
  user_id: judge._id,
  role: "judge",
  status: "sent",
  target_role: "judge",
  updated_at: new Date()
});

print("Database seeded successfully with users, event 1, contestants, criteria (100%), and scores!");