export const CareScopes = ['daily_activity', 'reminders', 'cognitive_activity', 'reports', 'memories'] as const;
export type CareScope = typeof CareScopes[number];
export const CareRoles = ['family', 'caregiver', 'healthcare_worker'] as const;
export type CareRole = typeof CareRoles[number];
export const CareRelationships = ['daughter', 'son', 'spouse', 'family_member', 'caregiver', 'healthcare_worker'] as const;
export type CareMember = {
  id: string; patient_id: string; display_name: string; relationship: string; access_role: CareRole;
  email: string | null; phone: string | null; status: 'local' | 'revoked'; scopes: string;
  created_at: string; updated_at: string;
};
export type CareMemberInput = Pick<CareMember, 'display_name' | 'relationship' | 'access_role' | 'email' | 'phone'> & { scopes: CareScope[] };
// Roles describe the person; only explicitly selected scopes grant effective access.
export function effectiveScopes(member: CareMember): CareScope[] {
  return member.status === 'local' ? parseScopes(member.scopes) : [];
}
export function parseScopes(value: string): CareScope[] {
  const scopes: unknown = JSON.parse(value);
  if (!Array.isArray(scopes) || scopes.some(s => !CareScopes.includes(s)) || new Set(scopes).size !== scopes.length) throw new Error('Invalid access scopes.');
  return scopes;
}
export function validateMember(input: CareMemberInput): CareMemberInput {
  const text = (value: unknown, max: number, required = false) => {
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f]/u.test(value) || (required && !value.trim())) throw new Error('Invalid trusted person.');
    return value.trim();
  };
  if (!CareRoles.includes(input.access_role)) throw new Error('Invalid access role.');
  const email = text(input.email ?? '', 254);
  let phone: string | null = null;
  if (input.phone) {
    phone = input.phone.trim().replace(/[\s()-]/gu, '');
    if (/^[0-9]{10}$/.test(phone)) phone = `+91${phone}`;
    else if (/^0([0-9]{10})$/.test(phone)) phone = `+91${phone.slice(1)}`;
    else if (/^[0-9]+$/.test(phone) && phone.length >= 5 && phone.length <= 15) phone = `+${phone}`;
    if (!/^\+[1-9]\d{4,14}$/.test(phone)) throw new Error('Invalid phone.');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email.');
  return { display_name: text(input.display_name, 80, true), relationship: text(input.relationship, 100, true),
    access_role: input.access_role, email: email || null, phone: phone || null, scopes: parseScopes(JSON.stringify(input.scopes)) };
}
