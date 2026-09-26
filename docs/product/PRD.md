# SMARAN AI — Product Requirements Document

## 1. Product Overview

Smaran AI is an AI-assisted, offline-first cognitive support and memory assistance mobile platform designed for elderly people living with dementia, particularly users living in the North Eastern Region of India.

The application supports cognitive engagement, daily routines, personal memories, culturally familiar experiences, multilingual voice assistance and caregiver monitoring.

Smaran AI is not a diagnostic medical device and does not replace qualified healthcare professionals.

---

## 2. Problem

Elderly people experiencing dementia and age-related cognitive decline may struggle with memory, concentration, recognition, routines and independent daily activities.

Families in geographically remote and rural regions may also have limited access to continuous specialist healthcare.

Many existing digital cognitive applications are:

- internet dependent
- culturally generic
- not designed for elderly accessibility
- limited to brain games
- not connected to caregivers
- poorly localized for North-East India

Smaran AI addresses these limitations through an accessible, personalized and offline-first mobile experience.

---

## 3. Target Users

### Primary User
Elderly people experiencing dementia or age-related cognitive challenges.

### Secondary User
Family caregivers.

### Future Users
Healthcare workers, NGOs, community health workers and healthcare professionals.

---

## 4. Product Goals

1. Encourage regular cognitive engagement.
2. Personalize cognitive activities to each user's performance.
3. Assist users with medicines, hydration, appointments and daily routines.
4. Preserve important personal and family memories.
5. Support culturally and linguistically familiar experiences.
6. Keep essential functionality available without internet.
7. Provide caregivers with useful, non-diagnostic activity insights.
8. Provide a simple elderly-friendly interface.

---

## 5. Core Modules

### Train My Mind

Adaptive cognitive activities including:

- Memory Match
- Sequence Recall
- Attention Focus
- Pattern Recognition
- Routine Recall
- Object Recognition
- Regional Recall

---

### My Day

Daily assistance for:

- Medicines
- Hydration
- Meals
- Daily activities
- Medical appointments
- Routine completion

---

### My Memories

Personal reminiscence support using:

- Family photographs
- Names
- Relationships
- Important life moments
- Familiar descriptions
- Voice messages
- Gentle recall activities

---

### My Home

NER-specific culturally familiar cognitive material.

Regional content architecture supports:

- Assam
- Arunachal Pradesh
- Manipur
- Meghalaya
- Mizoram
- Nagaland
- Sikkim
- Tripura

---

### My Care

Patient wellbeing and caregiver connection.

Includes:

- Emergency contact
- Caregiver profile
- Activity summary
- Reminder status
- Contact caregiver

---

## 6. Adaptive AI

Smaran AI uses an explainable on-device adaptive cognitive engine.

Session features may include:

- accuracy
- response time
- mistakes
- hints
- recent performance
- current difficulty

The model estimates an appropriate next difficulty level.

The model does not diagnose dementia.

It performs cognitive activity personalization only.

---

## 7. Caregiver Dashboard

Caregivers can view:

- cognitive activity completion
- recent performance
- activity duration
- reminder completion
- cognitive trends
- recent patient activity
- non-diagnostic attention indicators

---

## 8. Offline Requirements

Without internet, users must still be able to:

- launch the application
- access cognitive activities
- use the adaptive engine
- access Personal Memories
- view routines
- mark reminders completed
- receive local reminders
- view locally available analytics

Unsynchronized changes should be queued and synchronized when connectivity returns.

---

## 9. Accessibility

The patient experience must provide:

- large text
- large touch targets
- strong contrast
- icon + text labels
- minimal screen complexity
- voice assistance
- reduced motion mode
- adjustable text size
- simple Back/Home navigation
- encouraging feedback

---

## 10. Multilingual Support

Initial target languages:

- English
- Hindi
- Assamese

Architecture must allow additional regional languages.

---

## 11. Security

The application should follow:

- least-data collection
- authenticated caregiver access
- protected backend access
- secure session storage
- secure communication
- role-based data access
- offline data protection
- no unnecessary medical data collection

---

## 12. Medical Safety

Smaran AI supports cognitive engagement and daily assistance.

It does not:

- diagnose dementia
- determine disease severity
- replace clinicians
- prescribe medication
- provide emergency medical diagnosis

---

## 13. Demo Success Criteria

The SIH demo must successfully show:

Patient onboarding
→ language
→ region
→ patient home
→ cognitive activity
→ adaptive AI
→ personal memory
→ reminder
→ offline usage
→ caregiver analytics.

All screens in the main demo flow must work without placeholder pages.