const pdfmake = require('pdfmake');
const path = require('path');
const fs = require('fs');
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
 * Resolve an image (logo) into a base64 Data URL
 */
function resolveImageBase64(imageUrl) {
    try {
        if (!imageUrl) return null;
        if (imageUrl.startsWith('data:image/')) return imageUrl;

        // Clean query params
        const cleanUrl = imageUrl.split('?')[0];

        // Check local filesystem paths
        let localPath = null;
        if (cleanUrl.startsWith('/assets/')) {
            localPath = path.join(__dirname, '..', cleanUrl);
        } else if (cleanUrl.startsWith('/uploads/')) {
            localPath = path.join(__dirname, '..', cleanUrl);
        } else if (cleanUrl.startsWith('assets/') || cleanUrl.startsWith('uploads/')) {
            localPath = path.join(__dirname, '..', cleanUrl);
        }

        if (localPath && fs.existsSync(localPath)) {
            const ext = path.extname(localPath).toLowerCase().replace('.', '') || 'png';
            const mime = ext === 'jpg' ? 'jpeg' : ext;
            const b64 = fs.readFileSync(localPath).toString('base64');
            return `data:image/${mime};base64,${b64}`;
        }
    } catch (err) {
        console.warn('[PDF Generator] Could not load image:', err.message);
    }
    return null;
}

/**
 * Generate a complete PDF document buffer for an event's tabulation matrix
 * @param {Object} options
 * @param {Object} options.event Event details
 * @param {Array} options.judges Assigned judges
 * @param {Array} options.matrix Contestant matrix rows with scores & rankings
 * @param {Object} options.stats Tabulation statistics
 * @param {Object} options.settings System settings (branding, judging rules)
 * @param {String} options.baseUrl Base URL for QR verification
 * @returns {Promise<Buffer>} PDF file buffer
 */
async function generateTabulationPDF({ event = {}, judges = [], matrix = [], stats = {}, settings = {}, baseUrl = '' }) {
    const branding = settings.branding || {};
    const judgingSettings = settings.judging || {};
    const precision = parseInt(judgingSettings.decimalPrecision ?? 2, 10);
    const tabMethod = judgingSettings.tabulationMethod || 'standard_average';
    const isAllVerified = Boolean(stats.is_all_verified);

    // Resolve Logo
    let logoDataUrl = resolveImageBase64(branding.logoUrl);
    if (!logoDataUrl) {
        logoDataUrl = resolveImageBase64('/assets/logo/DJS Logo.png');
    }

    // Generate Verification QR Code
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
        console.warn('[PDF Generator] QR Code creation skipped:', err.message);
    }

    // Dynamic Date
    const formattedDate = new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });

    // Formatting Helpers
    const institutionName = branding.institutionName || 'BUKIDNON STATE UNIVERSITY';
    const tabulationSubtitle = branding.tabulationSubtitle || 'OFFICE OF STUDENT AFFAIRS & SERVICES • TABULATION COMMITTEE';
    const eventTitle = event.eventName || event.name || event.title || `Competition #${eventId}`;

    // Calculate dynamic column widths
    const judgeCount = Math.max(1, judges.length);
    const judgeColWidth = Math.max(48, Math.min(80, Math.floor(340 / judgeCount)));

    const colWidths = [
        36,             // Rank
        '*',            // Contestant Entry
        ...judges.map(() => judgeColWidth),
        68,             // Final Score
        42              // Final Rank
    ];

    // Table Header Row
    const headerRow = [
        { text: 'RANK', bold: true, alignment: 'center', fillColor: '#0F2C59', color: '#FFFFFF', fontSize: 8 },
        { text: 'CONTESTANT ENTRY', bold: true, fillColor: '#0F2C59', color: '#FFFFFF', fontSize: 8 },
        ...judges.map(j => ({
            text: `${j.username || j.name || 'Judge'}\n(Official Judge)`,
            bold: true,
            alignment: 'center',
            fillColor: '#0F2C59',
            color: '#FFFFFF',
            fontSize: 7.5
        })),
        { text: 'FINAL SCORE', bold: true, alignment: 'center', fillColor: '#0F2C59', color: '#FFFFFF', fontSize: 8 },
        { text: 'RANK', bold: true, alignment: 'center', fillColor: '#0F2C59', color: '#FFFFFF', fontSize: 8 }
    ];

    // Build Table Body Rows
    const bodyRows = [headerRow];

    if (!matrix || matrix.length === 0) {
        bodyRows.push([
            {
                colSpan: colWidths.length,
                text: 'No contestant scores recorded for this event.',
                alignment: 'center',
                italics: true,
                color: '#64748B',
                fontSize: 9,
                margin: [0, 16, 0, 16]
            },
            ...new Array(colWidths.length - 1).fill({})
        ]);
    } else {
        matrix.forEach((row, idx) => {
            const isAlternate = idx % 2 === 1;
            const defaultRowBg = isAlternate ? '#F8FAFC' : '#FFFFFF';

            // Rank Styling
            let rankText = `${row.rank}`;
            let rankBg = defaultRowBg;
            let rankColor = '#1E293B';
            if (row.rank === 1) {
                rankText = '1st';
                rankBg = '#FEF3C7';
                rankColor = '#B45309';
            } else if (row.rank === 2) {
                rankText = '2nd';
                rankBg = '#F1F5F9';
                rankColor = '#334155';
            } else if (row.rank === 3) {
                rankText = '3rd';
                rankBg = '#FFEDD5';
                rankColor = '#C2410C';
            }

            const rankCell = {
                text: rankText,
                bold: true,
                alignment: 'center',
                fillColor: rankBg,
                color: rankColor,
                fontSize: 8.5
            };

            // Contestant Entry Details
            const contestantStack = [
                {
                    text: [
                        { text: `#${row.contestant_number} `, bold: true, color: '#0F2C59', fontSize: 8.5 },
                        { text: row.name || 'Contestant', bold: true, color: '#0F172A', fontSize: 8.5 }
                    ]
                }
            ];

            if (row.department_or_org) {
                contestantStack.push({
                    text: row.department_or_org,
                    fontSize: 7,
                    color: '#64748B',
                    margin: [0, 1, 0, 0]
                });
            }

            if (row.team_members && Array.isArray(row.team_members) && row.team_members.length > 0) {
                contestantStack.push({
                    text: `Team: ${row.team_members.join(', ')}`,
                    fontSize: 6.5,
                    color: '#64748B',
                    italics: true,
                    margin: [0, 1, 0, 0]
                });
            }

            const contestantCell = {
                stack: contestantStack,
                fillColor: defaultRowBg,
                alignment: 'left'
            };

            // Judge Scores Cells
            const judgeCells = judges.map(j => {
                const entry = row.judge_scores ? row.judge_scores[j.id] : null;
                if (!entry || entry.status === 'pending' || entry.total_score === null) {
                    return {
                        text: 'Pending',
                        fontSize: 7,
                        italics: true,
                        color: '#94A3B8',
                        alignment: 'center',
                        fillColor: defaultRowBg
                    };
                }

                const scoreVal = parseFloat(entry.total_score || 0).toFixed(precision);
                const isVerified = Boolean(entry.is_verified);

                return {
                    stack: [
                        { text: `${scoreVal}%`, bold: true, fontSize: 8, color: '#0F172A' },
                        {
                            text: isVerified ? 'Verified' : 'Final',
                            fontSize: 6,
                            color: isVerified ? '#059669' : '#D97706',
                            bold: isVerified
                        }
                    ],
                    alignment: 'center',
                    fillColor: defaultRowBg
                };
            });

            // Final Average Score Cell
            const avgVal = parseFloat(row.average_score || 0).toFixed(precision);
            const finalScoreStack = [
                { text: `${avgVal}%`, bold: true, fontSize: 8.5, color: '#0F2C59' }
            ];
            if (row.is_olympic_trimmed) {
                finalScoreStack.push({
                    text: 'Trimmed',
                    fontSize: 6,
                    color: '#64748B',
                    italics: true
                });
            }

            const finalScoreCell = {
                stack: finalScoreStack,
                alignment: 'center',
                fillColor: defaultRowBg
            };

            // Final Rank Cell
            const finalRankCell = {
                text: `#${row.rank}`,
                bold: true,
                alignment: 'center',
                fillColor: rankBg,
                color: rankColor,
                fontSize: 8.5
            };

            bodyRows.push([
                rankCell,
                contestantCell,
                ...judgeCells,
                finalScoreCell,
                finalRankCell
            ]);
        });
    }

    // Signatories (Default 3 signatories or custom)
    const defaultSignatories = [
        { name: 'John Doe', role: 'Tabulator' },
        { name: 'Jane Smith', role: 'Head Tabulator' },
        { name: 'Dr. Alex Morgan', role: 'Chairman of the Board' }
    ];
    const rawSignatories = Array.isArray(branding.signatories) && branding.signatories.length >= 2
        ? branding.signatories
        : defaultSignatories;

    const signatoryColumns = rawSignatories.map(sig => ({
        stack: [
            { text: '', margin: [0, 20, 0, 0] },
            { canvas: [{ type: 'line', x1: 20, y1: 0, x2: 180, y2: 0, lineWidth: 1, lineColor: '#334155' }] },
            { text: (sig.name || 'Signatory Name').toUpperCase(), bold: true, fontSize: 8, color: '#0F172A', alignment: 'center', margin: [0, 4, 0, 1] },
            { text: (sig.role || 'Designated Signatory').toUpperCase(), fontSize: 6.5, color: '#64748B', alignment: 'center' }
        ]
    }));

    // Method Display Name
    let tabMethodDisplay = 'Standard Average';
    if (tabMethod === 'olympic_trimming') {
        tabMethodDisplay = 'Olympic Trimming (Highest & Lowest Scores Dropped)';
    } else if (tabMethod === 'weighted_criteria') {
        tabMethodDisplay = 'Weighted Criteria Aggregation';
    }

    // Verification Seal Text
    const certBadgeText = isAllVerified ? 'OFFICIAL REPORT\nCERTIFIED CORRECT' : 'PRELIMINARY\nUNVERIFIED DRAFT';
    const certBadgeColor = isAllVerified ? '#0F2C59' : '#B45309';
    const certBadgeBg = isAllVerified ? '#F8FAFC' : '#FEF3C7';

    // Watermark configuration
    let watermarkConfig = null;
    if (!isAllVerified) {
        watermarkConfig = { text: 'UNVERIFIED DRAFT', color: '#E2E8F0', opacity: 0.12, bold: true };
    } else if (branding.watermarkEnabled) {
        watermarkConfig = { text: branding.watermarkText || 'OFFICIAL TABULATION SHEET', color: '#E2E8F0', opacity: 0.12, bold: true };
    }

    // Assemble Document Definition
    const docDefinition = {
        pageSize: 'A4',
        pageOrientation: 'landscape',
        pageMargins: [35, 28, 35, 32],
        watermark: watermarkConfig,
        footer: function (currentPage, pageCount) {
            return {
                margin: [35, 10, 35, 0],
                columns: [
                    {
                        text: 'BukSU Digitalized Judging System • Certified Official Tabulation Sheet',
                        fontSize: 7,
                        color: '#94A3B8'
                    },
                    {
                        text: `Page ${currentPage} of ${pageCount}`,
                        fontSize: 7,
                        alignment: 'right',
                        bold: true,
                        color: '#64748B'
                    }
                ]
            };
        },
        content: [
            // Top Banner: Logo + Institution Titles + Certified Badge
            {
                columns: [
                    logoDataUrl ? { image: logoDataUrl, width: 48, height: 48 } : { text: '', width: 48 },
                    {
                        width: '*',
                        text: [
                            { text: `${institutionName}\n`, fontSize: 13, bold: true, color: '#0F2C59' },
                            { text: `${tabulationSubtitle}\n`, fontSize: 7.5, bold: true, color: '#475569' },
                            { text: `${eventTitle}\n`, fontSize: 11, bold: true, color: '#0F172A' },
                            { text: `Certified Official Tabulation Report • Generated: ${formattedDate}`, fontSize: 7.5, color: '#64748B' }
                        ],
                        alignment: 'center'
                    },
                    {
                        width: 80,
                        table: {
                            widths: ['*'],
                            body: [
                                [
                                    {
                                        text: certBadgeText,
                                        alignment: 'center',
                                        bold: true,
                                        fontSize: 7,
                                        color: certBadgeColor,
                                        fillColor: certBadgeBg
                                    }
                                ]
                            ]
                        },
                        layout: {
                            hLineWidth: () => 1,
                            vLineWidth: () => 1,
                            hLineColor: () => certBadgeColor,
                            vLineColor: () => certBadgeColor
                        }
                    }
                ]
            },
            // Summary Info Strip
            {
                margin: [0, 6, 0, 8],
                columns: [
                    {
                        text: [
                            { text: 'Contestants: ', bold: true, color: '#334155' },
                            { text: `${matrix.length} Entries   `, color: '#64748B' },
                            { text: 'Judges: ', bold: true, color: '#334155' },
                            { text: `${judges.length} Judges   `, color: '#64748B' },
                            { text: 'Tabulation Method: ', bold: true, color: '#334155' },
                            { text: `${tabMethodDisplay}   `, color: '#64748B' },
                            { text: 'Precision: ', bold: true, color: '#334155' },
                            { text: `${precision} Decimals`, color: '#64748B' }
                        ],
                        fontSize: 7.5
                    },
                    {
                        text: isAllVerified ? '✓ All Scores Verified & Certified' : '⚠ Incomplete / Pending Verification',
                        alignment: 'right',
                        bold: true,
                        fontSize: 7.5,
                        color: isAllVerified ? '#059669' : '#D97706'
                    }
                ]
            },
            // Scoring Matrix Table
            {
                table: {
                    headerRows: 1,
                    dontBreakRows: true,
                    widths: colWidths,
                    body: bodyRows
                },
                layout: {
                    hLineWidth: () => 0.5,
                    vLineWidth: () => 0.5,
                    hLineColor: () => '#CBD5E1',
                    vLineColor: () => '#CBD5E1',
                    paddingLeft: () => 5,
                    paddingRight: () => 5,
                    paddingTop: () => 4.5,
                    paddingBottom: () => 4.5
                }
            },
            // Signatories Section
            {
                margin: [0, 14, 0, 0],
                unbreakable: true,
                stack: [
                    {
                        text: 'CERTIFIED CORRECT AND APPROVED BY THE BOARD OF JUDGES & TABULATION COMMITTEE:',
                        fontSize: 7.5,
                        bold: true,
                        alignment: 'center',
                        color: '#334155',
                        margin: [0, 0, 0, 4]
                    },
                    {
                        columns: signatoryColumns
                    },
                    // Digital Verification Seal
                    {
                        margin: [0, 12, 0, 0],
                        columns: [
                            qrCodeDataUrl ? { image: qrCodeDataUrl, width: 42, height: 42 } : { text: '', width: 42 },
                            {
                                width: '*',
                                margin: [8, 2, 0, 0],
                                stack: [
                                    { text: 'DIGITAL VERIFICATION SEAL', bold: true, fontSize: 7.5, color: '#0F2C59' },
                                    { text: `Event Reference: #${eventId} • Validated through BukSU Digitalized Judging System`, fontSize: 7, color: '#475569', margin: [0, 1, 0, 1] },
                                    { text: 'Scan QR code with any mobile device to inspect certified immutable tally logs and score signatures.', fontSize: 6.5, color: '#94A3B8' }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    };

    const pdfDoc = pdfmake.createPdf(docDefinition);
    return await pdfDoc.getBuffer();
}

module.exports = {
    generateTabulationPDF
};

