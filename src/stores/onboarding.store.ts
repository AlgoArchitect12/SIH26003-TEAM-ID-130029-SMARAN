import { create } from 'zustand';

import type { Language, Region, TextSize } from '@db/schema.types';
import type { CareMemberInput } from '../caregiver/care-circle';

export type OnboardingRole = 'patient' | 'caregiver';

export type AccessibilityPreferences = {
  highContrast: boolean;
  reducedMotion: boolean;
  textSize: TextSize;
  voiceGuidance: boolean;
};

export type ProfileDraft = {
  dateOfBirth: string;
  emergencyName: string;
  emergencyPhone: string;
  preferredName: string;
};

type OnboardingState = {
  caregiver: CareMemberInput;
  setCaregiverDraft: (draft: Partial<CareMemberInput>) => void;
  accessibility: AccessibilityPreferences;
  language: Language | null;
  profile: ProfileDraft;
  region: Region | null;
  role: OnboardingRole | null;
  savedProfileId: string | null;
  setSavedProfileId: (id: string) => void;
  resetOnboarding: () => void;
  setAccessibilityPreferences: (preferences: Partial<AccessibilityPreferences>) => void;
  setLanguage: (language: Language) => void;
  setProfileDraft: (profile: Partial<ProfileDraft>) => void;
  setRegion: (region: Region) => void;
  setRole: (role: OnboardingRole | null) => void;
};

const initialState = {
  accessibility: {
    highContrast: false,
    reducedMotion: false,
    textSize: 'large',
    voiceGuidance: true,
  },
  language: null,
  profile: {
    dateOfBirth: '',
    emergencyName: '',
    emergencyPhone: '',
    preferredName: '',
  },
  region: null,
  role: null,
} satisfies Pick<OnboardingState, 'accessibility' | 'language' | 'profile' | 'region' | 'role'>;

export const useOnboardingStore = create<OnboardingState>()((set) => ({
  ...initialState,
  caregiver: { display_name: '', relationship: 'family_member', access_role: 'family', email: '', phone: '', scopes: [] },
  setCaregiverDraft: (draft) => set(state => ({ caregiver: { ...state.caregiver, ...draft } })),
  savedProfileId: null,
  setSavedProfileId: (savedProfileId) => set({ savedProfileId }),
  resetOnboarding: () =>
    set({
      ...initialState,
      savedProfileId: null,
      caregiver: { display_name: '', relationship: 'family_member', access_role: 'family', email: '', phone: '', scopes: [] },
      accessibility: { ...initialState.accessibility },
      profile: { ...initialState.profile },
    }),
  setAccessibilityPreferences: (preferences) =>
    set((state) => ({ accessibility: { ...state.accessibility, ...preferences } })),
  setLanguage: (language) => set({ language }),
  setProfileDraft: (profile) =>
    set((state) => ({ profile: { ...state.profile, ...profile } })),
  setRegion: (region) => set({ region }),
  setRole: (role) => set({ role }),
}));
