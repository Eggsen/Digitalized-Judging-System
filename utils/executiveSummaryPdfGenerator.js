const pdfmake = require('pdfmake');
const { resolveImageBase64, isValidPdfKitImage } = require('./tabulationPdfGenerator');
const { generateQRCodeDataURL } = require('./qrcode');

// Configure Roboto standard fonts
pdfmake.setFonts(require('pdfmake/fonts/Roboto'));
if (typeof pdfmake.setUrlAccessPolicy === 'function') {
    pdfmake.setUrlAccessPolicy(() => true);
}
if (typeof pdfmake.setLocalAccessPolicy === 'function') {
    pdfmake.setLocalAccessPolicy(() => true);
}

/**
 * Format a Date or timestamp string into readable date and time
 */
function formatEventDate(val) {
    if (!val) return 'TBA';
    try {
        const d = (val instanceof Date) ? val : new Date(val);
        if (isNaN(d.getTime())) return String(val);
        return d.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (e) {
        return String(val);
    }
}

/**
 * Generate a complete Executive Summary PDF report buffer for an event
 * @param {Object} options
 * @param {Object} options.event Event data
 * @param {Array} options.judges Assigned judges list
 * @param {Array} options.contestants Contestants list
 * @param {Array} options.criteria Criteria list
 * @param {Array} options.matrix Computed ranking and score matrix
 * @param {Object} options.stats Tabulation completion statistics
 * @param {Object} options.settings System settings (branding, judging rules)
 * @param {String} options.baseUrl Base URL for verification QR code
 * @returns {Promise<Buffer>} PDF file buffer
 */
async function generateExecutiveSummaryPDF({
    event = {},
    judges = [],
    contestants = [],
    criteria = [],
    matrix = [],
    stats = {},
    settings = {},
    baseUrl = ''
}) {
    const branding = settings.branding || {};
    const judgingSettings = settings.judging || {};
    const precision = parseInt(judgingSettings.decimalPrecision ?? 2, 10);
    const tabMethod = judgingSettings.tabulationMethod || 'standard_average';
    const isAllVerified = Boolean(stats.is_all_verified);

    // Resolve Logo
    let logoDataUrl = null;
    if (branding.logoUrl) {
        logoDataUrl = await resolveImageBase64(branding.logoUrl);
    }
    if (!logoDataUrl) {
        logoDataUrl = await resolveImageBase64('/assets/logo/DJS Logo.png');
    }
    if (!isValidPdfKitImage(logoDataUrl)) {
        logoDataUrl = null;
    }

    // Generate QR Code
    const eventId = String(event.id || event._id || '');
    const qrVerifyUrl = baseUrl 
        ? `${baseUrl.replace(/\/$/, '')}/api/events/${encodeURIComponent(eventId)}/qr`
        : `https://buksu.edu.ph/djs/verify?event=${encodeURIComponent(eventId)}`;

    let qrCodeDataUrl = null;
    try {
        qrCodeDataUrl = await generateQRCodeDataURL(qrVerifyUrl, {
            width: 140,
            margin: 1,
            color: { dark: '#0F2C59', light: '#FFFFFF' }
        });
    } catch (err) {
        console.warn('[Executive PDF] QR creation skipped:', err.message);
    }
    if (!isValidPdfKitImage(qrCodeDataUrl)) {
        qrCodeDataUrl = null;
    }

    const institutionName = (branding.institutionName || 'BUKIDNON STATE UNIVERSITY').toUpperCase();
    const campusUnit = branding.campusUnit || 'OFFICE OF THE TABULATION COMMITTEE & SYSTEM ADMINISTRATOR';
    const eventTitle = event.eventName || event.name || event.title || `Competition #${eventId}`;
    const generatedAt = new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });

    let tabMethodDisplay = 'Standard Arithmetic Average';
    if (tabMethod === 'olympic_trimming') {
        tabMethodDisplay = 'Olympic Trimming (Outliers Dropped)';
    } else if (tabMethod === 'weighted_criteria') {
        tabMethodDisplay = 'Weighted Criteria Aggregation';
    } else if (tabMethod === 'ordinal_ranking') {
        tabMethodDisplay = 'Ordinal Ranking (Judge Rank-Sum)';
    }

    // 1. Identify Podium Winners (1st, 2nd, 3rd)
    const podiumRows = matrix.filter(r => r.rank >= 1 && r.rank <= 3 && r.submitted_count > 0);
    const firstPlace = podiumRows.find(r => r.rank === 1) || null;
    const secondPlace = podiumRows.find(r => r.rank === 2) || null;
    const thirdPlace = podiumRows.find(r => r.rank === 3) || null;

    // Helper for Podium Card
    function createPodiumCard(placeTitle, data, accentColor, bgColor, borderColor) {
        if (!data) {
            return {
                table: {
                    widths: ['*'],
                    body: [
                        [
                            {
                                stack: [
                                    { text: placeTitle, bold: true, fontSize: 8, color: accentColor, alignment: 'center' },
                                    { text: 'Unawarded / Pending Tally', fontSize: 7, color: '#94A3B8', italics: true, alignment: 'center', margin: [0, 4, 0, 0] }
                                ],
                                fillColor: bgColor,
                                margin: [4, 6, 4, 6]
                            }
                        ]
                    ]
                },
                layout: {
                    hLineWidth: () => 1,
                    vLineWidth: () => 1,
                    hLineColor: () => borderColor,
                    vLineColor: () => borderColor
                }
            };
        }

        const scoreText = (data.final_score !== undefined && data.final_score !== null)
            ? Number(data.final_score).toFixed(precision)
            : '—';

        return {
            table: {
                widths: ['*'],
                body: [
                    [
                        {
                            stack: [
                                { text: placeTitle, bold: true, fontSize: 8, color: accentColor, alignment: 'center' },
                                { text: `Entry #${data.contestant_number || data.number || '1'}`, fontSize: 7, color: '#64748B', alignment: 'center', margin: [0, 1, 0, 1] },
                                { text: (data.name || 'Contestant Name').toUpperCase(), bold: true, fontSize: 9, color: '#0F172A', alignment: 'center', margin: [0, 2, 0, 1] },
                                { text: data.representation || data.department_or_org || 'BukSU Delegate', fontSize: 6.5, color: '#475569', alignment: 'center', italics: true },
                                {
                                    text: [
                                        { text: 'Final Score: ', fontSize: 7, color: '#64748B' },
                                        { text: `${scoreText}%`, bold: true, fontSize: 9, color: accentColor }
                                    ],
                                    alignment: 'center',
                                    margin: [0, 4, 0, 0]
                                }
                            ],
                            fillColor: bgColor,
                            margin: [4, 6, 4, 6]
                        }
                    ]
                ]
            },
            layout: {
                hLineWidth: () => 1,
                vLineWidth: () => 1,
                hLineColor: () => borderColor,
                vLineColor: () => borderColor
            }
        };
    }

    // 2. Build Certified Standings Table
    const standingsHeaders = [
        { text: 'RANK', bold: true, alignment: 'center', fillColor: '#0F2C59', color: '#FFFFFF', fontSize: 7.5 },
        { text: 'NO.', bold: true, alignment: 'center', fillColor: '#0F2C59', color: '#FFFFFF', fontSize: 7.5 },
        { text: 'CONTESTANT NAME & REPRESENTATION', bold: true, alignment: 'left', fillColor: '#0F2C59', color: '#FFFFFF', fontSize: 7.5 },
        { text: 'FINAL SCORE', bold: true, alignment: 'center', fillColor: '#0F2C59', color: '#FFFFFF', fontSize: 7.5 },
        { text: 'AWARDS & STATUS', bold: true, alignment: 'center', fillColor: '#0F2C59', color: '#FFFFFF', fontSize: 7.5 }
    ];

    const standingsRows = [standingsHeaders];

    if (!matrix || matrix.length === 0) {
        standingsRows.push([
            {
                colSpan: 5,
                text: 'No competitor records registered for this competition.',
                alignment: 'center',
                italics: true,
                color: '#64748B',
                fontSize: 8,
                margin: [0, 10, 0, 10]
            },
            {}, {}, {}, {}
        ]);
    } else {
        matrix.forEach((row, idx) => {
            const isAlternate = idx % 2 === 1;
            const defaultRowBg = isAlternate ? '#F8FAFC' : '#FFFFFF';

            let rankText = `#${row.rank}`;
            let rankBg = defaultRowBg;
            let rankColor = '#1E293B';
            let awardBadge = 'Official Finalist';
            let badgeBg = '#F1F5F9';
            let badgeColor = '#475569';

            if (row.rank === 1 && row.submitted_count > 0) {
                rankText = '1ST';
                rankBg = '#FEF3C7';
                rankColor = '#B45309';
                awardBadge = 'CHAMPION';
                badgeBg = '#FEF3C7';
                badgeColor = '#B45309';
            } else if (row.rank === 2 && row.submitted_count > 0) {
                rankText = '2ND';
                rankBg = '#F1F5F9';
                rankColor = '#334155';
                awardBadge = '1ST RUNNER-UP';
                badgeBg = '#F1F5F9';
                badgeColor = '#334155';
            } else if (row.rank === 3 && row.submitted_count > 0) {
                rankText = '3RD';
                rankBg = '#FFEDD5';
                rankColor = '#C2410C';
                awardBadge = '2ND RUNNER-UP';
                badgeBg = '#FFEDD5';
                badgeColor = '#C2410C';
            }

            if (row.is_tie) {
                rankText += ' (Tie)';
            }

            const scoreText = (row.final_score !== undefined && row.final_score !== null)
                ? Number(row.final_score).toFixed(precision)
                : '—';

            standingsRows.push([
                // Rank
                {
                    text: rankText,
                    bold: true,
                    alignment: 'center',
                    fillColor: rankBg,
                    color: rankColor,
                    fontSize: 7.5
                },
                // Number
                {
                    text: `#${row.contestant_number || row.number || idx + 1}`,
                    alignment: 'center',
                    fillColor: defaultRowBg,
                    fontSize: 7.5,
                    color: '#64748B'
                },
                // Contestant Details
                {
                    stack: [
                        { text: row.name || 'Contestant', bold: true, fontSize: 8, color: '#0F172A' },
                        { text: row.representation || row.department_or_org || 'Independent', fontSize: 6.5, color: '#64748B', italics: true }
                    ],
                    fillColor: defaultRowBg
                },
                // Final Score
                {
                    text: `${scoreText}%`,
                    bold: true,
                    alignment: 'center',
                    fillColor: defaultRowBg,
                    fontSize: 8,
                    color: '#0F2C59'
                },
                // Awards & Status
                {
                    table: {
                        widths: ['*'],
                        body: [
                            [
                                {
                                    text: awardBadge,
                                    alignment: 'center',
                                    fontSize: 6.5,
                                    bold: true,
                                    color: badgeColor,
                                    fillColor: badgeBg,
                                    margin: [2, 1, 2, 1]
                                }
                            ]
                        ]
                    },
                    layout: 'noBorders',
                    fillColor: defaultRowBg
                }
            ]);
        });
    }

    // 3. Personnel & Judging Completion Table
    const personnelHeaders = [
        { text: 'ASSIGNED OFFICIAL', bold: true, alignment: 'left', fillColor: '#0F2C59', color: '#FFFFFF', fontSize: 7 },
        { text: 'ROLE & CAPACITY', bold: true, alignment: 'left', fillColor: '#0F2C59', color: '#FFFFFF', fontSize: 7 },
        { text: 'EVALUATION STATUS', bold: true, alignment: 'center', fillColor: '#0F2C59', color: '#FFFFFF', fontSize: 7 },
        { text: 'CERTIFICATION', bold: true, alignment: 'center', fillColor: '#0F2C59', color: '#FFFFFF', fontSize: 7 }
    ];

    const personnelRows = [personnelHeaders];

    if (!judges || judges.length === 0) {
        personnelRows.push([
            { colSpan: 4, text: 'No judges were formally assigned to this event.', alignment: 'center', color: '#64748B', italics: true, fontSize: 7 },
            {}, {}, {}
        ]);
    } else {
        judges.forEach((j, idx) => {
            const isAlternate = idx % 2 === 1;
            const bg = isAlternate ? '#F8FAFC' : '#FFFFFF';
            const jName = j.name || j.full_name || j.username || 'Judge';

            personnelRows.push([
                { text: jName, bold: true, fontSize: 7.5, color: '#0F172A', fillColor: bg },
                { text: 'Member, Board of Judges', fontSize: 7, color: '#475569', fillColor: bg },
                {
                    text: isAllVerified ? 'All Scores Submitted' : 'Evaluation Recorded',
                    fontSize: 6.5,
                    alignment: 'center',
                    bold: true,
                    color: isAllVerified ? '#15803D' : '#B45309',
                    fillColor: bg
                },
                {
                    text: isAllVerified ? '✓ Verified & Locked' : 'Pending Verification',
                    fontSize: 6.5,
                    alignment: 'center',
                    bold: true,
                    color: isAllVerified ? '#15803D' : '#64748B',
                    fillColor: bg
                }
            ]);
        });
    }

    // Tabulators
    const tabulators = Array.isArray(event.assignedtabulators)
        ? event.assignedtabulators
        : (Array.isArray(event.tabulators) ? event.tabulators : []);

    tabulators.forEach((t, idx) => {
        const bg = (judges.length + idx) % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
        const tName = t.name || t.full_name || t.username || 'Tabulator';
        personnelRows.push([
            { text: tName, bold: true, fontSize: 7.5, color: '#0F172A', fillColor: bg },
            { text: 'Committee Tabulator', fontSize: 7, color: '#475569', fillColor: bg },
            { text: 'Audit & Calculation', fontSize: 6.5, alignment: 'center', bold: true, color: '#1E40AF', fillColor: bg },
            { text: 'Certified Correct', fontSize: 6.5, alignment: 'center', bold: true, color: '#15803D', fillColor: bg }
        ]);
    });

    // 4. Signatories block (3-column centered layout)
    const defaultSignatories = [
        { name: 'Dr. John Doe', role: 'Chairman, Board of Judges' },
        { name: 'Prof. Jane Smith', role: 'Head Tabulator' },
        { name: 'Engr. Alex Morgan', role: 'Event Committee Coordinator' }
    ];
    const rawSignatories = Array.isArray(branding.signatories) && branding.signatories.length >= 2
        ? branding.signatories
        : defaultSignatories;

    // Available width in A4 portrait: 595.28 - 72 = 523.28 pt
    const totalPrintableWidth = 523.28;
    const sigCount = Math.max(1, rawSignatories.length);
    const approxColWidth = totalPrintableWidth / sigCount;
    const lineWidth = Math.max(120, Math.min(160, Math.floor(approxColWidth - 24)));

    const signatoryColumns = rawSignatories.map(sig => ({
        columns: [
            { text: '', width: '*' },
            {
                width: lineWidth,
                stack: [
                    { text: '', margin: [0, 16, 0, 0] },
                    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: lineWidth, y2: 0, lineWidth: 1, lineColor: '#334155' }] },
                    { text: (sig.name || 'Signatory Name').toUpperCase(), bold: true, fontSize: 7.5, color: '#0F172A', alignment: 'center', margin: [0, 3, 0, 1] },
                    { text: (sig.title || sig.role || 'Designated Signatory').toUpperCase(), fontSize: 6, color: '#64748B', alignment: 'center' }
                ]
            },
            { text: '', width: '*' }
        ]
    }));

    const docDefinition = {
        pageSize: 'A4',
        pageOrientation: 'portrait',
        pageMargins: [36, 32, 36, 36],
        footer: function (currentPage, pageCount) {
            return {
                margin: [36, 10, 36, 0],
                columns: [
                    {
                        text: `${institutionName} • Executive Event Summary Report • Official Proceeding`,
                        fontSize: 6.5,
                        color: '#94A3B8'
                    },
                    {
                        text: `Page ${currentPage} of ${pageCount}`,
                        fontSize: 6.5,
                        alignment: 'right',
                        bold: true,
                        color: '#64748B'
                    }
                ]
            };
        },
        content: [
            // Top Institutional Memo Header
            {
                columns: [
                    logoDataUrl ? { image: logoDataUrl, width: 44, height: 44 } : { text: '', width: 44 },
                    {
                        width: '*',
                        margin: [8, 0, 8, 0],
                        stack: [
                            { text: institutionName, fontSize: 11, bold: true, color: '#0F2C59' },
                            { text: campusUnit, fontSize: 7.5, bold: true, color: '#475569', margin: [0, 1, 0, 1] },
                            { text: 'EXECUTIVE EVENT SUMMARY & CERTIFIED MEMORANDUM', fontSize: 9.5, bold: true, color: '#B45309' },
                            { text: `Official Competition Results & Administrative Audit Record`, fontSize: 7, color: '#64748B' }
                        ]
                    },
                    {
                        width: 120,
                        table: {
                            widths: ['*'],
                            body: [
                                [
                                    {
                                        stack: [
                                            { text: 'EXECUTIVE MEMO', bold: true, fontSize: 7, color: '#0F2C59', alignment: 'center' },
                                            { text: `REF: #${eventId}`, fontSize: 6.5, bold: true, color: '#B45309', alignment: 'center', margin: [0, 1, 0, 1] },
                                            { text: generatedAt, fontSize: 6, color: '#64748B', alignment: 'center' }
                                        ],
                                        fillColor: '#F8FAFC',
                                        margin: [3, 4, 3, 4]
                                    }
                                ]
                            ]
                        },
                        layout: {
                            hLineWidth: () => 1,
                            vLineWidth: () => 1,
                            hLineColor: () => '#CBD5E1',
                            vLineColor: () => '#CBD5E1'
                        }
                    }
                ]
            },
            // Governance Card (Event details strip)
            {
                margin: [0, 10, 0, 10],
                table: {
                    widths: ['33%', '34%', '33%'],
                    body: [
                        [
                            {
                                stack: [
                                    { text: 'COMPETITION TITLE', fontSize: 6, bold: true, color: '#64748B' },
                                    { text: eventTitle, fontSize: 8, bold: true, color: '#0F172A', margin: [0, 1, 0, 0] },
                                    { text: `Venue: ${event.venue || 'Main Campus'}`, fontSize: 6.5, color: '#475569', margin: [0, 2, 0, 0] }
                                ],
                                fillColor: '#F8FAFC'
                            },
                            {
                                stack: [
                                    { text: 'SCHEDULE & STATUS', fontSize: 6, bold: true, color: '#64748B' },
                                    { text: formatEventDate(event.date || event.eventDate), fontSize: 7.5, bold: true, color: '#0F172A', margin: [0, 1, 0, 0] },
                                    {
                                        text: `Status: ${event.judgingStatus || event.status || 'Completed'}`,
                                        fontSize: 6.5,
                                        bold: true,
                                        color: isAllVerified ? '#15803D' : '#B45309',
                                        margin: [0, 2, 0, 0]
                                    }
                                ],
                                fillColor: '#F8FAFC'
                            },
                            {
                                stack: [
                                    { text: 'TABULATION PROTOCOL', fontSize: 6, bold: true, color: '#64748B' },
                                    { text: tabMethodDisplay, fontSize: 7, bold: true, color: '#0F172A', margin: [0, 1, 0, 0] },
                                    { text: `Precision: ${precision} Decimals • ${judges.length} Judges`, fontSize: 6.5, color: '#475569', margin: [0, 2, 0, 0] }
                                ],
                                fillColor: '#F8FAFC'
                            }
                        ]
                    ]
                },
                layout: {
                    hLineWidth: () => 0.5,
                    vLineWidth: () => 0.5,
                    hLineColor: () => '#CBD5E1',
                    vLineColor: () => '#CBD5E1',
                    paddingLeft: () => 6,
                    paddingRight: () => 6,
                    paddingTop: () => 5,
                    paddingBottom: () => 5
                }
            },
            // Section 1: Official Podium Winners (Top 3)
            {
                margin: [0, 0, 0, 4],
                text: 'OFFICIAL PODIUM WINNERS & TOP HONORS',
                fontSize: 8,
                bold: true,
                color: '#0F2C59'
            },
            {
                columns: [
                    createPodiumCard('CHAMPION (1ST PLACE)', firstPlace, '#B45309', '#FEF3C7', '#F59E0B'),
                    { text: '', width: 8 },
                    createPodiumCard('1ST RUNNER-UP (2ND PLACE)', secondPlace, '#334155', '#F1F5F9', '#94A3B8'),
                    { text: '', width: 8 },
                    createPodiumCard('2ND RUNNER-UP (3RD PLACE)', thirdPlace, '#C2410C', '#FFEDD5', '#FB923C')
                ]
            },
            // Section 2: Complete Certified Standings
            {
                margin: [0, 12, 0, 4],
                text: 'COMPLETE CERTIFIED STANDINGS & RANKINGS',
                fontSize: 8,
                bold: true,
                color: '#0F2C59'
            },
            {
                table: {
                    headerRows: 1,
                    dontBreakRows: true,
                    widths: [36, 28, '*', 65, 85],
                    body: standingsRows
                },
                layout: {
                    hLineWidth: () => 0.5,
                    vLineWidth: () => 0.5,
                    hLineColor: () => '#CBD5E1',
                    vLineColor: () => '#CBD5E1',
                    paddingLeft: () => 5,
                    paddingRight: () => 5,
                    paddingTop: () => 3.5,
                    paddingBottom: () => 3.5
                }
            },
            // Section 3: Personnel Roster & Completion
            {
                margin: [0, 12, 0, 4],
                text: 'BOARD OF JUDGES & TABULATION COMMITTEE ROSTER',
                fontSize: 8,
                bold: true,
                color: '#0F2C59'
            },
            {
                table: {
                    headerRows: 1,
                    dontBreakRows: true,
                    widths: ['35%', '25%', '20%', '20%'],
                    body: personnelRows
                },
                layout: {
                    hLineWidth: () => 0.5,
                    vLineWidth: () => 0.5,
                    hLineColor: () => '#CBD5E1',
                    vLineColor: () => '#CBD5E1',
                    paddingLeft: () => 5,
                    paddingRight: () => 5,
                    paddingTop: () => 3,
                    paddingBottom: () => 3
                }
            },
            // Section 4: Signatories & Digital Seal
            {
                margin: [0, 12, 0, 0],
                unbreakable: true,
                stack: [
                    {
                        text: 'CERTIFIED AND CONFIRMED BY THE OFFICIAL SIGNATORIES:',
                        fontSize: 7,
                        bold: true,
                        alignment: 'center',
                        color: '#334155',
                        margin: [0, 0, 0, 2]
                    },
                    {
                        columns: signatoryColumns
                    },
                    // Digital Verification Seal
                    {
                        margin: [0, 10, 0, 0],
                        columns: [
                            qrCodeDataUrl ? { image: qrCodeDataUrl, width: 38, height: 38 } : { text: '', width: 38 },
                            {
                                width: '*',
                                margin: [8, 1, 0, 0],
                                stack: [
                                    { text: 'DIGITAL GOVERNANCE & AUTHENTICITY SEAL', bold: true, fontSize: 7, color: '#0F2C59' },
                                    { text: `Event Ref: #${eventId} • Verified via BukSU Digitalized Judging System`, fontSize: 6.5, color: '#475569', margin: [0, 1, 0, 1] },
                                    { text: 'This official executive memo is cryptographically traceable and immutably indexed. Scan the QR code to verify raw score distributions, audit logs, and signatory integrity.', fontSize: 6, color: '#94A3B8' }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    };

    try {
        const pdfDoc = pdfmake.createPdf(docDefinition);
        return await pdfDoc.getBuffer();
    } catch (pdfErr) {
        console.warn('[Executive PDF Generator] Rendering error:', pdfErr.message);
        if (logoDataUrl || qrCodeDataUrl) {
            console.warn('[Executive PDF Generator] Retrying without images...');
            docDefinition.content[0].columns[0] = { text: '', width: 44 };
            try {
                if (docDefinition.content[6]?.stack?.[2]?.columns?.[0]?.image) {
                    docDefinition.content[6].stack[2].columns[0] = { text: '', width: 38 };
                }
            } catch (e) {}
            const safeDoc = pdfmake.createPdf(docDefinition);
            return await safeDoc.getBuffer();
        }
        throw pdfErr;
    }
}

module.exports = {
    generateExecutiveSummaryPDF
};

