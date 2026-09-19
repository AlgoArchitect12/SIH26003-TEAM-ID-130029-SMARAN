import { t } from '../i18n/index';
import type { Language } from '../db/schema.types';
import { activityTitleKeys } from '../games/presentation';
import { CareScopes, type CareScope } from './care-circle';
import { parseReportFacts, reportAccess, reportTotals, type ActivityReport } from './reports';

export function reportSections(report: ActivityReport, language: Language, scopes: readonly CareScope[] = CareScopes) {
  const facts = parseReportFacts(report.snapshot), access = reportAccess(scopes);
  const n = (value: number | null) => value === null ? t(language,'analyticsUnknown') : new Intl.NumberFormat(language,{maximumFractionDigits:1}).format(value);
  const percent = (value: number | null) => value === null ? t(language,'analyticsUnknown') : new Intl.NumberFormat(language,{style:'percent',maximumFractionDigits:1}).format(value);
  const date = (value: string) => new Intl.DateTimeFormat(language,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:facts.timezone}).format(new Date(value));
  const totals = reportTotals(facts);
  return [
    { title: `Smaran ${t(language,'reportSummary')}`, lines: [
      `${t(language,'reportPatient')}: ${facts.patientName}`,
      `${t(language,'reportPeriod')}: ${date(report.period_start)} — ${date(new Date(Date.parse(report.period_end)-1).toISOString())} (${facts.timezone})`,
      `${t(language,'reportGeneratedAt')}: ${date(report.generated_at)}`,
    ] },
    ...(access.cognitive ? [{ title:t(language,'circleCognitive'),lines:[
      t(language,'analyticsCompleted',{count:n(totals.sessions)}),
      t(language,'analyticsAccuracy',{accuracy:percent(totals.accuracy),correct:n(totals.correct),attempts:n(totals.attempts)}),
      t(language,'analyticsHints',{hints:n(totals.hints),sessions:n(totals.sessions)}),
      t(language,'analyticsErrors',{count:n(totals.repeatedErrors)}),
      t(language,'analyticsMemoryAttempts'),t(language,'analyticsSelectionAttempts'),t(language,'analyticsCoverage'),
      ...facts.games.flatMap(game => [t(language,activityTitleKeys[game.gameType]),
        t(language,'analyticsCompleted',{count:n(game.sessions)}),
        t(language,'analyticsAccuracy',{accuracy:percent(game.attempts && game.correct !== null ? game.correct/game.attempts : null),correct:n(game.correct),attempts:n(game.attempts)}),
        t(language,'analyticsHints',{hints:n(game.hints),sessions:n(game.sessions)}),t(language,'analyticsErrors',{count:n(game.repeatedErrors)})]),
    ] }] : []),
    ...(access.routine ? [{title:t(language,'reportRoutine'),lines:[
      t(language,'reportCompleted',{count:n(facts.routine.completed)}),t(language,'reportHydration',{count:n(facts.routine.hydration)}),
      t(language,'reportActivityCount',{count:n(facts.routine.activity)}),t(language,'reportAppointmentCount',{count:n(facts.routine.appointment)}),
      t(language,'reportUnknownCategories',{count:n(facts.routine.unknownCategory)}),t(language,'careRoutine'),
      t(language,'careDoneCount',{done:n(facts.routine.completedToday),total:n(facts.routine.scheduledToday)}),t(language,'reportRoutineNotice'),
    ]}] : []),
    ...(access.memories ? [{title:t(language,'circleMemories'),lines:[t(language,'reportMemories',{stored:n(facts.memories.stored),added:n(facts.memories.added)})]}] : []),
    {title:t(language,'reportSafety'),lines:[t(language,'reportDisclaimer')]},
  ];
}
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export function reportHtml(report: ActivityReport, language: Language, scopes: readonly CareScope[] = CareScopes) {
  const sections = reportSections(report,language,scopes);
  return `<!DOCTYPE html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
    <title>${escape(t(language,'reportSummary'))}</title><style>
    @page{size:A4;margin:18mm}body{font-family:system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;color:#1a202c;font-size:11pt;line-height:1.6;overflow-wrap:anywhere;margin:0;padding:0;}
    .header{background-color:#143431;color:#ffffff;padding:24px;border-radius:8px 8px 0 0;margin-bottom:24px;}
    .header h1{margin:0;font-size:24pt;font-weight:600;letter-spacing:-0.5px;}
    .header p{margin:8px 0 0;font-size:12pt;color:#e6fffa;opacity:0.9;}
    .container{padding:0 24px;}
    section{margin-bottom:32px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.05);}
    section:last-child{border:none;background:transparent;box-shadow:none;border-top:2px solid #e2e8f0;border-radius:0;padding:20px 0;}
    h2{font-size:14pt;color:#23776b;margin:0 0 16px;font-weight:600;border-bottom:2px solid #e6fffa;padding-bottom:8px;break-after:avoid;}
    p{margin:8px 0;color:#4a5568;}
    .stat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:16px;}
    .stat-item{background:#f7fafc;padding:12px;border-radius:6px;border-left:4px solid #38b2ac;}
    .stat-value{font-weight:700;font-size:12pt;color:#143431;}
    .footer{margin-top:40px;text-align:center;font-size:9pt;color:#a0aec0;}
    </style></head><body>
    <div class="header">
      <h1>SMARAN AI</h1>
      <p>Professional Care Report</p>
    </div>
    <div class="container">
    ${sections.map((s,i)=>`<section><${i ? 'h2':'h2'}>${escape(s.title)}</${i ? 'h2':'h2'}>
      ${i===0 ? `<div class="stat-grid">${s.lines.map(line=>`<div class="stat-item"><div class="stat-value">${escape(line.split(':')[0])}</div>${escape(line.split(':').slice(1).join(':').trim())}</div>`).join('')}</div>` :
      s.lines.map(line=>`<p>${escape(line)}</p>`).join('')}
    </section>`).join('')}
    <div class="footer">Generated by SMARAN AI &bull; Secure & Confidential</div>
    </div>
    </body></html>`;
}
