# Screen inventory

_Generated from `src/config/screens.ts` by `npm run docs:inventory`. Do not edit by hand._

**Status legend.** Implemented = working UI against the development mock with the documented service contract. Partial = works but covers only part of the feature, or uses sample data. Planned = route exists and shows an honest "not built yet" page.

**Totals:** 82 screens: 64 implemented, 8 partial, 10 planned.

The public marketing site (`/`, `/placeholder/*`, `/sign-in`, `/get-started`) lives outside this table; `/get-started` (registration/onboarding) is a placeholder.

## SaaS platform administration

Root: `/platform`

| Route | Screen | Roles | Status | Catalogue § |
|---|---|---|---|---|
| `/platform` | Platform overview | Platform administrator | Implemented (mock data) | 1 |
| `/platform/tenants` | Schools | Platform administrator | Implemented (mock data) | 1 |
| `/platform/onboarding` | Onboarding | Platform administrator | Implemented (mock data) | 1 |
| `/platform/subscriptions` | Plans & usage | Platform administrator | Partial | 1 |
| `/platform/support` | Support requests | Platform administrator | Implemented (mock data) | 1 |
| `/platform/status` | System status | Platform administrator | Partial | 19, 20 |
| `/platform/audit` | Audit & activity | Platform administrator | Implemented (mock data) | 19 |
| `/platform/config` | Platform configuration | Platform administrator | Planned | 1, 19 |

## School administration (owner, principal, accountant, librarian, transport)

Root: `/school`

| Route | Screen | Roles | Status | Catalogue § |
|---|---|---|---|---|
| `/school` | Dashboard | School owner, Principal, Accountant, Librarian, Transport coordinator | Implemented (mock data) | 17 |
| `/school/approvals` | Approval inbox | School owner, Principal, Accountant | Implemented (mock data) | 7, 16 |
| `/school/calendar` | Calendar & holidays | School owner, Principal | Implemented (mock data) | 2 |
| `/school/notices` | Notices | School owner, Principal | Implemented (mock data) | 12 |
| `/school/notices/new` | Compose notice | School owner, Principal | Implemented (mock data) | 12 |
| `/school/queries` | Parent queries | School owner, Principal | Implemented (mock data) | 12 |
| `/school/events` | Events & functions | School owner, Principal | Partial | 2, 13 |
| `/school/students` | Students | School owner, Principal | Implemented (mock data) | 4 |
| `/school/students/:id` | Student profile | School owner, Principal | Implemented (mock data) | 4 |
| `/school/admissions` | Admissions | School owner, Principal | Implemented (mock data) | 4 |
| `/school/staff` | Staff | School owner, Principal | Implemented (mock data) | 11 |
| `/school/leave` | Staff leave | School owner, Principal | Implemented (mock data) | 11, 7 |
| `/school/campuses` | Campuses | School owner, Principal | Implemented (mock data) | 1 |
| `/school/attendance` | Attendance overview | School owner, Principal | Implemented (mock data) | 6 |
| `/school/exams` | Exam datesheet | School owner, Principal | Implemented (mock data) | 9 |
| `/school/results` | Results overview | School owner, Principal | Partial | 9 |
| `/school/rollover` | Academic-year rollover | School owner, Principal | Implemented (mock data) | 3 |
| `/school/timetable` | Timetable builder | School owner, Principal | Planned | 7 |
| `/school/curriculum` | Classes, subjects & syllabus | School owner, Principal | Planned | 8 |
| `/school/fees` | Fee collection | School owner, Principal, Accountant | Implemented (mock data) | 10 |
| `/school/fees/structure` | Fee structure | School owner, Principal, Accountant | Implemented (mock data) | 10 |
| `/school/fees/ledger` | Student ledger | School owner, Principal, Accountant | Implemented (mock data) | 10 |
| `/school/vendors` | Vendors | School owner, Principal, Accountant | Implemented (mock data) | 10 |
| `/school/fees/screenshots` | Payment screenshots | School owner, Principal, Accountant | Implemented (mock data) | 10 |
| `/school/fees/payment-details` | Payment details | School owner, Principal, Accountant | Implemented (mock data) | 10 |
| `/school/fees/refunds` | Refunds | School owner, Principal, Accountant | Implemented (mock data) | 10 |
| `/school/certificates` | Certificate requests | School owner, Principal, Accountant | Implemented (mock data) | 5 |
| `/school/certificates/new` | Generate certificate | School owner, Principal | Implemented (mock data) | 5 |
| `/school/certificates/register` | Issue register | School owner, Principal | Implemented (mock data) | 5 |
| `/school/certificates/verify` | Verify a certificate | School owner, Principal | Partial | 5 |
| `/school/library` | Library catalogue | School owner, Principal, Librarian | Implemented (mock data) | 14 |
| `/school/library/loans` | Issues & returns | School owner, Principal, Librarian | Implemented (mock data) | 14 |
| `/school/transport` | Vehicles | School owner, Principal, Transport coordinator | Implemented (mock data) | 14 |
| `/school/transport/routes` | Routes & stops | School owner, Principal, Transport coordinator | Implemented (mock data) | 14 |
| `/school/reports` | Reports | School owner, Principal | Partial | 17 |
| `/school/audit` | Audit history | School owner, Principal | Implemented (mock data) | 19 |
| `/school/settings` | Settings & permissions | School owner, Principal | Partial | 1, 19 |

## Teacher workspace

Root: `/teacher`

| Route | Screen | Roles | Status | Catalogue § |
|---|---|---|---|---|
| `/teacher` | Home | Teacher | Implemented (mock data) | 7 |
| `/teacher/today` | Today’s timetable | Teacher | Implemented (mock data) | 7 |
| `/teacher/attendance` | Mark Attendance | Teacher | Implemented (mock data) | 6 |
| `/teacher/attendance/:classId` | Class attendance | Teacher | Implemented (mock data) | 6 |
| `/teacher/homework` | Homework | Teacher | Implemented (mock data) | 8 |
| `/teacher/homework/new` | Add Homework | Teacher | Implemented (mock data) | 8 |
| `/teacher/marks` | Enter Marks | Teacher | Implemented (mock data) | 9 |
| `/teacher/marks/:classId` | Class marks | Teacher | Implemented (mock data) | 9 |
| `/teacher/classes` | My classes | Teacher | Implemented (mock data) | 7 |
| `/teacher/syllabus` | Syllabus progress | Teacher | Partial | 8 |
| `/teacher/notices` | Notices | Teacher | Implemented (mock data) | 12 |
| `/teacher/leave` | Request Leave | Teacher | Implemented (mock data) | 11 |
| `/teacher/materials` | Study material | Teacher | Planned | 8 |
| `/teacher/lessons` | Lesson plans | Teacher | Planned | 8 |
| `/teacher/messages` | Parent messages | Teacher | Planned | 12 |

## Parent portal

Root: `/parent`

| Route | Screen | Roles | Status | Catalogue § |
|---|---|---|---|---|
| `/parent` | Home | Parent | Implemented (mock data) | 12 |
| `/parent/attendance` | Attendance | Parent | Implemented (mock data) | 6 |
| `/parent/homework` | Homework | Parent | Implemented (mock data) | 8 |
| `/parent/results` | Results | Parent | Implemented (mock data) | 9 |
| `/parent/fees` | Fees | Parent | Implemented (mock data) | 10 |
| `/parent/notices` | Notices | Parent | Implemented (mock data) | 12 |
| `/parent/calendar` | Calendar | Parent | Implemented (mock data) | 2 |
| `/parent/timetable` | Timetable | Parent | Implemented (mock data) | 7 |
| `/parent/ptm` | Meet a teacher | Parent | Implemented (mock data) | 12 |
| `/parent/certificates` | Certificates | Parent | Implemented (mock data) | 5 |
| `/parent/documents` | Documents | Parent | Planned | 16 |
| `/parent/profile` | Profile & preferences | Parent | Planned | 12 |

## Student portal

Root: `/student`

| Route | Screen | Roles | Status | Catalogue § |
|---|---|---|---|---|
| `/student` | Home | Student | Implemented (mock data) | 8 |
| `/student/timetable` | Timetable | Student | Implemented (mock data) | 7 |
| `/student/homework` | Homework | Student | Implemented (mock data) | 8 |
| `/student/exams` | Exams | Student | Implemented (mock data) | 9 |
| `/student/results` | Results | Student | Implemented (mock data) | 9 |
| `/student/attendance` | Attendance | Student | Implemented (mock data) | 6 |
| `/student/notices` | Notices | Student | Implemented (mock data) | 12 |
| `/student/calendar` | Calendar | Student | Implemented (mock data) | 2 |
| `/student/materials` | Study material | Student | Planned | 8 |
| `/student/achievements` | Achievements | Student | Planned | 4, 13 |

