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
        'sub_criteria' => [
            [
                'id' => 'sub-101',
                'name' => 'Degree of Difficulty & Variety',
                'description' => 'Complexity, variety of movements, and creative staging variations.',
                'levels' => [
                    '5' => 'Outstanding complexity with diverse, intricate combinations executed seamlessly.',
                    '4' => 'High difficulty with good movement variety and minimal repetition.',
                    '3' => 'Moderate difficulty with standard routines and familiar movement patterns.',
                    '2' => 'Basic combinations with noticeable repetition and limited movement vocabulary.',
                    '1' => 'Rudimentary routines lacking choreographic variety and creative effort.'
                ]
            ],
            [
                'id' => 'sub-102',
                'name' => 'Synchronization & Timing',
                'description' => 'Precision, unison among dancers, and micro-timing accuracy.',
                'levels' => [
                    '5' => 'Razor-sharp precision and flawless synchronization across all performers.',
                    '4' => 'Strong synchronization with only isolated, minor timing discrepancies.',
                    '3' => 'Generally in sync with several noticeable timing lags or spacing gaps.',
                    '2' => 'Frequent synchronization lapses and disjointed ensemble timing.',
                    '1' => 'Persistent lack of unison, severely disrupted rhythm and coordination.'
                ]
            ],
            [
                'id' => 'sub-103',
                'name' => 'Technique & Form',
                'description' => 'Body control, posture, extension, lines, and movement cleanliness.',
                'levels' => [
                    '5' => 'Masterful body control, crisp lines, superb extension, and pristine form.',
                    '4' => 'Solid technique and clean execution with consistent posture throughout.',
                    '3' => 'Acceptable technique with occasional collapses in posture or arm extension.',
                    '2' => 'Weak body control, sloppy lines, and visible technical insecurity.',
                    '1' => 'Poor technique, lack of control, and disregard for form and safety.'
                ]
            ],
            [
                'id' => 'sub-104',
                'name' => 'Transitions & Staging',
                'description' => 'Fluidity between routine sections, formations, and spatial coverage.',
                'levels' => [
                    '5' => 'Effortless, dynamic formations with intelligent, seamless stage utilization.',
                    '4' => 'Smooth transitions between formations with clear spatial awareness.',
                    '3' => 'Functional staging with occasional awkward pauses during major transitions.',
                    '2' => 'Sluggish, cluttered transitions causing spatial crowding and collisions.',
                    '1' => 'Chaotic stage management with absent structure and disrupted flow.'
                ]
            ]
        ],
        'created_at' => date('Y-m-d H:i:s')
    ],
    [
        '_id' => 'criteria-002',
        'title' => 'Musicality & Rhythm',
        'description' => 'Beat synchronization, dynamic interpretation, and timing.',
        'event_id' => 1,
        'max_points' => 100,
        'percentage' => 35,
        'sub_criteria' => [
            [
                'id' => 'sub-201',
                'name' => 'Beat Synchronization & Cadence',
                'description' => 'Alignment with the rhythm, tempo consistency, and syncopation.',
                'levels' => [
                    '5' => 'Impeccable connection to micro-rhythms, tempo shifts, and syncopated beats.',
                    '4' => 'Strong rhythm alignment with steady tempo and rare timing slips.',
                    '3' => 'Rides the general beat but misses subtle musical nuances and accents.',
                    '2' => 'Frequently rushing or lagging behind tempo, struggling with beat changes.',
                    '1' => 'Total disconnection from the music tempo and rhythmic structure.'
                ]
            ],
            [
                'id' => 'sub-202',
                'name' => 'Musical Interpretation & Dynamics',
                'description' => 'Embodying musical mood, dramatic dynamics, and emotional flow.',
                'levels' => [
                    '5' => 'Exceptional dynamic contrast matching every crescendo, drop, and melodic climax.',
                    '4' => 'Clear musical interpretation with good expression of melodic themes.',
                    '3' => 'Moderate musical dynamics; routine feels somewhat detached from the music feel.',
                    '2' => 'Flat dynamics that ignore emotional peaks and changes in musical intensity.',
                    '1' => 'Monotone execution completely ignoring the musical atmosphere.'
                ]
            ],
            [
                'id' => 'sub-203',
                'name' => 'Sound Cue Responsiveness',
                'description' => 'Accents, sound effect hits, and sharpness on acoustic triggers.',
                'levels' => [
                    '5' => 'Every accent, sound hit, and musical punch is executed with stunning impact.',
                    '4' => 'Hits key audio highlights reliably with solid power and intent.',
                    '3' => 'Hits prominent bass cues but overlooks intricate acoustic layers.',
                    '2' => 'Belated or sluggish responses to major musical accents.',
                    '1' => 'Ignores acoustic triggers entirely; routine appears choreographed to silence.'
                ]
            ]
        ],
        'created_at' => date('Y-m-d H:i:s')
    ],
    [
        '_id' => 'criteria-003',
        'title' => 'Stage Presence & Overall Impact',
        'description' => 'Audience engagement, costume, projection, and poise.',
        'event_id' => 1,
        'max_points' => 100,
        'percentage' => 25,
        'sub_criteria' => [
            [
                'id' => 'sub-301',
                'name' => 'Audience Engagement & Energy',
                'description' => 'Charisma, emotional projection, crowd connection, and enthusiasm.',
                'levels' => [
                    '5' => 'Electrifying stage charisma and genuine passion that captivates the audience.',
                    '4' => 'High energy, expressive facial projection, and sustained enthusiasm.',
                    '3' => 'Good energy maintained for most of the performance with minor dips.',
                    '2' => 'Tentative stage projection, nervous demeanor, and restrained energy.',
                    '1' => 'Lethargic or lifeless presence, disengaged from spectators and judges.'
                ]
            ],
            [
                'id' => 'sub-302',
                'name' => 'Attire, Costuming & Visual Polish',
                'description' => 'Appropriateness, visual cohesion, cleanliness, and thematic harmony.',
                'levels' => [
                    '5' => 'Stunning, immaculate costuming that elevates the theme and visual aesthetics.',
                    '4' => 'Coordinated, polished attire appropriate for the routine and category.',
                    '3' => 'Acceptable costuming with minor styling imperfections or loose accessories.',
                    '2' => 'Ill-fitting or disheveled attire that distracts from the performance.',
                    '1' => 'Inappropriate, unsafe, or visibly unfinished costumes and props.'
                ]
            ],
            [
                'id' => 'sub-303',
                'name' => 'Poise & Professionalism',
                'description' => 'Confidence, stage recovery, discipline, and sportsmanship.',
                'levels' => [
                    '5' => 'Commanding confidence, instant recovery from mistakes, and consummate artistry.',
                    '4' => 'Confident stage deportment with composed recovery if slips occur.',
                    '3' => 'Moderate confidence, slight hesitation visible during challenging moments.',
                    '2' => 'Visible frustration or panic when errors occur, disrupting performance flow.',
                    '1' => 'Unprofessional demeanor, abrupt abandonment of routines, or disruptive exits.'
                ]
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
echo "Upserted 3 criteria with detailed 5-to-1 rubrics totaling 100% for Event #1.\n";

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
                'score' => 95.0,
                'sub_scores' => [
                    'sub-101' => 5,
                    'sub-102' => 4,
                    'sub-103' => 5,
                    'sub-104' => 5
                ]
            ],
            [
                'criteria_id' => 'criteria-002',
                'max' => 100,
                'score' => 86.67,
                'sub_scores' => [
                    'sub-201' => 5,
                    'sub-202' => 4,
                    'sub-203' => 4
                ]
            ],
            [
                'criteria_id' => 'criteria-003',
                'max' => 100,
                'score' => 93.33,
                'sub_scores' => [
                    'sub-301' => 5,
                    'sub-302' => 4,
                    'sub-303' => 5
                ]
            ]
        ],
        'total_score' => 91.67,
        'status' => 'submitted',
        'submitted_at' => date('Y-m-d H:i:s')
    ]],
    ['upsert' => true]
);
echo "Upserted sample submitted score with sub-criteria ratings for Contestant #1.\n";

echo "Seeding completed successfully!\n";
