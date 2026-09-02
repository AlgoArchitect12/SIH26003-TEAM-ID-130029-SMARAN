export const Languages = ['en', 'hi', 'as'] as const;
export type Language = (typeof Languages)[number];

export const Regions = [
  'assam',
  'arunachal',
  'manipur',
  'meghalaya',
  'mizoram',
  'nagaland',
  'sikkim',
  'tripura',
] as const;
export type Region = (typeof Regions)[number];

export const TextSizes = ['standard', 'large', 'extra-large'] as const;
export type TextSize = (typeof TextSizes)[number];

export const AgeBrackets = ['60-70', '70-80', '80+'] as const;
export type AgeBracket = (typeof AgeBrackets)[number];

export type PatientProfile = {
  id: string;
  userId: string | null;
  preferredName: string;
  ageBracket: AgeBracket | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PatientSettings = {
  id: string;
  patientId: string;
  language: Language;
  region: Region;
  textSize: TextSize;
  highContrast: boolean;
  voiceGuidance: boolean;
  reducedMotion: boolean;
  updatedAt: string;
};

export type CreatePatientProfileInput = {
  id?: string;
  userId?: string | null;
  preferredName: string;
  ageBracket?: AgeBracket | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
};

export type UpdatePatientProfileInput = Partial<Omit<CreatePatientProfileInput, 'id'>>;

export type UpdatePatientSettingsInput = Partial<
  Pick<
    PatientSettings,
    'language' | 'region' | 'textSize' | 'highContrast' | 'voiceGuidance' | 'reducedMotion'
  >
>;
