# SMARAN AI — Technology Stack

## Mobile Framework

React Native + Expo

Reason:
One TypeScript codebase can target Android and iOS while providing access to native device features required by Smaran.

---

## Language

TypeScript

Reason:
Provides strong type safety for health-related data structures, cognitive sessions and application state.

---

## Navigation

Expo Router

Reason:
File-based routing creates a maintainable application structure.

---

## Local Database

Expo SQLite

Purpose:

- patient profile
- reminders
- cognitive sessions
- Personal Memories metadata
- adaptive AI model state
- synchronization queue
- offline analytics

---

## Cloud Backend

Supabase

Services:

- PostgreSQL
- Authentication
- Storage
- Row Level Security
- API access

Reason:
Reduces backend infrastructure required for the hackathon while remaining suitable for structured relational data.

---

## Authentication

Supabase Auth

Roles:

- Patient
- Caregiver

Future:

- Healthcare worker
- Administrator

---

## Secure Local Storage

Expo SecureStore

Used for:

- session tokens
- sensitive local configuration
- secure authentication state

---

## Voice

Expo Speech

Initial use:

- instructions
- reading screens
- cognitive game guidance

Future architecture can support richer Indian-language speech services.

---

## Notifications

Expo Notifications

Used for:

- medicine reminders
- hydration reminders
- appointments
- daily activities

Core reminders should use local scheduling.

---

## Adaptive AI

Custom on-device TypeScript adaptive learning engine.

Initial algorithm:

Online logistic regression / adaptive difficulty estimation.

Input:

- accuracy
- response time
- hints
- mistakes
- recent performance
- difficulty

Output:

Recommended activity difficulty.

---

## State Management

Zustand

Use for:

- auth state
- current patient
- accessibility preferences
- onboarding state
- session state

Persistent data belongs in SQLite rather than Zustand.

---

## Backend Database

PostgreSQL through Supabase.

Main cloud entities:

- users
- patient_profiles
- caregiver_links
- cognitive_sessions
- reminders
- personal_memories
- sync_metadata

---

## Image Storage

Supabase Storage

Used for:

- Personal Memory photos
- optional caregiver uploaded media

Regional game assets should normally be bundled with the application when practical to improve offline support.

---

## Analytics

Local-first derived analytics.

Cloud synchronization is optional for core patient usage.

---

## Development

VS Code / Antigravity / Codex

Git

GitHub

---

## Code Quality

ESLint

TypeScript strict mode

Prettier

CodeRabbit

---

## Build

Expo Application Services (EAS)

Development builds for native functionality.

Android APK/AAB for SIH testing and final demonstration.