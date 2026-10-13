// This file is used to seed the documents with some data

db.createCollection("users");
db.createCollection("events");
db.createCollection("logs");
db.createCollection("notifications");
db.createCollection("contestants");
db.createCollection("criteria");
db.createCollection("scores");

db.users.insertOne({
  username: "Admin",
  email: "admin@example.com",
  password: "<hashed-password>",
  role: "admin",
  is_active: true,
  created_at: new Date(),

  status: "active",
  created_by: "system",
  invite_token: "abc123",
  activated_at: new Date(),
  reset_token: "xyz789",
  reset_requested_at: new Date()
});

const admin = db.users.findOne({ username: "Admin" });

db.users.insertOne({
  username: "Judge1",
  email: "judge1@example.com",
  password: null,
  role: "judge",
  is_active: false,
  created_at: new Date(),
  invite_token: "invite-token-1"
});

const judge = db.users.findOne({ username: "Judge1" });

db.users.insertOne({
  username: "Tabulator1",
  email: "tab1@example.com",
  password: "<hashed-password>",
  role: "tabulator",
  is_active: true,
  created_at: new Date()
});

const tabulator = db.users.findOne({ username: "Tabulator1" });

db.events.insertOne({
  _id: 1,
  eventName: "Talent Night 2026",
  description: "Annual talent competition",
  type: "competition",
  venue: "Main Auditorium",
  date: new Date("2026-11-20"),
  status: "upcoming",
  judgingStatus: "not_started",
  assignedjudges: [judge._id],
  tabulators: [tabulator._id],
  confirmed_users: [judge._id],
  createdBy: admin._id,
  createdAt: new Date(),
  updatedAt: new Date()
});

db.logs.insertOne({
  action: "user_login",
  details: "Admin logged in",
  role: "admin",
  timestamp: new Date(),
  userId: admin._id,
  username: "Admin"
});

db.notifications.insertOne({
  created_at: new Date(),
  event_id: 1,
  is_read: false,
  message: "You have been assigned to an event",
  title: "Event Assignment",
  type: "assignment",
  user_id: judge._id,

  role: "judge",
  status: "sent",
  target_role: "judge",
  updated_at: new Date()
});

db.contestants.insertOne({
  _id: "contestant-001",
  contestant_number: 1,
  name: "Jane Doe",
  department_or_org: "College of Engineering",
  description: "Singer",
  event_id: 1,
  created_at: new Date().toISOString()
});

db.criteria.insertOne({
  _id: "criteria-001",
  title: "Talent",
  description: "Skill and execution of the performance",
  event_id: 1,
  max_points: 10,
  percentage: 30,
  created_at: new Date().toISOString()
});

db.scores.insertOne({
  _id: "score-001",
  contestant_id: "contestant-001",
  criteria_scores: [
    {
      criteria_id: "criteria-001",
      max: 10,
      score: 9
    }
  ],
  event_id: 1,
  judge_id: judge._id.toString(),
  status: "submitted",
  submitted_at: new Date().toISOString(),
  total_score: 9.5
});