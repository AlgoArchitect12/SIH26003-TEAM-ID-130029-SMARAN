import type { Language } from '../db/schema.types';

const en = {
  syncScope: 'Account sync · All linked people',
  syncOfflinePending: 'Offline · {count} changes pending',
  syncOfflineHelp: 'Changes are saved on this device. They will sync automatically when connected and the app is open.',
  syncIssue: 'Sync issue',
  syncOnline: 'Waiting to sync',
};
export const syncStrings: Record<Language, Record<keyof typeof en, string>> = {
  en,
  hi: {
    syncScope: 'खाते का सिंक · सभी जुड़े लोग',
    syncOfflinePending: 'ऑफ़लाइन · {count} बदलाव बाकी हैं',
    syncOfflineHelp: 'बदलाव इस डिवाइस पर सहेजे गए हैं। कनेक्शन लौटने और ऐप खुला होने पर वे अपने आप सिंक होंगे।',
    syncIssue: 'सिंक में समस्या', syncOnline: 'सिंक होने की प्रतीक्षा में',
  },
  as: {
    syncScope: 'একাউণ্ট ছিংক · সংযুক্ত সকলো ব্যক্তি',
    syncOfflinePending: 'অফলাইন · {count}টা পৰিৱৰ্তন বাকী আছে',
    syncOfflineHelp: 'পৰিৱৰ্তনবোৰ এই ডিভাইচত সংৰক্ষিত আছে। সংযোগ ঘূৰি আহিলে আৰু এপ খোলা থাকিলে নিজে ছিংক হ’ব।',
    syncIssue: 'ছিংকত সমস্যা', syncOnline: 'ছিংকৰ বাবে অপেক্ষা কৰি আছে',
  },
  bn: {
    syncScope: 'অ্যাকাউন্ট সিঙ্ক · সব যুক্ত ব্যক্তি',
    syncOfflinePending: 'অফলাইন · {count}টি পরিবর্তন বাকি',
    syncOfflineHelp: 'পরিবর্তনগুলি এই ডিভাইসে সংরক্ষিত আছে। সংযোগ ফিরে এলে এবং অ্যাপ খোলা থাকলে নিজে থেকে সিঙ্ক হবে।',
    syncIssue: 'সিঙ্কে সমস্যা', syncOnline: 'সিঙ্কের অপেক্ষায়',
  },
  mni: {
    syncScope: 'একাউন্ট সিংক · শম্নবা মী পুম্নমক',
    syncOfflinePending: 'ওফলাইন · অহোংবা {count} ঙাইরি',
    syncOfflineHelp: 'অহোংবশিং অসি দিভাইস অসিদা সেভ তৌরে। কানেক্সন অমুক ফংবা অমসুং এপ হাংবা মতমদা মশানা সিংক তৌগনি।',
    syncIssue: 'সিংকত সমস্যা লৈ', syncOnline: 'সিংক তৌনবা ঙাইরি',
  },
  kha: {
    syncScope: 'Sync ka account · Baroh ki briew ba la pyniasoh',
    syncOfflinePending: 'Offline · {count} ki jingkylla ki dang ap',
    syncOfflineHelp: 'La buh ki jingkylla ha kane ka phone. Kin sync hi haba ka internet ka wan phai bad ka app ka plie.',
    syncIssue: 'Ka jingeh ha ka sync', syncOnline: 'Dang ap ban sync',
  },
  lus: {
    syncScope: 'Akaun sync · Mi zawmtir zawng zawng',
    syncOfflinePending: 'Offline · Thlak danglamna {count} a la nghak',
    syncOfflineHelp: 'Thlak danglamna hi he phone-ah dah a ni. Internet a awm leh a, app i hawng chuan amahin a sync ang.',
    syncIssue: 'Sync harsatna', syncOnline: 'Sync turin a nghak',
  },
};
