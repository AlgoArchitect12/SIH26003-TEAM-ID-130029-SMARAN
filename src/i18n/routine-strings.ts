import type { Language } from '../db/schema.types';

// Titles followed by ordered steps. Draft translations still need native-speaker review.
export const routineStrings: Record<Language, readonly (readonly string[])[]> = {
  en: [
    ['A book in a bag', 'Open the empty bag.', 'Put a book inside the open bag.'],
    ['Putting away a towel', 'Pick up a towel.', 'Fold the towel.', 'Put the folded towel on a shelf.'],
    ['Putting away a pencil', 'Open the empty box.', 'Put a pencil in the open box.', 'Close the box.', 'Put the closed box on a shelf.'],
    ['Keeping a picture', 'Choose a picture.', 'Open an empty envelope.', 'Put the picture in the envelope.', 'Close the envelope.'],
    ['Preparing a bag', 'Put an empty bag on the table.', 'Open the bag.', 'Put a book inside the bag.', 'Close the bag.', 'Place the closed bag on a chair.'],
  ],
  hi: [
    ['बैग में किताब', 'खाली बैग खोलें।', 'खुले बैग में एक किताब रखें।'],
    ['तौलिया रखना', 'एक तौलिया उठाएँ।', 'तौलिया मोड़ें।', 'मुड़ा हुआ तौलिया शेल्फ पर रखें।'],
    ['पेंसिल रखना', 'खाली डिब्बा खोलें।', 'खुले डिब्बे में पेंसिल रखें।', 'डिब्बा बंद करें।', 'बंद डिब्बा शेल्फ पर रखें।'],
    ['तस्वीर सँभालना', 'एक तस्वीर चुनें।', 'खाली लिफाफा खोलें।', 'तस्वीर लिफाफे में रखें।', 'लिफाफा बंद करें।'],
    ['बैग तैयार करना', 'खाली बैग मेज़ पर रखें।', 'बैग खोलें।', 'बैग में किताब रखें।', 'बैग बंद करें।', 'बंद बैग कुर्सी पर रखें।'],
  ],
  as: [
    ['বেগত কিতাপ', 'খালী বেগটো খোলক।', 'খোলা বেগত এখন কিতাপ ৰাখক।'],
    ['গামোচা থোৱা', 'এখন গামোচা লওক।', 'গামোচাখন ভাঁজ কৰক।', 'ভাঁজ কৰা গামোচাখন তাকত ৰাখক।'],
    ['পেঞ্চিল থোৱা', 'খালী বাকচটো খোলক।', 'খোলা বাকচত পেঞ্চিল ৰাখক।', 'বাকচটো বন্ধ কৰক।', 'বন্ধ বাকচটো তাকত ৰাখক।'],
    ['ছবি ৰখা', 'এখন ছবি বাছক।', 'খালী খাম এটা খোলক।', 'ছবিখন খামত ৰাখক।', 'খামটো বন্ধ কৰক।'],
    ['বেগ সাজু কৰা', 'খালী বেগটো মেজত ৰাখক।', 'বেগটো খোলক।', 'বেগত কিতাপ ৰাখক।', 'বেগটো বন্ধ কৰক।', 'বন্ধ বেগটো চকীত ৰাখক।'],
  ],
  bn: [
    ['ব্যাগে বই', 'খালি ব্যাগ খুলুন।', 'খোলা ব্যাগে একটি বই রাখুন।'],
    ['তোয়ালে রাখা', 'একটি তোয়ালে নিন।', 'তোয়ালে ভাঁজ করুন।', 'ভাঁজ করা তোয়ালে তাকে রাখুন।'],
    ['পেন্সিল রাখা', 'খালি বাক্স খুলুন।', 'খোলা বাক্সে পেন্সিল রাখুন।', 'বাক্স বন্ধ করুন।', 'বন্ধ বাক্স তাকে রাখুন।'],
    ['ছবি রাখা', 'একটি ছবি বাছুন।', 'খালি খাম খুলুন।', 'ছবিটি খামে রাখুন।', 'খাম বন্ধ করুন।'],
    ['ব্যাগ তৈরি করা', 'খালি ব্যাগ টেবিলে রাখুন।', 'ব্যাগ খুলুন।', 'ব্যাগে বই রাখুন।', 'ব্যাগ বন্ধ করুন।', 'বন্ধ ব্যাগ চেয়ারে রাখুন।'],
  ],
  mni: [
    ['Bag amada lairik', 'Ahangba bag adu hangbiyu.', 'Hangba bag aduda lairik ama hapchillu.'],
    ['Towel thamba', 'Towel ama lou.','Towel adu nonbiyu.', 'Nonba towel adu shelf da thambiyu.'],
    ['Pencil thamba', 'Ahangba box adu hangbiyu.', 'Hangba box aduda pencil hapchillu.', 'Box adu thingbiyu.', 'Thingba box adu shelf da thambiyu.'],
    ['Mami thamba', 'Mami ama khanbiyu.', 'Ahangba envelope ama hangbiyu.', 'Mami adu envelope da hapchillu.', 'Envelope adu thingbiyu.'],
    ['Bag thourang touba', 'Ahangba bag adu table da thambiyu.', 'Bag adu hangbiyu.', 'Bag aduda lairik hapchillu.', 'Bag adu thingbiyu.', 'Thingba bag adu chair da thambiyu.'],
  ],
  kha: [
    ['Ka kot ha ka pla', 'Plie ka pla kaba thylli.', 'Buh ka kot ha ka pla ba la plie.'],
    ['Buh ka towel', 'Shim ka towel.', 'Khap ka towel.', 'Buh ka towel ba la khap ha ka shelf.'],
    ['Buh u pencil', 'Plie ka synduk kaba thylli.', 'Buh u pencil ha ka synduk ba la plie.', 'Khang ka synduk.', 'Buh ka synduk ba la khang ha ka shelf.'],
    ['Buh ka dur', 'Jied kawei ka dur.', 'Plie ka envelope kaba thylli.', 'Buh ka dur ha ka envelope.', 'Khang ka envelope.'],
    ['Pynkhreh ka pla', 'Buh ka pla kaba thylli halor ka miej.', 'Plie ka pla.', 'Buh ka kot ha ka pla.', 'Khang ka pla.', 'Buh ka pla ba la khang halor ka shuki.'],
  ],
  lus: [
    ['Bag chhunga lehkhabu', 'Bag ruak chu hawng rawh.', 'Bag hawnah lehkhabu dah rawh.'],
    ['Towel dah', 'Towel la rawh.', 'Towel thlep rawh.', 'Towel thlep chu shelf-ah dah rawh.'],
    ['Pencil dah', 'Bawm ruak chu hawng rawh.', 'Bawm hawnah pencil dah rawh.', 'Bawm khar rawh.', 'Bawm khar chu shelf-ah dah rawh.'],
    ['Thlalak dah', 'Thlalak thlang rawh.', 'Envelope ruak hawng rawh.', 'Thlalak chu envelope-ah dah rawh.', 'Envelope khar rawh.'],
    ['Bag buatsaih', 'Bag ruak chu dawhkanah dah rawh.', 'Bag hawng rawh.', 'Bag-ah lehkhabu dah rawh.', 'Bag khar rawh.', 'Bag khar chu thutthlengah dah rawh.'],
  ],
};
