import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { validateRecordId } from '../utils/validation';
import { careCircleRepository as repo, checkCareRequest } from '../db/repositories/care-circle.repository';
import { CareScopes, effectiveScopes } from '../caregiver/care-circle';
import { reportHtml } from '../caregiver/report-presentation';
import type { Language } from '../db/schema.types';

export class ReportPdfUnavailable extends Error {}
export class ReportEmailUnavailable extends Error {}
// One native print/share operation at a time; repeated taps must not share another patient's artifact.
let busy = false;
export function removeReportPdf(uri: string) {
  const root = new Directory(Paths.cache,'smaran-reports').uri.replace(/\/$/,'') + '/';
  if (!uri.startsWith(root) || decodeURIComponent(uri).split('/').includes('..')) throw new Error('Invalid report artifact.');
  const file = new File(uri); if (file.exists) file.delete();
}
export function cleanupReportPdfs(now = Date.now()) {
  if (Platform.OS === 'web') return;
  const root = new Directory(Paths.cache,'smaran-reports');
  if (!root.exists) return;
  for (const dir of root.list()) if (dir instanceof Directory) {
    for (const file of dir.list()) if (file instanceof File && now - (file.modificationTime ?? 0) > 86400000) removeReportPdf(file.uri);
    if (!dir.list().length) dir.delete();
  }
}
export async function prepareReportPdf(patientId: string, reportId: string, language: Language, current: () => boolean, recipientId?: string, share = false, email = false) {
  if (Platform.OS === 'web') throw new ReportPdfUnavailable();
  if (busy) throw new Error('A report is being prepared.');
  busy = true;
  let artifact: File | null = null;
  let printFile: File | null = null;
  try {
    checkCareRequest(current);
    const report = await repo.report(patientId,reportId);
    if (!report) throw new Error('Missing report.');
    const member = recipientId ? await repo.get(patientId,recipientId) : null;
    if (recipientId && !member) throw new Error('Missing recipient.');
    const scopes = member ? effectiveScopes(member) : CareScopes;
    if (email && (!member?.email || !scopes.includes('reports'))) throw new Error('Choose an authorized recipient with an email address.');
    if (email && !await MailComposer.isAvailableAsync()) throw new ReportEmailUnavailable();
    if (share && !await Sharing.isAvailableAsync()) throw new ReportPdfUnavailable();
    checkCareRequest(current); cleanupReportPdfs();
    const result = await Print.printToFileAsync({html:reportHtml(report,language,scopes),width:595,height:842});
    printFile = new File(result.uri);
    if (!printFile.uri.startsWith(Paths.cache.uri.replace(/\/$/,'') + '/')) throw new Error('Unexpected print artifact.');
    checkCareRequest(current);
    const directory = new Directory(Paths.cache,'smaran-reports',validateRecordId(patientId));
    directory.create({intermediates:true,idempotent:true});
    // Print already supplies a unique name. Never overwrite a file another app is reading.
    artifact = new File(directory,printFile.name);
    if (artifact.exists) artifact.delete();
    printFile.move(artifact); printFile = null;
    // Recheck permissions immediately before export, including revocation during printing.
    if (member) {
      const latest = await repo.get(patientId,member.id);
      if (!latest || latest.updated_at !== member.updated_at || latest.scopes !== member.scopes || latest.status !== member.status || latest.email !== member.email) throw new Error('Recipient access changed.');
    }
    checkCareRequest(current);
    if (!share && !email) { const uri = artifact.uri; artifact = null; return uri; }
    await repo.shareRequested(patientId,reportId,current);
    checkCareRequest(current);
    if (email) await MailComposer.composeAsync({ recipients: [member!.email!], subject: 'SMARAN AI care activity report',
      body: 'Attached is the requested factual care activity report.', attachments: [artifact.uri] });
    else await Sharing.shareAsync(artifact.uri,{mimeType:'application/pdf',UTI:'com.adobe.pdf',dialogTitle:undefined});
    // Android resolves when the chooser returns, before a recipient necessarily reads the URI.
    // Keep its private copy until the next >24h cache sweep; this is not delivery confirmation.
    if (Platform.OS === 'android') artifact = null;
    return null;
  } finally {
    try {
      if (artifact?.exists) artifact.delete();
      if (printFile?.exists && printFile.uri.startsWith(Paths.cache.uri.replace(/\/$/,'') + '/')) printFile.delete();
    } finally { busy = false; }
  }
}
