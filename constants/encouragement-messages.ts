export const EncouragementMessages = {
  success: ['Wonderful! ❤️', 'Well done!', 'You remembered it!', 'Splendid work!'],
  retry: [
    "Almost! Let's try once more.",
    "That's okay. Here's a little help.",
    "Take your time, you're doing great.",
  ],
} as const;

export type EncouragementTone = keyof typeof EncouragementMessages;
export type EncouragementMessage = (typeof EncouragementMessages)[EncouragementTone][number];
