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
    @page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#183c39;font-size:12pt;line-height:1.5;overflow-wrap:anywhere}
    h1{font-size:22pt}h2{font-size:16pt;border-bottom:2px solid #23776b;padding-bottom:6px;break-after:avoid}p{margin:6px 0;orphans:3;widows:3}
    section:last-child{margin-top:24px;border-top:2px solid #23776b}h1,h2{line-height:1.25}</style></head><body>
    ${sections.map((s,i)=>`<section><${i ? 'h2':'h1'}>${escape(s.title)}</${i ? 'h2':'h1'}>${s.lines.map(line=>`<p>${escape(line)}</p>`).join('')}</section>`).join('')}
    </body></html>`;
}
