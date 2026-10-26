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
      scoring_categories: [
        {
          id: "cat-101",
          name: "Difficulty & Movement Variety",
          points: 25.0,
          description: "Complexity, variety of movements, and creative staging variations."
        },
        {
          id: "cat-102",
          name: "Synchronization & Timing",
          points: 25.0,
          description: "Precision, unison among dancers, and micro-timing accuracy."
        },
        {
          id: "cat-103",
          name: "Technique & Form",
          points: 25.0,
          description: "Body control, posture, extension, lines, and movement cleanliness."
        },
        {
          id: "cat-104",
          name: "Transitions & Staging",
          points: 25.0,
          description: "Fluidity between routine sections, formations, and spatial coverage."
        }
      ],
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
      max_points: 40,
      percentage: 35,
      scoring_categories: [
        {
          id: "cat-201",
          name: "Beat Synchronization & Timing",
          points: 10.0,
          description: "Alignment with rhythm, tempo consistency, and syncopation."
        },
        {
          id: "cat-202",
          name: "Rhythm & Tempo Consistency",
          points: 10.0,
          description: "Cadence stability and steady execution through tempo shifts."
        },
        {
          id: "cat-203",
          name: "Dynamic Interpretation",
          points: 10.0,
          description: "Embodying musical mood, dramatic dynamics, and emotional flow."
        },
        {
          id: "cat-204",
          name: "Acoustic Hit Responsiveness",
          points: 10.0,
          description: "Accents, sound effect hits, and sharpness on acoustic triggers."
        }
      ],
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
      max_points: 50,
      percentage: 25,
      scoring_categories: [
        {
          id: "cat-301",
          name: "Audience Engagement & Energy",
          points: 12.5,
          description: "Charisma, emotional projection, crowd connection, and enthusiasm."
        },
        {
          id: "cat-302",
          name: "Attire & Visual Polish",
          points: 12.5,
          description: "Appropriateness, visual cohesion, cleanliness, and thematic harmony."
        },
        {
          id: "cat-303",
          name: "Stage Projection & Poise",
          points: 12.5,
          description: "Confidence, stage recovery, discipline, and sportsmanship."
        },
        {
          id: "cat-304",
          name: "Professionalism & Composure",
          points: 12.5,
          description: "Commanding confidence and instant recovery from mistakes."
        }
      ],
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
        {
          criteria_id: "criteria-001",
          max: 100,
          score: 94.0,
          sub_scores: {
            "cat-101": 24.0,
            "cat-102": 23.0,
            "cat-103": 24.0,
            "cat-104": 23.0
          }
        },
        {
          criteria_id: "criteria-002",
          max: 40,
          score: 36.0,
          sub_scores: {
            "cat-201": 9.0,
            "cat-202": 9.0,
            "cat-203": 9.0,
            "cat-204": 9.0
          }
        },
        {
          criteria_id: "criteria-003",
          max: 50,
          score: 45.0,
          sub_scores: {
            "cat-301": 12.0,
            "cat-302": 11.0,
            "cat-303": 11.0,
            "cat-304": 11.0
          }
        }
      ],
      total_score: 91.6,
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