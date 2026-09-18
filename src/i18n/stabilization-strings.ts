import type { Language } from '../db/schema.types';

// Seven-language drafts; native-speaker review remains required.
const en = {
  memoryPairSuccess: 'Those two belong together. Let’s find the next pair.',
  regionalYesResponse: 'That’s lovely. Take a moment with this memory.',
  regionalNextResponse: 'That’s okay. Let’s look at another one.',
  regionalNext: 'See another picture',
  lightsProgress: 'Your turn: {current} of {total} taps completed.',
  chessSelectSource: 'Selected piece: {piece} on {square}. Choose a destination below or on the board.',
};
export const stabilizationStrings: Record<Language, Record<keyof typeof en, string>> = {
  en,
  hi: {
    memoryPairSuccess: 'ये दोनों एक जोड़ी हैं। आइए अगली जोड़ी खोजें।',
    regionalYesResponse: 'अच्छा लगा। इस याद के साथ थोड़ा समय बिताएँ।',
    regionalNextResponse: 'कोई बात नहीं। आइए दूसरी तस्वीर देखें।', regionalNext: 'दूसरी तस्वीर देखें',
    lightsProgress: 'आपकी बारी: {total} में से {current} बार छूना पूरा हुआ।',
    chessSelectSource: 'चुना हुआ मोहरा: {square} पर {piece}। नीचे या बोर्ड पर अगला खाना चुनें।',
  },
  as: {
    memoryPairSuccess: 'এই দুটা এযোৰ। আহক, পৰৱৰ্তী যোৰটো বিচাৰোঁ।',
    regionalYesResponse: 'ভাল লাগিল। এই স্মৃতিৰ সৈতে অলপ সময় কটাওক।',
    regionalNextResponse: 'কোনো কথা নাই। আহক, আন এখন ছবি চাওঁ।', regionalNext: 'আন এখন ছবি চাওক',
    lightsProgress: 'আপোনাৰ পাল: {total} বাৰৰ ভিতৰত {current} বাৰ স্পৰ্শ কৰা সম্পূৰ্ণ।',
    chessSelectSource: 'বাছনি কৰা গুটি: {square} ত {piece}। তলত বা বোৰ্ডত গন্তব্য ঘৰ বাছক।',
  },
  bn: {
    memoryPairSuccess: 'এই দুটো একটি জোড়া। চলুন পরের জোড়া খুঁজি।',
    regionalYesResponse: 'ভালো লাগল। এই স্মৃতির সঙ্গে একটু সময় কাটান।',
    regionalNextResponse: 'কোনো অসুবিধা নেই। চলুন অন্য ছবি দেখি।', regionalNext: 'অন্য ছবি দেখুন',
    lightsProgress: 'আপনার পালা: {total} বারের মধ্যে {current} বার ছোঁয়া সম্পূর্ণ।',
    chessSelectSource: 'বাছাই করা ঘুঁটি: {square}-এ {piece}। নিচে বা বোর্ডে গন্তব্য ঘর বেছে নিন।',
  },
  mni: {
    memoryPairSuccess: 'Ani asi pair ama oire. Mathanggi pair thirasi.',
    regionalYesResponse: 'Nungairabani. Ningsingba asiga matam khara leiyu.',
    regionalNextResponse: 'Yare. Atoppa mami ama yengsi.', regionalNext: 'Atoppa mami ama yengbiyu',
    lightsProgress: 'Nahakki matam: {total} gi manungda {current} touch toure.',
    chessSelectSource: 'Khanba piece: {square} da {piece}. Makha nattraga board da chatpham khanbiyu.',
  },
  kha: {
    memoryPairSuccess: 'Kine ar ki iahap. To ngin wad sa kawei ka jur.',
    regionalYesResponse: 'Sngewtynnad. Pynlut khyndiat ka por bad kane ka jingkynmaw.',
    regionalNextResponse: 'Ym lei lei. To ngin peit sa kawei ka dur.', regionalNext: 'Peit sa kawei ka dur',
    lightsProgress: 'Ka pali jong phi: la dep ktah {current} na {total}.',
    chessSelectSource: 'Ka kynja ba la jied: {piece} ha {square}. Jied ka jaka harum ne ha ka board.',
  },
  lus: {
    memoryPairSuccess: 'Heng pahnih hi a inkawp. A dang inkawp i zawng ang.',
    regionalYesResponse: 'A lawmawm e. He hriatrengna hi hun tlem han pe la.',
    regionalNextResponse: 'A pawi lo. Thlalak dang i en ang.', regionalNext: 'Thlalak dang en rawh',
    lightsProgress: 'I turn: {total} zinga {current} khawih zawh a ni.',
    chessSelectSource: 'I thlan: {square} a {piece}. A hnuaiah emaw board-ah emaw kalna tur thlang rawh.',
  },
};
