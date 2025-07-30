# Then paste the content and save (Ctrl+X, then Y, then Enter)# Moonlit Scheduler – Implementation Guide (v1.0)

## 0 Purpose & Scope

Design and deliver **Phase 1** of Moonlit Scheduler: a HIPAA‑compliant, provider‑agnostic booking widget and admin dashboard tightly integrated with Athena Health. This guide lays out the technical roadmap, data model, services, security posture, and phased delivery plan that future engineers or LLM agents will reference throughout development.

---

## 1 Roadmap & Milestones

|  Phase |  Milestone                              |  Target   |  Key Deliverables                                                                                                                  |
| ------ | --------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **1A** | Booking MVP                             |  T + 4 w  |  ➜ Merged‑availability widget (payer flow + effective‑date logic)<br>➜ Athena create/cancel<br>➜ SendGrid & Notifyre notifications |
| **1B** | Admin Dashboard                         |  T + 6 w  |  ➜ CRUD UI for providers, payers, provider‑payer map<br>➜ Calendar re‑sync controls<br>➜ Audit log viewer                          |
| **2**  | Interpreter & In‑Person Logic           |  T + 10 w |  ➜ Spanish + interpreter routing<br>➜ Modality toggle (tele‑vs‑clinic)                                                             |
| **3**  | Real‑time Eligibility & CM Module Hooks |  T + 14 w |  ➜ Plug‑in Change Healthcare API<br>➜ Expose hooks for future CM scheduling                                                        |
| **4**  | Injection Clinic & Multi‑Location       | T + 18 w  |  ➜ Support POS 02/10/11, vaccine fridge logic                                                                                      |

---

## 2 High‑Level Architecture

**Frontend** (Next.js & Tailwind) ↔ **Backend** (NestJS micro‑services) ↔ **PostgreSQL 16** via Prisma. Hosted on **GCP**: Vercel (widget), Cloud Run (API), Cloud SQL (DB). IaC via Terraform & GitHub Actions.

### Core Services

1. **Athena Adapter** – wraps v1/v2 scheduling endpoints; handles OAuth2 refresh, throttling, retries.
2. **Eligibility Service** – DB‑driven provider filtering; DI abstraction for future Change Healthcare swap‑in.
3. **Availability Service** – caches `openSlots`; produces merged free‑busy lists ≤ 500 ms.
4. **Booking Service** – orchestrates create/cancel/reschedule; sets `providerid` = resident, `renderingproviderid` = supervising attending when required.
5. **Notification Service** – SendGrid templates + Notifyre SMS.
6. **LeadService** – stores out‑of‑network/effective‑date > 30 days leads in an internal `leads` table (PostgreSQL) and triggers staff notification emails.

### Data Flow (Happy Path)

1. Widget POST `/eligibility` → returns eligible providers.
2. Widget GET `/availability?providers[]` → unified slots.
3. Patient POST `/appointments` → Athena POST, DB persist, notifications.
4. Athena Webhook `appointment.updated` → API sync.

---

## 3 Data Model (Prisma)

```prisma
model Provider {
  id                   Int      @id @default(autoincrement())
  name                 String
  npi                  String   @unique
  licenseStates        String[]
  nativeLangs          String[]
  interpreterOk        Boolean  @default(false)
  calendarSourceId     String
  active               Boolean  @default(true)
  supervisingProvider  Provider? @relation("Supervision", fields: [supervisingProviderId], references: [id])
  supervisingProviderId Int?
  payers               ProviderPayer[]
  appointments         Appointment[]
}

model Payer {
  id         Int      @id @default(autoincrement())
  name       String
  type       String
  planCodes  String[]
  providers  ProviderPayer[]
}

model ProviderPayer {
  provider     Provider @relation(fields: [providerId], references: [id])
  providerId   Int
  payer        Payer    @relation(fields: [payerId], references: [id])
  payerId      Int
  effectiveDate DateTime
  endDate      DateTime?
  status        String  // credentialing_in_progress | active | inactive
  @@id([providerId, payerId])
}

model Appointment {
  id                    Int      @id @default(autoincrement())
  provider              Provider @relation(fields: [providerId], references: [id])
  providerId            Int
  renderingProviderId   Int?
  patientInfo           Json
  insuranceInfo         Json
  startTime             DateTime
  endTime               DateTime
  athenaApptId          String   @unique
  roiContacts           Json?
  createdAt             DateTime @default(now())
}

model Lead {
  id            Int      @id @default(autoincrement())
  email         String
  payerName     String
  effectiveDate DateTime?
  createdAt     DateTime @default(now())
  status        String   // pending | contacted | converted
}
```

*Leads* stored locally in the `Lead` table for internal follow‑up; no external CRM.
