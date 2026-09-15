# Laboratory Asset and Service Management System
**LAB 4-A: Role-Based Asset Transaction and Approval Management**  
*Systems Analysis and Design — Development Platform: GitHub + GitHub Pages + Supabase*

---

## Overview

A Laboratory Asset Management System with **role-based access control (RBAC)**, an **approval workflow** with 7 transaction states, **business rule enforcement** (BR-A4-01 through BR-A4-10), and an **immutable audit trail**.

### User Roles

| Role | Permissions |
|---|---|
| **Administrator** | Manage users & equipment; approve/reject requests; release/return; full audit log access; system configuration |
| **Laboratory Staff** | View equipment; create borrowing requests; process releases & returns; view all requests |
| **Requester / Viewer** | View available equipment; submit borrow requests; view own request status & history |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│            Browser (Static Frontend)          │
│  index.html | css/styles.css | app.js         │
│  • Supersabase JS SDK v2 (CDN)                │
│  • Bootstrap 5 (CDN)                          │
└──────────────────┬────────────────────────────┘
                   │ Supabase Client
                   ▼
┌──────────────────────────────────────────────┐
│          Supabase (PostgreSQL Backend)        │
│  • auth.users       (managed by Supabase)     │
│  • profiles          (role per user)          │
│  • equipment         (asset catalog)          │
│  • borrowing_requests (workflow state)        │
│  • audit_logs        (immutable trail)        │
│                                               │
│  • 13 RLS Policies (role-based row access)   │
│  • 5 Database Triggers (audit + sync)         │
└──────────────────────────────────────────────┘
```

### Data Flow

1. **Login** → User selects role → dashboard loads with role-filtered UI
2. **Requester submits** → borrow request created as `Pending` → audit log entry created
3. **Admin approves** → status → `Approved` → audit log entry created
4. **Staff releases** → equipment → `Borrowed` → audit log entry created
5. **Staff returns** → equipment → `Available`/ `Damaged` → status → `Closed` → audit log entry

---

## Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    PROFILES {
        UUID id PK "FK auth.users"
        TEXT full_name
        TEXT email UNIQUE
        TEXT role "CHECK: Admin/Staff/Requester"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    EQUIPMENT {
        UUID id PK
        TEXT asset_tag UNIQUE
        TEXT name
        TEXT category
        TEXT status "CHECK: Available/Borrowed/Maintenance/Damaged"
        TEXT location
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    BORROWING_REQUESTS {
        UUID id PK
        UUID requester_id FK "references profiles"
        UUID equipment_id FK "references equipment"
        TEXT purpose
        TEXT status "CHECK: Pending→Approved→Released→Returned→Closed"
        TIMESTAMPTZ requested_date
        UUID approved_by FK "references profiles"
        TIMESTAMPTZ approved_at
        UUID released_by FK "references profiles"
        TIMESTAMPTZ released_at
        TIMESTAMPTZ returned_at
        TEXT remarks
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    AUDIT_LOGS {
        UUID id PK
        UUID user_id FK "references profiles"
        TEXT user_name
        TEXT action
        TEXT module
        TEXT record_id
        TEXT description
        TIMESTAMPTZ created_at
    }

    PROFILES ||--o{ BORROWING_REQUESTS : "requester_id"
    EQUIPMENT ||--o{ BORROWING_REQUESTS : "equipment_id"
    PROFILES }|..|| BORROWING_REQUESTS : "approved_by"
    PROFILES }|..|| BORROWING_REQUESTS : "released_by"
    PROFILES ||--o{ AUDIT_LOGS : "user_id"
```

### Relationship Summary

| From | To | Cardinality | Foreign Key |
|---|---|---|---|
| profiles | borrowing_requests | 1 : M | `requester_id` |
| equipment | borrowing_requests | 1 : M | `equipment_id` |
| profiles | borrowing_requests | 1 : M (optional) | `approved_by` |
| profiles | borrowing_requests | 1 : M (optional) | `released_by` |
| profiles | audit_logs | 1 : M | `user_id` |

---

## Use Case Diagram

```mermaid
usecaseDiagram
    actor Requester as "Requester / Viewer"
    actor Staff as "Laboratory Staff"
    actor Admin as "Administrator"

    (View Catalog) as UC1
    (Request Borrow) as UC2
    (View Own Requests) as UC3
    (Approve Request) as UC4
    (Reject Request) as UC5
    (Release Equipment) as UC6
    (Process Return) as UC7
    (Manage Equipment) as UC8
    (View Audit Trail) as UC9
    (Switch Role) as UC10

    Requester --> UC1
    Requester --> UC2
    Requester --> UC3
    Requester --> UC10

    Staff --> UC1
    Staff --> UC2
    Staff --> UC4
    Staff --> UC5
    Staff --> UC6
    Staff --> UC7
    Staff --> UC10

    Admin --> UC1
    Admin --> UC2
    Admin --> UC3
    Admin --> UC4
    Admin --> UC5
    Admin --> UC6
    Admin --> UC7
    Admin --> UC8
    Admin --> UC9
    Admin --> UC10
```

---

## Role-Permission Matrix

| Function | Requester / Viewer | Laboratory Staff | Administrator |
|---|---|---|---|
| View equipment catalog | ✅ | ✅ | ✅ |
| Submit borrow request | ✅ | ✅ | ✅ |
| View own requests | ✅ | ✅ | ✅ |
| View all requests | ❌ | ✅ | ✅ |
| Approve requests | ❌ | ❌ | ✅ |
| Reject requests | ❌ | ❌ | ✅ |
| Release equipment | ❌ | ✅ | ✅ |
| Process returns | ❌ | ✅ | ✅ |
| Manage equipment | ❌ | ❌ | ✅ |
| View audit trail | ❌ | ❌ | ✅ |
| Delete records | ❌ | ❌ | ✅ |
| Switch role | ✅ | ✅ | ✅ |

---

## File Structure

```
laboratory-asset-management/
├── index.html          # Single-page application (login + dashboard)
├── app.js              # Application logic (Supabase SDK + vanilla JS)
├── schema.sql          # Complete Supabase database schema
├── css/
│   └── styles.css      # Dashboard styling (badges, modals, responsive tables)
└── README.md           # This file
```

---

## Setup

### 1. Local Development (no Supabase required)

The app includes a mock data fallback — no database connection needed for local testing.

```bash
# Start local server (Python 3)
cd laboratory-asset-management
python -m http.server 8000

# Or using Node.js
npx serve
```

Open **http://localhost:8000** in your browser.

### 2. Connect to Supabase (production)

1. Create a project at [supabase.com](https://supabase.com)
2. Open the **SQL Editor** in Supabase Studio
3. Copy & paste the entire `schema.sql` → click **Run**
4. In `app.js`, replace:
   ```js
   const SUPABASE_URL = "https://YOUR_SUPABASE_PROJECT_ID.supabase.co";
   const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
   ```
5. Enable **Email/Row Security** in Authentication settings
6. Deploy to GitHub Pages:
   ```bash
   git init && git add . && git commit -m "Initial commit"
   git remote add origin https://github.com/YOURUSER/YOURREPO.git
   git push -u origin main
   ```
7. Enable **GitHub Pages** in repository → Settings → Pages

---

## Workflow & State Machine

The borrowing approval pipeline has **7 transaction statuses**:

```
Submitted (auto)
    ↓
  Pending
    ↓
  Approved  ←→  Rejected
    ↓          ↘ (Closed)
Released
    ↓
Returned / Overdue
    ↓
  Closed
```

### Valid State Transitions

| From | To | Authorized Role | Test Case |
|---|---|---|---|
| Pending | Approved | Administrator | TC-A4-03 |
| Pending | Rejected | Administrator | TC-A4-04 |
| Approved | Released | Laboratory Staff | TC-A4-06 |
| Released | Returned | Laboratory Staff | TC-A4-07 |
| Returned | Closed | Laboratory Staff | — |
| Released | Overdue | System | — |
| Overdue | Returned | Laboratory Staff | TC-A4-07 |
| Overdue | Closed | Laboratory Staff | — |

---

## Business Rules (BR-A4 Series)

| ID | Rule | Enforced At |
|---|---|---|
| **BR-A4-01** | Only Available equipment may be requested | Frontend + DB (CHECK constraint) |
| **BR-A4-02** | Staff/Admin cannot approve their own request | Frontend + DB trigger |
| **BR-A4-03** | Only Administrator may approve/reject | Frontend + RLS policy (UPDATE) |
| **BR-A4-04** | Only Approved requests may be released | Frontend + DB trigger |
| **BR-A4-05** | Only Released items can be returned | Frontend + DB trigger |
| **BR-A4-06** | Returned equipment → Available (unless damaged) | DB trigger (auto-sync) |
| **BR-A4-07** | Rejected requests cannot be released | Frontend + DB trigger |
| **BR-A4-08** | Return transactions cannot be processed twice | Frontend + DB trigger |
| **BR-A4-09** | Equipment under Maintenance cannot be borrowed | Frontend + DB (CHECK) |
| **BR-A4-10** | Audit trail is immutable | No UPDATE/DELETE policy on `audit_logs` |

### Database Triggers

| Trigger | Event | Purpose |
|---|---|---|
| `trigger_borrowing_audit` | AFTER INSERT/UPDATE on `borrowing_requests` | Logs status changes, approvals, releases, returns to `audit_logs` |
| `sync_equipment_status` | AFTER UPDATE on `borrowing_requests` | Auto-updates `equipment.status` (Borrowed/Available) |
| `set_updated_at` (×3) | BEFORE UPDATE on each table | Auto-updates `updated_at` timestamp |

### RLS Policies Summary

**profiles**
- SELECT: all authenticated users
- INSERT: Administrator only
- UPDATE: own profile or Administrator
- DELETE: Administrator only

**equipment**
- SELECT: all authenticated users
- INSERT/UPDATE/DELETE: Administrator + Staff (DELETE: Admin only)

**borrowing_requests**
- SELECT: own requests (Requester); all (Staff/Admin)
- INSERT: authenticated user (sets own ID)
- UPDATE: own Pending request (Requester); any request (Staff/Admin)
- DELETE: Administrator only

**audit_logs**
- SELECT: Administrator only
- INSERT/UPDATE/DELETE: none for users (trigger only via SECURITY DEFINER)

---

## UI Components

### Login Screen
- Username field (required)
- Password field (min 4 chars, masked)
- Role dropdown (Requester / Viewer | Laboratory Staff | Administrator)
- Login button transitions to dashboard

### Dashboard Navbar
- Brand: "Lab Asset Manager"
- Current role badge (updates on role switch)
- **Switch Role** button → opens role switcher modal
- **Logout** button → returns to login screen

### Tab Navigation (role-adaptive)
| Tab | Visible To |
|---|---|
| Equipment Catalog | All roles |
| Borrowing Workflow | All roles (filtered: own requests for Requesters) |
| Admin / Audit Trail | Administrator only |

### Equipment Cards
- Status badge (color-coded)
- Asset tag + name + category + location
- "Request Borrow" button (Available items only, Requester+)
- "Not Borrowable" (disabled, for Borrowed/Maintenance/Damaged)

### Audit Trail Table
| Column | Description |
|---|---|
| Log ID | UUID |
| User | Full name of actor |
| Action | SUBMITTED, APPROVED, REJECTED, RELEASED, RETURNED, LOGIN, etc. |
| Module | "Borrowing", "Auth", "Equipment" |
| Record ID | The affected record's ID |
| Description | Human-readable detail |
| Timestamp | When it happened |

---

## Functional Test Results

| Test ID | Scenario | Expected Result | Status |
|---|---|---|---|
| TC-A4-01 | Viewer opens Admin tab | Access denied | ✅ |
| TC-A4-02 | Staff/Requester submits request | Saved as Pending | ✅ |
| TC-A4-03 | Admin approves request | Status → Approved, audit log created | ✅ |
| TC-A4-04 | Admin rejects request | Status → Rejected | ✅ |
| TC-A4-05 | Try to release rejected request | Operation blocked | ✅ |
| TC-A4-06 | Release approved equipment | Equipment → Borrowed | ✅ |
| TC-A4-07 | Return released equipment | Equipment → Available/Damaged, status → Closed | ✅ |
| TC-A4-08 | Check audit log after actions | All entries visible | ✅ |
| TC-A4-09 | Staff attempts delete | Blocked by RLS | ✅ |
| TC-A4-10 | Logout → protected page | Redirected to login | ✅ |

---

## Status Badge Legend

### Equipment Status
| Status | Color |
|---|---|
| Available | 🟢 Green |
| Borrowed | 🔵 Blue |
| Under Maintenance | ⚫ Secondary |
| Damaged | 🟣 Purple |

### Request Status
| Status | Color |
|---|---|
| Pending | 🟡 Yellow |
| Approved | 🟢 Green |
| Rejected | 🔴 Red |
| Released | 🔵 Blue (info) |
| Returned | 🟢 Green |
| Overdue | 🔴 Red |
| Closed | 🟢 Green |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JavaScript (ES6+), HTML5, CSS3 |
| UI Framework | Bootstrap 5.3 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (future) / Role Simulation (current) |
| SDK | @supabase/supabase-js v2 |
| Deployment | GitHub Pages (static hosting) |

---

## Quick Start

1. `python -m http.server 8000` (or `npx serve`)
2. Open `http://localhost:8000`
3. Login: any username + 4+ char password + role
4. Submit borrow requests as Requester
5. Approve/release/return as Admin or Staff
6. Switch roles via navbar button
7. View audit trail (Admin only)
8. Log out to login as a different user

---

## License

This project is for educational purposes — Systems Analysis and Design course laboratory exercise.