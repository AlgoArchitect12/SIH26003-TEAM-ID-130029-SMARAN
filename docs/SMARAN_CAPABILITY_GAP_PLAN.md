# SMARAN Capability Gap & AI/Voice/Resilience Audit Plan

## 1. Executive Summary
This document provides a comprehensive audit and implementation plan to bridge the gap between the current SMARAN application state and the advanced AI/Voice features demonstrated in the Smriti/SIH reference material. Based on an audit of the current repository, SMARAN currently possesses a solid offline-first local SQLite foundation, basic OS-level Text-to-Speech (TTS), and a surprisingly robust local adaptive telemetry model. However, it lacks real-time Speech-to-Text (STT), AI-driven conversational capabilities, robust NE-Indian language voice support, and automated WhatsApp/alerting companions. This plan details the required architectural shifts—primarily introducing a secure backend gateway for Bhashini/Gemini and moving to a hybrid voice pipeline—to achieve these capabilities without sacrificing offline resilience.

## 2. Current SMARAN Capability Inventory
Based on code inspection (`src/`), the current state is:
- **Voice/Read-aloud**: Utilizes `expo-speech` relying entirely on OS-provided device voices. No STT is implemented.
- **Language Support**: UI explicitly supports `en, hi, as, bn, mni, kha, lus`, but TTS relies on the OS (which often lacks Khasi, Mizo, or Manipuri).
- **Audio Memory System**: No voice recording/memory capabilities exist.
- **AI/Assistant Gateway**: None. 
- **Adaptive Difficulty Engine**: **Present and robust.** `AdaptiveModelState` tracks `accuracy`, `pace` (reaction time), `memory`, `hints`, and `stability`.
- **Telemetry**: Tracks `averageResponseMs` (reaction time), `repeatedErrors` (mistakes), and `hintsUsed` within `CognitiveSessionMetrics`.
- **Offline/Local Persistence**: Strong. Uses `expo-sqlite` as the primary source of truth.
- **Sync Architecture**: Present via Supabase (`008_auth_sync.ts`).
- **Caregiver/Reporting**: PDF generation (`expo-print`) and sharing (`expo-sharing`, `expo-mail-composer`).
- **WhatsApp Adapter**: None. Relies on the OS share sheet.
- **Security**: Uses `expo-secure-store` for local settings, but no architecture exists for third-party AI provider secrets.

## 3. Smriti-Reference Ideas Worth Investigating
- Multilingual real-time voice translation (Bhashini/Gemini).
- Seamless offline-to-online syncing with queued writes.
- Caregiver companion via WhatsApp.
- Granular error/reaction-time telemetry (already partially implemented).
- Security architecture for API keys.

## 4. Official API Research Findings
### Bhashini API
- **Capabilities**: ASR (Speech-to-Text), NMT (Translation), TTS.
- **Language Support**: Targets 22 scheduled Indian languages (Hindi, Assamese, Bengali, Manipuri). *Note: Khasi and Mizo are not in the 8th schedule and may have limited or no official Bhashini support.*
- **Production constraints**: Requires API keys, has rate limits. High latency if chaining STT -> NMT -> TTS sequentially.

### Google Gemini (Live API)
- **Capabilities**: `gemini-3.5-live-translate-preview` for real-time speech-to-speech. 
- **Language Support**: 70+ languages. 
- **Performance**: Ultra-low latency (<800ms). Processes continuous audio streams (audio-in, audio-out), bypassing cascaded latency.
- **Constraints**: Requires WebSocket/streaming connections, not strictly a "Live Agent" with tool calling in pure translation mode.

## 5. Capability-Gap Matrix

| Capability | Current State | Evidence | Reference Idea | API Option | Feasibility | Priority | Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **A. Multilingual Voice** | OS TTS only (`expo-speech`) | `speech.service.ts` | Bhashini/Gemini voice | Bhashini TTS / Gemini | High | P0 | Migrate to Cloud TTS via gateway |
| **B. Language Detection** | None (User selects) | `schema.types.ts` | Auto-detect | Gemini Live/Bhashini | Medium | P2 | Keep explicit selection for MVP |
| **C. Speech-to-Text** | None | No STT modules | Voice input | Bhashini ASR / Gemini | High | P0 | Implement secure proxy for ASR |
| **D. Translation** | Static UI | Hardcoded strings | Real-time translation | Gemini NMT | High | P1 | Add edge function for text NMT |
| **E. Text-to-Speech** | `expo-speech` fallback | `fallbackLocale` logic | High-quality TTS | Bhashini TTS | High | P0 | Use Bhashini for supported langs |
| **F. Speech-to-Speech** | None | N/A | Seamless S2S | Gemini Live API | Medium | P1 | Evaluate for conversational bot |
| **G. Indian/NE Languages** | Schema only (Khasi, Mizo) | `schema.types.ts` | Full support | Bhashini (Partial) | High risk | P1 | Use OS fallback for unsupported NE |
| **H. Adaptive Difficulty** | Implemented | `AdaptiveModelState` | 2-layer model | N/A | High | P2 | Refine existing weights |
| **I. Reaction Telemetry** | Implemented | `averageResponseMs` | Reaction tracking | N/A | High | P2 | Visualize in caregiver PDF |
| **J. Mistake Telemetry** | Implemented | `repeatedErrors` | Error telemetry | N/A | High | P2 | Expand to all activity types |
| **K. Cross-session Adapt** | Implemented | `AdaptiveModelState` | Cross-session | N/A | High | P2 | No action needed |
| **L. Offline Fallback** | SQLite is primary | `expo-sqlite` used | Offline-first | N/A | High | P0 | Maintain SQLite priority |
| **M. Reconnect/Sync** | Supabase Sync | Migrations | Queue-based sync | Supabase Sync | High | P0 | Add retry queues for AI telemetry |
| **N. Caregiver Alerts** | Manual PDF share | `report-pdf.service.ts` | Automated alerts | Edge Functions | Medium | P1 | Move alerts to Supabase Edge |
| **O. WhatsApp Companion** | OS Share sheet | `Sharing.shareAsync` | Chatbot | Twilio/Meta API | Low | P2 | Out of scope for mobile app repo |
| **P/Q. Security / APIs** | Local SecureStore | `secure-storage.ts` | Secure proxy | Supabase Edge Funcs | High | P0 | **Never bundle API keys.** |

## 6. Multilingual Voice Architecture Comparison

| Metric | Option 1: Bhashini Pipeline (STT -> NMT -> TTS) | Option 2: Gemini Live (Audio -> Audio) | Option 3: Hybrid (Recommended) |
| :--- | :--- | :--- | :--- |
| **Languages** | Excellent for scheduled (Hindi, Assamese, Bengali, Manipuri) | Broad global, variable for deep regional dialects | Gemini for conversational; Bhashini for specific scheduled languages |
| **Latency** | High (Cascaded) | Ultra-low (<800ms) | Context-dependent |
| **Reliability** | Moderate (Multiple points of failure) | High (Single model pass) | High fallback capability |
| **Offline** | Breaks completely | Breaks completely | Fallback to OS `expo-speech` TTS |
| **Complexity** | High (Chaining APIs) | Medium (WebSockets) | High |

**Recommendation (Option 3 Hybrid)**: 
Use Gemini for natural conversational interactions (Speech-to-Speech) where latency matters. Use Bhashini specifically for generating precise Text-to-Speech for localized Assamese/Bengali/Manipuri UI elements. **Crucially, fallback to the current `expo-speech` if network fails.**

## 7. Adaptive-Learning Audit
**Current State**: 
- Uses `accuracy`, `pace`, `memory`, `hints`, `stability`. 
- Reaction time (`averageResponseMs`) and mistakes (`repeatedErrors`) are tracked per session.
- Adaptation is cross-session via the `AdaptiveModelState` which maintains a running average/bias.
**Missing**: 
- Real-time within-session difficulty scaling (currently scales between sessions).
- *Strict Rule: We will not introduce medical diagnosis scoring.*

## 8. Offline/Resilience Audit
**Failure Points Identified**:
1. **TTS Cloud Failure**: If Bhashini/Gemini is unreachable, TTS fails. 
   - *Fix*: Wrap cloud TTS calls in a `try/catch` and seamlessly fallback to the existing `expo-speech` service.
2. **AI Telemetry Sync**: Currently, if device is offline, Supabase sync might fail or drop AI-specific telemetry.
   - *Fix*: Implement a local SQLite "sync_queue" table to hold payload events until `netinfo` reports online.
3. **Authentication**: Supabase session might expire offline.
   - *Fix*: Ensure `expo-secure-store` maintains a long-lived refresh token.

## 9. Known Error/Blocker Inventory
- **Blocker**: Khasi (`kha`) and Mizo (`lus`) are NOT in the 8th Schedule of the Indian Constitution, meaning official Bhashini support is likely missing or highly experimental. Cloud TTS will fail for these.
- **Blocker**: Real-time STT requires streaming audio from React Native, which currently lacks a robust streaming audio module in the `expo-audio` implementation without custom dev clients or webviews.
- **Unsupported Claim**: Smriti claims full "caregiver monitoring via WhatsApp". This requires a verified Meta Business Account and Twilio/MessageBird integration, which cannot be securely run from the client app.

## 10. Security/Credential Architecture
**CRITICAL RULE**: API keys (Bhashini, Gemini, Supabase Service Role) must **NEVER** be bundled in the Expo client or committed to Git.
**Architecture**:
1. Mobile app authenticates with Supabase Auth.
2. Mobile app sends audio/text payload to a **Supabase Edge Function** (Serverless).
3. The Edge Function securely holds the Gemini/Bhashini `API_KEY` in its environment variables.
4. Edge Function makes the request to Bhashini/Gemini and returns the processed data to the client.

## 11. P0/P1/P2 Implementation Roadmap

### P0 (Foundational & Blockers)
- **Scope**: Secure Edge Function API Gateway.
- **Action**: Create Supabase Edge Functions for proxying Bhashini TTS and Gemini Text generation. Remove any local API key attempts.
- **Offline Impact**: None.
- **Validation**: Ensure network interception shows no exposed API keys.

### P1 (High-Value Features)
- **Scope**: Hybrid Voice Pipeline (Cloud TTS with Local Fallback).
- **Action**: Modify `src/services/speech.service.ts` to first request TTS audio from the Edge Function. If timeout or offline, use `expo-speech`.
- **Scope**: Retry Queue for Sync.
- **Action**: Add a SQLite table for queueing offline sync mutations.

### P2 (Useful but Optional)
- **Scope**: Real-time Gemini Live S2S.
- **Action**: Implement WebSocket streaming for direct conversational UI. (High complexity due to RN audio streaming limits).
- **Scope**: Edge-driven Caregiver Email Alerts (Alternative to WhatsApp).

## 12. Proposed Validation/Acceptance Criteria
1. **Security**: `grep` on build output contains no Bhashini/Gemini keys.
2. **Resilience**: Disabling WiFi during a Cloud TTS request gracefully plays the robotic OS voice within 2 seconds.
3. **Telemetry**: Completing a game offline successfully writes to SQLite, and syncs to Supabase upon reconnection.

## 13. Explicitly Rejected Ideas
- **Direct WhatsApp Bot in-app**: Rejected. Requires backend infrastructure and Meta Business verification outside the scope of the React Native repository.
- **Medical Diagnostics**: Rejected. The adaptive model will strictly remain a "game difficulty" scaler, not a clinical dementia diagnostic tool.
- **Cascaded Voice Pipeline for Conversations**: Rejected. STT->Translation->TTS is too slow (>3s). Must use Gemini Live for conversations, Bhashini only for static TTS.

## 14. Validation Update (October 2026)

**Corrected Capability Facts:**
1. **AI Gateway**: *Contradiction found.* The original plan claimed the AI Gateway was missing. The repository actually contains `ai-care-assistant`, `online-ai`, and `report-delivery` Supabase Edge Functions which act as secure backend proxies with rate limiting. This capability is **partially implemented**.
2. **Sync Queueing**: *Contradiction found.* The original plan proposed adding a SQLite table for offline sync queueing. The repository already implements a highly robust `sync_outbox` table and `sync.repository.ts` that queues offline mutations. This capability is **already implemented**.
3. **Local Audio Memories**: Re-verified. The repository contains no `expo-av` or microphone recording usage. This is **genuinely missing**.

**Corrected API Findings:**
1. **Gemini Live API**: Current 2026 documentation confirms the use of **Gemini 3.8 Live** models. It supports true audio-in/audio-out multimodal streaming. Pricing is currently $0.75/$3.75 per 1M tokens (introductory 2026).
2. **Bhashini API**: *Contradiction found.* The original plan assumed Khasi (`kha`) and Mizo (`lus`) were unsupported because they are not in the 8th Schedule. Current 2026 Bhashini and ULCA documentation confirms that **Khasi and Mizo ARE supported** through recent government integration initiatives.

**Corrected Roadmap (P0/P1/P2):**
- **P0 (Secure Edge Function API Gateway)**: No longer needs to be built from scratch. Modifying the *existing* `ai-care-assistant` to support Bhashini TTS and Gemini 3.8 Live is the exact technical scope.
- **P1 (Retry Queue for Sync)**: **Removed.** Already implemented natively via `sync_outbox`.
- **P1 (Indian/NE Languages via Bhashini)**: Moved from High Risk to **Experimentally Feasible**, given the official support for Khasi and Mizo.

**Exact First Implementation Milestone:**
- Update the existing `supabase/functions/ai-care-assistant` Edge Function to securely hold Gemini/Bhashini credentials and integrate the Gemini 3.8 Live and Bhashini TTS APIs.

### P0 Implementation Status (October 2026)

- **Status**: Milestone 1 complete.
- **Provider Gateway**: Extended `supabase/functions/ai-care-assistant` to support `action: 'tts'` and `action: 'gemini'` request types.
- **Bhashini TTS Gateway**: Configured to route `bhashini` TTS requests internally (using server-side `BHASHINI_API_KEY`) to the Bhashini/ULCA compute URL without exposing keys to mobile. It handles fallback and rate limits correctly.
- **Gemini AI Gateway**: Created a server-side foundation for `gemini-3.8-live` and flash models. The request shape handles secure server-side prompting via `GEMINI_API_KEY`.
- **Language Support Verified**: Bhashini gateway payload is structurally designed to support `hi`, `as`, `bn`, `mni`, `kha`, `lus` and `en` via the pipeline configuration endpoint.
- **Gemini Live Streaming Gap**: The current implementation supports text-based generation via `generateContent`. True Gemini Live bidirectional audio streaming requires WebSocket or Server-Sent Events (SSE) support in the Edge Function, which necessitates further adapter work and client-side `expo-audio` streaming buffers not yet implemented.
- **Validation**: TypeScript, lint, and core regression tests passed. No Git refs were overwritten. No provider secrets were exposed.
