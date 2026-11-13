/**
 * BukSU Digitalized Judging System (DJS)
 * Seed Script: Test Accounts & Demonstration Fixtures
 * 
 * Creates test accounts with simple demonstration credentials:
 * - Admin: admin_main (admin_main@djs.com / admin123, PIN: 123456)
 * - Judges: judge_01, judge_02 (assigned), judge_unassigned, judge_deactivated (judge123)
 * - Tabulators: tabulator_01, tabulator_deactivated (tab123)
 * - Active Competition (Event #8): Ongoing with weighted criteria, active/deactivated contestants,
 *   and scores across all states (not-started, in-progress, submitted, locked).
 * - Archived Competition (Event #9): Historical data with full audit logs.
 */

const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const { connectDB } = require('../config/db');

async function seed() {
    console.log('--- Starting BukSU DJS Test Accounts & Fixtures Seeding ---');
    const { collections } = await connectDB();

    const now = new Date();
    const nowIso = now.toISOString();
    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Password & PIN Hashes
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const adminPinHash = await bcrypt.hash('123456', 10);
    const judgePasswordHash = await bcrypt.hash('judge123', 10);
    const tabPasswordHash = await bcrypt.hash('tab123', 10);

    // 2. Define Test Users
    const testUsers = [
        {
            username: 'admin_main',
            email: 'admin_main@djs.com',
            full_name: 'Admin Main (Demonstration)',
            first_name: 'Admin',
            last_name: 'Main',
            role: 'admin',
            status: 'active',
            is_active: true,
            password: adminPasswordHash,
            admin_pin: adminPinHash,
            has_admin_pin: true,
            created_at: pastDate,
            activated_at: pastDate
        },
        {
            username: 'judge_01',
            email: 'judge_01@djs.com',
            full_name: 'Judge One (Assigned)',
            first_name: 'Judge',
            last_name: 'One',
            role: 'judge',
            status: 'active',
            is_active: true,
            password: judgePasswordHash,
            created_at: pastDate,
            activated_at: pastDate
        },
        {
            username: 'judge_02',
            email: 'judge_02@djs.com',
            full_name: 'Judge Two (Assigned)',
            first_name: 'Judge',
            last_name: 'Two',
            role: 'judge',
            status: 'active',
            is_active: true,
            password: judgePasswordHash,
            created_at: pastDate,
            activated_at: pastDate
        },
        {
            username: 'judge_unassigned',
            email: 'judge_unassigned@djs.com',
            full_name: 'Judge Unassigned (No Competitions)',
            first_name: 'Judge',
            last_name: 'Unassigned',
            role: 'judge',
            status: 'active',
            is_active: true,
            password: judgePasswordHash,
            created_at: pastDate,
            activated_at: pastDate
        },
        {
            username: 'judge_deactivated',
            email: 'judge_deactivated@djs.com',
            full_name: 'Judge Deactivated (Disabled)',
            first_name: 'Judge',
            last_name: 'Deactivated',
            role: 'judge',
            status: 'disabled',
            is_active: false,
            password: judgePasswordHash,
            created_at: pastDate
        },
        {
            username: 'tabulator_01',
            email: 'tabulator_01@djs.com',
            full_name: 'Tabulator One (Active)',
            first_name: 'Tabulator',
            last_name: 'One',
            role: 'tabulator',
            status: 'active',
            is_active: true,
            password: tabPasswordHash,
            created_at: pastDate,
            activated_at: pastDate
        },
        {
            username: 'tabulator_deactivated',
            email: 'tabulator_deactivated@djs.com',
            full_name: 'Tabulator Deactivated (Disabled)',
            first_name: 'Tabulator',
            last_name: 'Deactivated',
            role: 'tabulator',
            status: 'disabled',
            is_active: false,
            password: tabPasswordHash,
            created_at: pastDate
        }
    ];

    // Upsert or insert test users
    const userDocs = {};
    for (const u of testUsers) {
        let existing = await collections.users.findOne({ email: u.email });
        if (existing) {
            await collections.users.updateOne({ _id: existing._id }, { $set: u });
            userDocs[u.username] = { ...u, _id: existing._id };
        } else {
            const res = await collections.users.insertOne(u);
            userDocs[u.username] = { ...u, _id: res.insertedId };
        }
    }
    console.log('✓ Test Accounts Upserted (7 Accounts)');

    const adminMain = userDocs['admin_main'];
    const judge01 = userDocs['judge_01'];
    const judge02 = userDocs['judge_02'];
    const tab01 = userDocs['tabulator_01'];

    // 3. Competitions (Event #8 Active, Event #9 Archived)
    const activeEventId = 8;
    const archivedEventId = 9;

    const assignedJudgesList = [
        {
            id: String(judge01._id),
            _id: String(judge01._id),
            username: judge01.username,
            name: judge01.full_name,
            email: judge01.email,
            role: 'judge'
        },
        {
            id: String(judge02._id),
            _id: String(judge02._id),
            username: judge02.username,
            name: judge02.full_name,
            email: judge02.email,
            role: 'judge'
        }
    ];

    const tabulatorsList = [
        {
            id: String(tab01._id),
            _id: String(tab01._id),
            username: tab01.username,
            name: tab01.full_name,
            email: tab01.email,
            role: 'tabulator'
        }
    ];

    const confirmedIds = [String(judge01._id), String(judge02._id), String(tab01._id)];

    // Event #8: Active Competition (Ongoing, In Progress)
    const activeEventDoc = {
        _id: activeEventId,
        eventName: 'Annual Talent Championship 2026',
        name: 'Annual Talent Championship 2026',
        title: 'Annual Talent Championship 2026',
        type: 'Talent Showcase',
        category: 'Talent Showcase',
        description: 'BukSU Annual Grand Championship showcasing exceptional vocalists, instrumentalists, and dance troupes.',
        venue: 'BukSU Main Gymnasium & Cultural Center',
        date: new Date().toISOString().split('T')[0],
        start_time: '13:00',
        status: 'Ongoing',
        judgingStatus: 'In Progress',
        judging_status: 'In Progress',
        assignedjudges: assignedJudgesList,
        assigned_judges: assignedJudgesList,
        tabulators: tabulatorsList,
        confirmed_users: confirmedIds,
        createdBy: String(adminMain._id),
        created_by: adminMain.username,
        createdAt: nowIso,
        created_at: nowIso,
        updated_at: nowIso
    };

    await collections.events.updateOne(
        { _id: activeEventId },
        { $set: activeEventDoc },
        { upsert: true }
    );

    // Event #9: Archived Competition
    const archivedEventDoc = {
        _id: archivedEventId,
        eventName: 'BukSU Cultural Showcase 2025',
        name: 'BukSU Cultural Showcase 2025',
        title: 'BukSU Cultural Showcase 2025',
        type: 'Cultural Exhibition',
        category: 'Cultural Exhibition',
        description: 'Historical archive of the 2025 BukSU University Cultural Showcase and Inter-College Festival.',
        venue: 'University Auditorium',
        date: '2025-10-15',
        start_time: '09:00',
        status: 'Archived',
        judgingStatus: 'Finished',
        judging_status: 'Finished',
        assignedjudges: assignedJudgesList,
        assigned_judges: assignedJudgesList,
        tabulators: tabulatorsList,
        confirmed_users: confirmedIds,
        createdBy: String(adminMain._id),
        created_by: adminMain.username,
        createdAt: '2025-10-01T08:00:00.000Z',
        created_at: '2025-10-01T08:00:00.000Z',
        updated_at: '2025-10-15T18:00:00.000Z'
    };

    await collections.events.updateOne(
        { _id: archivedEventId },
        { $set: archivedEventDoc },
        { upsert: true }
    );
    console.log('✓ Active Event #8 & Archived Event #9 Created');

    // 4. Criteria with Weights (Summing to exactly 100%)
    await collections.criteria.deleteMany({ event_id: { $in: [activeEventId, archivedEventId, String(activeEventId), String(archivedEventId)] } });

    const criteriaDocs = [
        {
            _id: 'crit-talent-01',
            event_id: activeEventId,
            title: 'Technical Execution & Mastery',
            description: 'Accuracy, breath control, pitch, rhythmic precision, difficulty, and technical proficiency.',
            percentage: 40,
            max_points: 100,
            min_points: 0,
            score_step: 0.5,
            scoring_type: 'category',
            scoring_categories: [
                { id: 'cat-t1', name: 'Precision & Technical Skill', description: 'Accuracy in notes, steps, or technique.', points: 25 },
                { id: 'cat-t2', name: 'Difficulty & Complexity', description: 'Degree of technical challenge attempted.', points: 25 },
                { id: 'cat-t3', name: 'Rhythm, Timing & Tempo', description: 'Synchronization with musical accompaniment.', points: 25 },
                { id: 'cat-t4', name: 'Consistency & Breath/Form Discipline', description: 'Sustained energy and posture throughout the performance.', points: 25 }
            ],
            rubric_ratings: [],
            created_at: nowIso,
            updated_at: nowIso
        },
        {
            _id: 'crit-talent-02',
            event_id: activeEventId,
            title: 'Artistic Expression & Charisma',
            description: 'Emotional interpretation, dynamics, stage presence, audience connection, and stylistic flair.',
            percentage: 35,
            max_points: 100,
            min_points: 0,
            score_step: 0.5,
            scoring_type: 'category',
            scoring_categories: [
                { id: 'cat-a1', name: 'Stage Presence & Demeanor', description: 'Confidence, command of the stage, and projection.', points: 35 },
                { id: 'cat-a2', name: 'Interpretation & Emotional Depth', description: 'Ability to convey the message and nuance of the piece.', points: 35 },
                { id: 'cat-a3', name: 'Audience Rapport & Impact', description: 'Engagement and emotional response elicited from the audience.', points: 30 }
            ],
            rubric_ratings: [],
            created_at: nowIso,
            updated_at: nowIso
        },
        {
            _id: 'crit-talent-03',
            event_id: activeEventId,
            title: 'Overall Impact & Presentation',
            description: 'Originality, aesthetic visual harmony, attire/costume appropriateness, and memorable finish.',
            percentage: 25,
            max_points: 100,
            min_points: 0,
            score_step: 0.5,
            scoring_type: 'category',
            scoring_categories: [
                { id: 'cat-o1', name: 'Originality & Creative Flair', description: 'Uniqueness of the arrangement, routine, or concept.', points: 50 },
                { id: 'cat-o2', name: 'Visual Harmony & Professionalism', description: 'Attire, grooming, posture, and seamless exit/entrance.', points: 50 }
            ],
            rubric_ratings: [],
            created_at: nowIso,
            updated_at: nowIso
        },
        // Archived Criteria
        {
            _id: 'crit-archived-01',
            event_id: archivedEventId,
            title: 'Cultural Authenticity',
            description: 'Fidelity to regional traditions, ethnic instruments, and indigenous movements.',
            percentage: 50,
            max_points: 100,
            scoring_type: 'criteria',
            rubric_ratings: [],
            created_at: '2025-10-01T08:00:00.000Z'
        },
        {
            _id: 'crit-archived-02',
            event_id: archivedEventId,
            title: 'Performance Execution',
            description: 'Ensemble balance, vocal clarity, and synchronization.',
            percentage: 50,
            max_points: 100,
            scoring_type: 'criteria',
            rubric_ratings: [],
            created_at: '2025-10-01T08:00:00.000Z'
        }
    ];

    await collections.criteria.insertMany(criteriaDocs);
    console.log('✓ Judging Criteria Configured (Weighted 40% + 35% + 25% = 100%)');

    // 5. Contestants (Active and Deactivated)
    await collections.contestants.deleteMany({ event_id: { $in: [activeEventId, archivedEventId, String(activeEventId), String(archivedEventId)] } });

    const contestantDocs = [
        {
            _id: 'contestant-active-01',
            event_id: activeEventId,
            contestant_number: 1,
            number: 1,
            name: 'Maria Santos',
            department_or_org: 'College of Arts and Sciences',
            representation: 'College of Arts and Sciences',
            entry_type: 'individual',
            team_members: [],
            is_active: true,
            status: 'active',
            description: 'Solo Contemporary Vocalist performing an original acoustic arrangement.',
            comments: [
                {
                    id: 'cit-ms-01',
                    text: 'Exceptional Vocal Modulation & Breath Control',
                    award_title: 'Exceptional Vocal Modulation',
                    author: judge01.full_name,
                    author_role: 'judge',
                    judge_id: String(judge01._id),
                    created_at: nowIso
                }
            ],
            created_at: nowIso,
            updated_at: nowIso
        },
        {
            _id: 'contestant-active-02',
            event_id: activeEventId,
            contestant_number: 2,
            number: 2,
            name: 'John Reyes',
            department_or_org: 'College of Technologies',
            representation: 'College of Technologies',
            entry_type: 'individual',
            team_members: [],
            is_active: true,
            status: 'active',
            description: 'Classical Violin soloist showcasing high-tempo technical mastery.',
            comments: [],
            created_at: nowIso,
            updated_at: nowIso
        },
        {
            _id: 'contestant-active-03',
            event_id: activeEventId,
            contestant_number: 3,
            number: 3,
            name: 'BukSU Dance Troupe',
            department_or_org: 'Performing Arts Guild',
            representation: 'Performing Arts Guild',
            entry_type: 'team',
            team_members: ['Carlos Mendoza', 'Ana Lim', 'David Tan', 'Samantha Cruz'],
            is_active: true,
            status: 'active',
            description: 'Contemporary Hip-hop fusion ensemble representing BukSU in regional invitationals.',
            comments: [],
            created_at: nowIso,
            updated_at: nowIso
        },
        {
            _id: 'contestant-active-04',
            event_id: activeEventId,
            contestant_number: 4,
            number: 4,
            name: 'Mark Dalisay',
            department_or_org: 'College of Education',
            representation: 'College of Education',
            entry_type: 'individual',
            team_members: [],
            is_active: true,
            status: 'active',
            description: 'Spoken Word and Dramatic Monologue performer.',
            comments: [],
            created_at: nowIso,
            updated_at: nowIso
        },
        {
            _id: 'contestant-active-05',
            event_id: activeEventId,
            contestant_number: 5,
            number: 5,
            name: 'Phoenix Vocal Quintet (Deactivated)',
            department_or_org: 'Conservatory of Music',
            representation: 'Conservatory of Music',
            entry_type: 'team',
            team_members: ['Grace Poe', 'Leo Cruz', 'Bea Alonzo', 'Rico Blanco', 'Sarah G.'],
            is_active: false,
            status: 'deactivated',
            description: 'Withdrawn prior to commencement due to schedule conflict (Deactivated record).',
            comments: [],
            created_at: nowIso,
            updated_at: nowIso
        },
        // Archived Event Contestants
        {
            _id: 'contestant-archived-01',
            event_id: archivedEventId,
            contestant_number: 1,
            number: 1,
            name: 'BukSU Kalasag Dance Guild',
            department_or_org: 'College of Social Sciences',
            representation: 'College of Social Sciences',
            entry_type: 'team',
            is_active: true,
            status: 'active',
            created_at: '2025-10-01T08:00:00.000Z'
        },
        {
            _id: 'contestant-archived-02',
            event_id: archivedEventId,
            contestant_number: 2,
            number: 2,
            name: 'Heritage Rondalla Ensemble (Deactivated)',
            department_or_org: 'Culture & Arts Office',
            representation: 'Culture & Arts Office',
            entry_type: 'team',
            is_active: false,
            status: 'deactivated',
            created_at: '2025-10-01T08:00:00.000Z'
        }
    ];

    await collections.contestants.insertMany(contestantDocs);
    console.log('✓ Contestants Registered (Active & Deactivated Entries)');

    // 6. Scores across all 4 States (Locked, Submitted, In-Progress/Draft, Not-Started)
    await collections.scores.deleteMany({ event_id: { $in: [activeEventId, archivedEventId, String(activeEventId), String(archivedEventId)] } });

    const scoreDocs = [
        // State 1: LOCKED & TABULATOR-VERIFIED SCORE
        // Maria Santos (Contestant 1) by judge_01
        {
            _id: 'score-talent-c1-j1',
            event_id: activeEventId,
            contestant_id: 'contestant-active-01',
            judge_id: String(judge01._id),
            criteria_scores: [
                { criteria_id: 'crit-talent-01', max: 100, score: 92, sub_scores: { 'cat-t1': 23, 'cat-t2': 23, 'cat-t3': 23, 'cat-t4': 23 } },
                { criteria_id: 'crit-talent-02', max: 100, score: 90, sub_scores: { 'cat-a1': 32, 'cat-a2': 31, 'cat-a3': 27 } },
                { criteria_id: 'crit-talent-03', max: 100, score: 94, sub_scores: { 'cat-o1': 47, 'cat-o2': 47 } }
            ],
            total_score: 91.80, // 92*0.4 + 90*0.35 + 94*0.25 = 36.8 + 31.5 + 23.5 = 91.80
            status: 'submitted',
            is_locked: true,
            is_verified: true,
            verified_by: tab01.username,
            verified_at: nowIso,
            submitted_at: nowIso,
            locked_at: nowIso,
            version: 1,
            comments: 'Flawless tonal delivery and masterful dynamic pacing.'
        },

        // State 2: SUBMITTED (Awaiting Tabulator Verification)
        // Maria Santos (Contestant 1) by judge_02
        {
            _id: 'score-talent-c1-j2',
            event_id: activeEventId,
            contestant_id: 'contestant-active-01',
            judge_id: String(judge02._id),
            criteria_scores: [
                { criteria_id: 'crit-talent-01', max: 100, score: 88, sub_scores: { 'cat-t1': 22, 'cat-t2': 22, 'cat-t3': 22, 'cat-t4': 22 } },
                { criteria_id: 'crit-talent-02', max: 100, score: 89, sub_scores: { 'cat-a1': 31, 'cat-a2': 31, 'cat-a3': 27 } },
                { criteria_id: 'crit-talent-03', max: 100, score: 90, sub_scores: { 'cat-o1': 45, 'cat-o2': 45 } }
            ],
            total_score: 88.85, // 88*0.4 + 89*0.35 + 90*0.25 = 35.2 + 31.15 + 22.5 = 88.85
            status: 'submitted',
            is_locked: false,
            is_verified: false,
            submitted_at: nowIso,
            version: 1,
            comments: 'Strong performance with brilliant stage energy.'
        },

        // State 3: SUBMITTED (from judge_01) on Contestant 2
        {
            _id: 'score-talent-c2-j1',
            event_id: activeEventId,
            contestant_id: 'contestant-active-02',
            judge_id: String(judge01._id),
            criteria_scores: [
                { criteria_id: 'crit-talent-01', max: 100, score: 85, sub_scores: { 'cat-t1': 21, 'cat-t2': 21, 'cat-t3': 21, 'cat-t4': 22 } },
                { criteria_id: 'crit-talent-02', max: 100, score: 86, sub_scores: { 'cat-a1': 30, 'cat-a2': 30, 'cat-a3': 26 } },
                { criteria_id: 'crit-talent-03', max: 100, score: 88, sub_scores: { 'cat-o1': 44, 'cat-o2': 44 } }
            ],
            total_score: 86.10, // 85*0.4 + 86*0.35 + 88*0.25 = 34 + 30.1 + 22 = 86.10
            status: 'submitted',
            is_locked: false,
            is_verified: false,
            submitted_at: nowIso,
            version: 1
        },

        // State 4: IN-PROGRESS / DRAFT (from judge_02) on Contestant 2
        {
            _id: 'score-talent-c2-j2',
            event_id: activeEventId,
            contestant_id: 'contestant-active-02',
            judge_id: String(judge02._id),
            criteria_scores: [
                { criteria_id: 'crit-talent-01', max: 100, score: 80, sub_scores: { 'cat-t1': 20, 'cat-t2': 20, 'cat-t3': 20, 'cat-t4': 20 } },
                { criteria_id: 'crit-talent-02', max: 100, score: 75, sub_scores: { 'cat-a1': 25, 'cat-a2': 25, 'cat-a3': 25 } }
            ],
            total_score: 77.50,
            status: 'draft',
            is_locked: false,
            is_verified: false,
            version: 1
        },

        // State 5: IN-PROGRESS / DRAFT (from judge_01) on Contestant 3
        {
            _id: 'score-talent-c3-j1',
            event_id: activeEventId,
            contestant_id: 'contestant-active-03',
            judge_id: String(judge01._id),
            criteria_scores: [
                { criteria_id: 'crit-talent-01', max: 100, score: 84, sub_scores: { 'cat-t1': 21, 'cat-t2': 21, 'cat-t3': 21, 'cat-t4': 21 } }
            ],
            total_score: 84.00,
            status: 'draft',
            is_locked: false,
            is_verified: false,
            version: 1
        }

        // Contestant 3 (judge_02) -> NOT-STARTED (no score record)
        // Contestant 4 (judge_01 & judge_02) -> NOT-STARTED (no score record)
    ];

    await collections.scores.insertMany(scoreDocs);
    console.log('✓ Scoring Fixtures Populated across All 4 States (Locked, Submitted, In-Progress/Draft, Not-Started)');

    // 7. Notifications Channel for Assigned Personnel
    await collections.notifications.deleteMany({
        user_id: { $in: [judge01._id, judge02._id, tab01._id, String(judge01._id), String(judge02._id), String(tab01._id)] }
    });

    const notifDocs = [
        {
            user_id: judge01._id,
            type: 'event_invitation',
            title: 'Event Assignment Confirmation',
            message: 'You are designated as official Adjudicator for "Annual Talent Championship 2026".',
            event_id: activeEventId,
            role: 'judge',
            status: 'accepted',
            is_read: true,
            created_at: now
        },
        {
            user_id: judge01._id,
            type: 'judging_notification',
            title: 'Judging Period Active',
            message: 'The evaluation period for "Annual Talent Championship 2026" is now OPEN. You may score contestants.',
            event_id: activeEventId,
            role: 'judge',
            status: 'unread',
            is_read: false,
            created_at: now
        },
        {
            user_id: judge02._id,
            type: 'event_invitation',
            title: 'Event Assignment Confirmation',
            message: 'You are designated as official Adjudicator for "Annual Talent Championship 2026".',
            event_id: activeEventId,
            role: 'judge',
            status: 'accepted',
            is_read: true,
            created_at: now
        },
        {
            user_id: judge02._id,
            type: 'judging_notification',
            title: 'Judging Period Active',
            message: 'The evaluation period for "Annual Talent Championship 2026" is now OPEN. You may score contestants.',
            event_id: activeEventId,
            role: 'judge',
            status: 'unread',
            is_read: false,
            created_at: now
        },
        {
            user_id: tab01._id,
            type: 'event_invitation',
            title: 'Tabulator Assignment Confirmation',
            message: 'You are designated as Lead Tabulator for "Annual Talent Championship 2026".',
            event_id: activeEventId,
            role: 'tabulator',
            status: 'accepted',
            is_read: true,
            created_at: now
        },
        {
            user_id: tab01._id,
            type: 'judging_notification',
            title: 'Live Tabulation Available',
            message: 'Judges have begun submitting scores for "Annual Talent Championship 2026". Open the tabulation board to monitor verification status.',
            event_id: activeEventId,
            role: 'tabulator',
            status: 'unread',
            is_read: false,
            created_at: now
        }
    ];

    await collections.notifications.insertMany(notifDocs);
    console.log('✓ Notifications Channel Seeded (Invitation & Active Judging Alerts)');

    // 8. Audit Log History
    const auditLogs = [
        {
            userId: String(adminMain._id),
            username: adminMain.username,
            role: 'admin',
            action: 'CREATE_EVENT',
            details: 'Created competition #8: "Annual Talent Championship 2026"',
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000)
        },
        {
            userId: String(adminMain._id),
            username: adminMain.username,
            role: 'admin',
            action: 'UPDATE_CRITERIA_WEIGHTS',
            details: 'Configured 3 judging criteria with balanced weights: Technical (40%), Artistic (35%), Presentation (25%).',
            timestamp: new Date(Date.now() - 3.5 * 60 * 60 * 1000)
        },
        {
            userId: String(adminMain._id),
            username: adminMain.username,
            role: 'admin',
            action: 'CREATE_CONTESTANT',
            details: 'Registered 5 contestants (active & deactivated records) for Event #8.',
            timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000)
        },
        {
            userId: String(adminMain._id),
            username: adminMain.username,
            role: 'admin',
            action: 'ASSIGN_PERSONNEL',
            details: 'Assigned judges (judge_01, judge_02) and tabulator (tabulator_01) to Event #8.',
            timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000)
        },
        {
            userId: String(adminMain._id),
            username: adminMain.username,
            role: 'admin',
            action: 'TOGGLE_JUDGING',
            details: 'Opened judging period for "Annual Talent Championship 2026" (In Progress).',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
        },
        {
            userId: String(judge01._id),
            username: judge01.username,
            role: 'judge',
            action: 'SUBMIT_SCORE',
            details: 'Submitted final score (91.80%) for Contestant #1 "Maria Santos".',
            timestamp: new Date(Date.now() - 90 * 60 * 1000)
        },
        {
            userId: String(judge01._id),
            username: judge01.username,
            role: 'judge',
            action: 'ASSIGN_SPECIAL_AWARD',
            details: 'Conferred special citation "Exceptional Vocal Modulation" to Contestant #1.',
            timestamp: new Date(Date.now() - 85 * 60 * 1000)
        },
        {
            userId: String(tab01._id),
            username: tab01.username,
            role: 'tabulator',
            action: 'VERIFY_SCORE',
            details: 'Verified and locked score for Contestant #1 (Judge: judge_01).',
            timestamp: new Date(Date.now() - 60 * 60 * 1000)
        },
        {
            userId: String(judge02._id),
            username: judge02.username,
            role: 'judge',
            action: 'SUBMIT_SCORE',
            details: 'Submitted score (88.85%) for Contestant #1 "Maria Santos".',
            timestamp: new Date(Date.now() - 45 * 60 * 1000)
        },
        {
            userId: String(judge01._id),
            username: judge01.username,
            role: 'judge',
            action: 'SUBMIT_SCORE',
            details: 'Submitted score (86.10%) for Contestant #2 "John Reyes".',
            timestamp: new Date(Date.now() - 30 * 60 * 1000)
        },
        {
            userId: String(judge02._id),
            username: judge02.username,
            role: 'judge',
            action: 'SAVE_DRAFT_SCORE',
            details: 'Saved draft scoring evaluation for Contestant #2 "John Reyes".',
            timestamp: new Date(Date.now() - 15 * 60 * 1000)
        }
    ];

    await collections.logs.insertMany(auditLogs);
    console.log('✓ Audit Log History Seeded (11 Realistic Action Records)');

    console.log('===========================================================');
    console.log('🎉 SEEDING COMPLETE! Test credentials summary:');
    console.log('-----------------------------------------------------------');
    console.log('ADMIN:');
    console.log('  Email:    admin_main@djs.com');
    console.log('  Password: admin123');
    console.log('  PIN:      123456');
    console.log('');
    console.log('JUDGES:');
    console.log('  judge_01 (assigned):          judge_01@djs.com          / judge123');
    console.log('  judge_02 (assigned):          judge_02@djs.com          / judge123');
    console.log('  judge_unassigned:             judge_unassigned@djs.com  / judge123');
    console.log('  judge_deactivated (disabled): judge_deactivated@djs.com / judge123');
    console.log('');
    console.log('TABULATORS:');
    console.log('  tabulator_01 (active):        tabulator_01@djs.com      / tab123');
    console.log('  tabulator_deactivated (off):  tabulator_deactivated@djs.com / tab123');
    console.log('===========================================================');
}

seed()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('❌ Seeding failed:', err);
        process.exit(1);
    });

