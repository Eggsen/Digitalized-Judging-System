const pdfmake = require('pdfmake');
const { resolveImageBase64, isValidPdfKitImage } = require('./tabulationPdfGenerator');
const { formatActionTerm } = require('./logger');

// Configure Roboto standard fonts
pdfmake.setFonts(require('pdfmake/fonts/Roboto'));
if (typeof pdfmake.setUrlAccessPolicy === 'function') {
    pdfmake.setUrlAccessPolicy(() => true);
}
if (typeof pdfmake.setLocalAccessPolicy === 'function') {
    pdfmake.setLocalAccessPolicy(() => true);
}

/**
 * Helper to get badge colors for an action term
 */
function getActionPdfBadge(actionStr = '', rawAction = '') {
    const act = (actionStr || rawAction || '').toUpperCase();

    if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('FAIL') || act.includes('REJECT')) {
        return { bg: '#FEE2E2', text: '#B91C1C' }; // Rose
    }
    if (act.includes('CREATE') || act.includes('ADD') || act.includes('PUBLISH') || act.includes('SUCCESS')) {
        return { bg: '#DCFCE7', text: '#15803D' }; // Green
    }
    if (act.includes('LOGIN') || act.includes('SIGNIN') || act.includes('AUTH')) {
        return { bg: '#E0E7FF', text: '#3730A3' }; // Indigo
    }
    if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('MODIFY') || act.includes('ASSIGN')) {
        return { bg: '#DBEAFE', text: '#1D4ED8' }; // Blue
    }
    if (act.includes('ARCHIVE') || act.includes('RESTORE') || act.includes('LOCK')) {
        return { bg: '#FEF3C7', text: '#B45309' }; // Amber
    }
    if (act.includes('SUBMIT') || act.includes('VERIFY') || act.includes('SCORE') || act.includes('TALLY')) {
        return { bg: '#F3E8FF', text: '#7E22CE' }; // Purple
    }

    return { bg: '#F1F5F9', text: '#475569' }; // Slate
}

/**
 * Format a Date or timestamp string into readable date and time
 */
function formatTimestampDisplay(val) {
    if (!val) return '—';
    try {
        const d = (val instanceof Date) ? val : new Date(val);
        if (isNaN(d.getTime())) return String(val);
        return d.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    } catch (e) {
        return String(val);
    }
}

/**
 * Generate a complete PDF document buffer for System Audit Logs
 * @param {Object} options
 * @param {Array} options.logs List of formatted log records
 * @param {Object} options.filters Applied filters ({ search, role, date, sort, total })
 * @param {Object} options.adminUser Information about the administrator requesting the export
 * @param {Object} options.settings System settings (branding, etc.)
 * @returns {Promise<Buffer>} PDF file buffer
 */
async function generateAuditLogPDF({ logs = [], filters = {}, adminUser = {}, settings = {} }) {
    const branding = settings.branding || {};
    const institutionName = (branding.institutionName || 'BUKIDNON STATE UNIVERSITY').toUpperCase();
    const campusUnit = branding.campusUnit || 'OFFICE OF THE SYSTEM ADMINISTRATOR';

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

    const generatedAt = new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'medium'
    });

    const adminName = adminUser.full_name || adminUser.name || adminUser.username || 'System Administrator';
    const adminRole = (adminUser.role || 'Administrator').toUpperCase();

    // Summary filter strings
    const filterScopeText = filters.date ? `Exact Date: ${filters.date}` : 'All Historical Records';
    const filterRoleText = (!filters.role || filters.role === 'all') ? 'All User Roles' : `Role: ${filters.role.toUpperCase()}`;
    const filterSearchText = filters.search ? `"${filters.search}"` : 'None (Unfiltered)';
    const sortText = (filters.sort === 'asc') ? 'Oldest First (Ascending)' : 'Newest First (Descending)';
    const totalCountText = `${logs.length} ${logs.length === 1 ? 'Record' : 'Records'}${filters.total && filters.total !== logs.length ? ` (Filtered from ${filters.total} Total)` : ''}`;

    // Table Header Row
    const tableHeader = [
        { text: '#', bold: true, alignment: 'center', fillColor: '#0F2C59', color: '#FFFFFF', fontSize: 7.5 },
        { text: 'TIMESTAMP', bold: true, alignment: 'left', fillColor: '#0F2C59', color: '#FFFFFF', fontSize: 7.5 },
        { text: 'USER & ROLE', bold: true, alignment: 'left', fillColor: '#0F2C59', color: '#FFFFFF', fontSize: 7.5 },
        { text: 'ACTION PERFORMED', bold: true, alignment: 'center', fillColor: '#0F2C59', color: '#FFFFFF', fontSize: 7.5 },
        { text: 'DETAILS & SYSTEM CONTEXT', bold: true, alignment: 'left', fillColor: '#0F2C59', color: '#FFFFFF', fontSize: 7.5 },
        { text: 'IP ADDRESS', bold: true, alignment: 'center', fillColor: '#0F2C59', color: '#FFFFFF', fontSize: 7.5 }
    ];

    const bodyRows = [tableHeader];

    if (!logs || logs.length === 0) {
        bodyRows.push([
            {
                colSpan: 6,
                text: 'No audit log entries match the selected filter criteria.',
                alignment: 'center',
                italics: true,
                color: '#64748B',
                fontSize: 8.5,
                margin: [0, 16, 0, 16]
            },
            {}, {}, {}, {}, {}
        ]);
    } else {
        logs.forEach((log, idx) => {
            const isAlternate = idx % 2 === 1;
            const defaultRowBg = isAlternate ? '#F8FAFC' : '#FFFFFF';

            const rawAction = log.rawAction || log.raw_action || log.action || 'ACTIVITY';
            const readableAction = formatActionTerm(log.action || rawAction);
            const badge = getActionPdfBadge(readableAction, rawAction);

            const userRole = (log.role || 'user').toUpperCase();
            let roleBadgeBg = '#E2E8F0';
            let roleBadgeColor = '#334155';
            if (userRole === 'ADMIN' || userRole === 'ADMINISTRATOR') {
                roleBadgeBg = '#FEF3C7';
                roleBadgeColor = '#92400E';
            } else if (userRole === 'JUDGE') {
                roleBadgeBg = '#DBEAFE';
                roleBadgeColor = '#1E40AF';
            } else if (userRole === 'TABULATOR') {
                roleBadgeBg = '#DCFCE7';
                roleBadgeColor = '#166534';
            }

            bodyRows.push([
                // Index
                {
                    text: `${idx + 1}`,
                    alignment: 'center',
                    fillColor: defaultRowBg,
                    fontSize: 7,
                    color: '#64748B'
                },
                // Timestamp
                {
                    text: formatTimestampDisplay(log.timestamp),
                    alignment: 'left',
                    fillColor: defaultRowBg,
                    fontSize: 7,
                    color: '#1E293B'
                },
                // User & Role
                {
                    stack: [
                        { text: log.username || 'System', bold: true, fontSize: 7.5, color: '#0F172A' },
                        {
                            text: `[${userRole}]`,
                            fontSize: 6.5,
                            bold: true,
                            color: roleBadgeColor,
                            margin: [0, 1, 0, 0]
                        }
                    ],
                    fillColor: defaultRowBg
                },
                // Action Badge
                {
                    table: {
                        widths: ['*'],
                        body: [
                            [
                                {
                                    text: readableAction.toUpperCase(),
                                    alignment: 'center',
                                    fontSize: 6.5,
                                    bold: true,
                                    color: badge.text,
                                    fillColor: badge.bg,
                                    margin: [2, 1, 2, 1]
                                }
                            ]
                        ]
                    },
                    layout: 'noBorders',
                    fillColor: defaultRowBg
                },
                // Details
                {
                    text: log.details || log.message || '—',
                    fontSize: 7,
                    color: '#334155',
                    fillColor: defaultRowBg
                },
                // IP Address
                {
                    text: log.ip_address || log.ip || '127.0.0.1',
                    alignment: 'center',
                    fontSize: 6.5,
                    color: '#64748B',
                    fillColor: defaultRowBg
                }
            ]);
        });
    }

    const docDefinition = {
        pageSize: 'A4',
        pageOrientation: 'landscape',
        pageMargins: [36, 30, 36, 32],
        footer: function (currentPage, pageCount) {
            return {
                margin: [36, 10, 36, 0],
                columns: [
                    {
                        text: `${institutionName} • Official System Governance & Audit Trail • Highly Confidential`,
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
            // Top Header: Logo + Title + Document Badge
            {
                columns: [
                    logoDataUrl ? { image: logoDataUrl, width: 44, height: 44 } : { text: '', width: 44 },
                    {
                        width: '*',
                        margin: [8, 0, 8, 0],
                        stack: [
                            { text: institutionName, fontSize: 12, bold: true, color: '#0F2C59' },
                            { text: campusUnit, fontSize: 8, bold: true, color: '#475569', margin: [0, 1, 0, 1] },
                            { text: 'SYSTEM AUDIT TRAIL & GOVERNANCE REPORT', fontSize: 10, bold: true, color: '#B45309' },
                            { text: `Certified Immutable System Record • Generated on ${generatedAt}`, fontSize: 7, color: '#64748B', margin: [0, 1, 0, 0] }
                        ]
                    },
                    {
                        width: 140,
                        table: {
                            widths: ['*'],
                            body: [
                                [
                                    {
                                        stack: [
                                            { text: 'OFFICIAL AUDIT REPORT', bold: true, fontSize: 7.5, color: '#0F2C59', alignment: 'center' },
                                            { text: 'ISO/IEC 27001 COMPLIANT LOGS', fontSize: 6, color: '#059669', alignment: 'center', bold: true, margin: [0, 1, 0, 1] },
                                            { text: `Generated by: ${adminName}`, fontSize: 6.5, color: '#475569', alignment: 'center' }
                                        ],
                                        fillColor: '#F8FAFC',
                                        margin: [4, 4, 4, 4]
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
            // Filter & Scope Metadata Banner
            {
                margin: [0, 10, 0, 10],
                table: {
                    widths: ['25%', '25%', '25%', '25%'],
                    body: [
                        [
                            {
                                stack: [
                                    { text: 'DATE / TIME SCOPE', fontSize: 6, bold: true, color: '#64748B' },
                                    { text: filterScopeText, fontSize: 7.5, bold: true, color: '#0F172A', margin: [0, 1, 0, 0] }
                                ],
                                fillColor: '#F1F5F9'
                            },
                            {
                                stack: [
                                    { text: 'ROLE SCOPE', fontSize: 6, bold: true, color: '#64748B' },
                                    { text: filterRoleText, fontSize: 7.5, bold: true, color: '#0F172A', margin: [0, 1, 0, 0] }
                                ],
                                fillColor: '#F1F5F9'
                            },
                            {
                                stack: [
                                    { text: 'SEARCH FILTER', fontSize: 6, bold: true, color: '#64748B' },
                                    { text: filterSearchText, fontSize: 7.5, bold: true, color: '#0F172A', margin: [0, 1, 0, 0] }
                                ],
                                fillColor: '#F1F5F9'
                            },
                            {
                                stack: [
                                    { text: 'ENTRIES & SORT', fontSize: 6, bold: true, color: '#64748B' },
                                    { text: `${totalCountText} • ${sortText}`, fontSize: 7.5, bold: true, color: '#0F172A', margin: [0, 1, 0, 0] }
                                ],
                                fillColor: '#F1F5F9'
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
                    paddingTop: () => 4,
                    paddingBottom: () => 4
                }
            },
            // Log Data Table
            {
                table: {
                    headerRows: 1,
                    dontBreakRows: true,
                    widths: [22, 110, 95, 110, '*', 70],
                    body: bodyRows
                },
                layout: {
                    hLineWidth: () => 0.5,
                    vLineWidth: () => 0.5,
                    hLineColor: () => '#CBD5E1',
                    vLineColor: () => '#CBD5E1',
                    paddingLeft: () => 4.5,
                    paddingRight: () => 4.5,
                    paddingTop: () => 4,
                    paddingBottom: () => 4
                }
            },
            // Sign-off note
            {
                margin: [0, 12, 0, 0],
                unbreakable: true,
                columns: [
                    {
                        width: '*',
                        text: [
                            { text: 'SECURITY & CONFIDENTIALITY NOTICE: ', bold: true, fontSize: 6.5, color: '#B91C1C' },
                            { text: 'This document contains sensitive audit logs and governance actions captured by the BukSU Digitalized Judging System. Unauthorized reproduction, distribution, or alteration is strictly prohibited and subject to university disciplinary policies and Philippine Republic Act No. 10173 (Data Privacy Act of 2012).', fontSize: 6.5, color: '#64748B' }
                        ]
                    },
                    {
                        width: 180,
                        alignment: 'right',
                        stack: [
                            { text: 'APPROVED & ISSUED BY:', fontSize: 6.5, bold: true, color: '#475569' },
                            { text: adminName.toUpperCase(), fontSize: 8, bold: true, color: '#0F2C59', margin: [0, 3, 0, 1] },
                            { text: `${adminRole} • System Authority`, fontSize: 6.5, color: '#64748B' }
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
        console.warn('[Audit PDF Generator] Rendering error:', pdfErr.message);
        if (logoDataUrl) {
            console.warn('[Audit PDF Generator] Retrying without logo image...');
            docDefinition.content[0].columns[0] = { text: '', width: 44 };
            const safeDoc = pdfmake.createPdf(docDefinition);
            return await safeDoc.getBuffer();
        }
        throw pdfErr;
    }
}

module.exports = {
    generateAuditLogPDF
};

