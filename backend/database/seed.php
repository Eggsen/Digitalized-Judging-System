<?php

require_once __DIR__ . '/config.php';

echo "Seeding users, events, contestants, criteria, and scores into MongoDB...\n";

// 1. Users
$defaultUsers = [
    [
        'username' => 'Admin',
        'email' => 'admin@buksu.edu.ph',
        'password' => password_hash('adminpassword123', PASSWORD_DEFAULT),
        'role' => 'admin',
        'is_active' => true,
        'status' => 'active',
        'created_at' => new MongoDB\BSON\UTCDateTime()
    ],
    [
        'username' => 'Judge1',
        'email' => 'judge1@buksu.edu.ph',
        'password' => password_hash('judgepassword123', PASSWORD_DEFAULT),
        'role' => 'judge',
        'is_active' => true,
        'status' => 'active',
        'created_at' => new MongoDB\BSON\UTCDateTime()
    ],
    [
        'username' => 'Tabulator1',
        'email' => 'tabulator1@buksu.edu.ph',
        'password' => password_hash('tabulatorpassword123', PASSWORD_DEFAULT),
        'role' => 'tabulator',
        'is_active' => true,
        'status' => 'active',
        'created_at' => new MongoDB\BSON\UTCDateTime()
    ]
];

foreach ($defaultUsers as $userData) {
    $existing = $usersCollection->findOne([
        '$or' => [
            ['username' => $userData['username']],
            ['email' => $userData['email']]
        ]
    ]);

    if ($existing) {
        $usersCollection->updateOne(
            ['_id' => $existing['_id']],
            ['$set' => [
                'password' => $userData['password'],
                'role' => $userData['role'],
                'email' => $userData['email'],
                'is_active' => true,
                'status' => 'active'
            ]]
        );
        echo "Updated existing user: {$userData['username']} ({$userData['role']})\n";
    } else {
        $usersCollection->insertOne($userData);
        echo "Created user: {$userData['username']} ({$userData['role']})\n";
    }
}

$admin = $usersCollection->findOne(['username' => 'Admin']);
$judge = $usersCollection->findOne(['username' => 'Judge1']);
$tabulator = $usersCollection->findOne(['username' => 'Tabulator1']);

// 2. Event #1
$eventsCollection->updateOne(
    ['_id' => 1],
    ['$set' => [
        '_id' => 1,
        'eventName' => 'BukSU Hudyaka Dance Competition 2026',
        'description' => 'Annual university-wide dance and cultural choreography competition.',
        'type' => 'Dance_Competition',
        'venue' => 'University Gymnasium',
        'date' => new MongoDB\BSON\UTCDateTime(strtotime('2026-11-20 18:00:00') * 1000),
        'status' => 'Ongoing',
        'judgingStatus' => 'In Progress',
        'assignedjudges' => [$judge['_id']],
        'tabulators' => [$tabulator['_id']],
        'confirmed_users' => [$judge['_id'], $tabulator['_id']],
        'createdBy' => $admin['_id'],
        'createdAt' => new MongoDB\BSON\UTCDateTime(),
        'updatedAt' => new MongoDB\BSON\UTCDateTime()
    ]],
    ['upsert' => true]
);
echo "Upserted Event #1: BukSU Hudyaka Dance Competition 2026 (Judging: In Progress)\n";

// 3. Contestants
$contestants = [
    [
        '_id' => 'contestant-001',
        'contestant_number' => 1,
        'name' => 'Team Alpha',
        'department_or_org' => 'College of Nursing',
        'description' => 'Contemporary lyrical & synchronization showcase',
        'event_id' => 1,
        'created_at' => date('Y-m-d H:i:s')
    ],
    [
        '_id' => 'contestant-002',
        'contestant_number' => 2,
        'name' => 'Team Beta',
        'department_or_org' => 'College of Arts & Sciences',
        'description' => 'High-energy urban hip-hop & acrobatics',
        'event_id' => 1,
        'created_at' => date('Y-m-d H:i:s')
    ],
    [
        '_id' => 'contestant-003',
        'contestant_number' => 3,
        'name' => 'Team Gamma',
        'department_or_org' => 'College of Business',
        'description' => 'Theatrical folk-modern fusion performance',
        'event_id' => 1,
        'created_at' => date('Y-m-d H:i:s')
    ]
];

foreach ($contestants as $c) {
    $contestantsCollection->updateOne(
        ['_id' => $c['_id']],
        ['$set' => $c],
        ['upsert' => true]
    );
}
echo "Upserted 3 contestants for Event #1.\n";

// 4. Criteria & Weights (40% + 35% + 25% = 100%)
$criteria = [
    [
        '_id' => 'criteria-001',
        'title' => 'Choreography & Execution',
        'description' => 'Precision, synchronization, degree of difficulty, and fluidity.',
        'event_id' => 1,
        'max_points' => 100,
        'percentage' => 40,
        'scoring_categories' => [
            [
                'id' => 'cat-101',
                'name' => 'Difficulty & Movement Variety',
                'points' => 25.0,
                'description' => 'Complexity, variety of movements, and creative staging variations.'
            ],
            [
                'id' => 'cat-102',
                'name' => 'Synchronization & Timing',
                'points' => 25.0,
                'description' => 'Precision, unison among dancers, and micro-timing accuracy.'
            ],
            [
                'id' => 'cat-103',
                'name' => 'Technique & Form',
                'points' => 25.0,
                'description' => 'Body control, posture, extension, lines, and movement cleanliness.'
            ],
            [
                'id' => 'cat-104',
                'name' => 'Transitions & Staging',
                'points' => 25.0,
                'description' => 'Fluidity between routine sections, formations, and spatial coverage.'
            ]
        ],
        'created_at' => date('Y-m-d H:i:s')
    ],
    [
        '_id' => 'criteria-002',
        'title' => 'Musicality & Rhythm',
        'description' => 'Beat synchronization, dynamic interpretation, and timing.',
        'event_id' => 1,
        'max_points' => 40,
        'percentage' => 35,
        'scoring_categories' => [
            [
                'id' => 'cat-201',
                'name' => 'Beat Synchronization & Timing',
                'points' => 10.0,
                'description' => 'Alignment with rhythm, tempo consistency, and syncopation.'
            ],
            [
                'id' => 'cat-202',
                'name' => 'Rhythm & Tempo Consistency',
                'points' => 10.0,
                'description' => 'Cadence stability and steady execution through tempo shifts.'
            ],
            [
                'id' => 'cat-203',
                'name' => 'Dynamic Interpretation',
                'points' => 10.0,
                'description' => 'Embodying musical mood, dramatic dynamics, and emotional flow.'
            ],
            [
                'id' => 'cat-204',
                'name' => 'Acoustic Hit Responsiveness',
                'points' => 10.0,
                'description' => 'Accents, sound effect hits, and sharpness on acoustic triggers.'
            ]
        ],
        'created_at' => date('Y-m-d H:i:s')
    ],
    [
        '_id' => 'criteria-003',
        'title' => 'Stage Presence & Overall Impact',
        'description' => 'Audience engagement, costume, projection, and poise.',
        'event_id' => 1,
        'max_points' => 50,
        'percentage' => 25,
        'scoring_categories' => [
            [
                'id' => 'cat-301',
                'name' => 'Audience Engagement & Energy',
                'points' => 12.5,
                'description' => 'Charisma, emotional projection, crowd connection, and enthusiasm.'
            ],
            [
                'id' => 'cat-302',
                'name' => 'Attire & Visual Polish',
                'points' => 12.5,
                'description' => 'Appropriateness, visual cohesion, cleanliness, and thematic harmony.'
            ],
            [
                'id' => 'cat-303',
                'name' => 'Stage Projection & Poise',
                'points' => 12.5,
                'description' => 'Confidence, stage recovery, discipline, and sportsmanship.'
            ],
            [
                'id' => 'cat-304',
                'name' => 'Professionalism & Composure',
                'points' => 12.5,
                'description' => 'Commanding confidence and instant recovery from mistakes.'
            ]
        ],
        'created_at' => date('Y-m-d H:i:s')
    ]
];

foreach ($criteria as $cr) {
    $criteriaCollection->updateOne(
        ['_id' => $cr['_id']],
        ['$set' => $cr],
        ['upsert' => true]
    );
}
echo "Upserted 3 criteria with customizable scoring categories totaling 100% for Event #1.\n";

// 5. Sample Score
$judgeIdStr = (string)$judge['_id'];
$scoresCollection->updateOne(
    ['_id' => 'score-001'],
    ['$set' => [
        '_id' => 'score-001',
        'contestant_id' => 'contestant-001',
        'event_id' => 1,
        'judge_id' => $judgeIdStr,
        'criteria_scores' => [
            [
                'criteria_id' => 'criteria-001',
                'max' => 100,
                'score' => 94.0,
                'sub_scores' => [
                    'cat-101' => 24.0,
                    'cat-102' => 23.0,
                    'cat-103' => 24.0,
                    'cat-104' => 23.0
                ]
            ],
            [
                'criteria_id' => 'criteria-002',
                'max' => 40,
                'score' => 36.0,
                'sub_scores' => [
                    'cat-201' => 9.0,
                    'cat-202' => 9.0,
                    'cat-203' => 9.0,
                    'cat-204' => 9.0
                ]
            ],
            [
                'criteria_id' => 'criteria-003',
                'max' => 50,
                'score' => 45.0,
                'sub_scores' => [
                    'cat-301' => 12.0,
                    'cat-302' => 11.0,
                    'cat-303' => 11.0,
                    'cat-304' => 11.0
                ]
            ]
        ],
        'total_score' => 91.6,
        'status' => 'submitted',
        'submitted_at' => date('Y-m-d H:i:s')
    ]],
    ['upsert' => true]
);
echo "Upserted sample submitted score with rubric category selections for Contestant #1.\n";

echo "Seeding completed successfully!\n";
