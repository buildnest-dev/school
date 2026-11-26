# Screen inventory

_Generated from `src/config/screens.ts` by `npm run docs:inventory`. Do not edit by hand._

**Status legend.** Implemented = working UI against the development mock with the documented service contract. Partial = works but covers only part of the feature, or uses sample data. Planned = route exists and shows an honest "not built yet" page.

**Totals:** 122 screens: 113 implemented, 9 partial, 0 planned.

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
| `/platform/features` | Features | Platform administrator | Implemented (mock data) | 1 |
| `/platform/config` | Platform configuration | Platform administrator | Implemented (mock data) | 1, 19 |

## School administration (owner, principal, accountant, librarian, transport)

Root: `/school`

| Route | Screen | Roles | Status | Catalogue § |
|---|---|---|---|---|
| `/school` | Dashboard | School owner, Principal, Vice principal, Admission officer, HR manager, Reception, Accountant, Librarian, Transport coordinator | Implemented (mock data) | 17 |
| `/school/approvals` | Approval inbox | School owner, Principal | Implemented (mock data) | 7, 16 |
| `/school/calendar` | Calendar & holidays | School owner, Principal, Vice principal, Admission officer, HR manager, Reception | Implemented (mock data) | 2 |
| `/school/notices` | Notices | School owner, Principal, Vice principal, Reception | Implemented (mock data) | 12 |
| `/school/notices/new` | Compose notice | School owner, Principal | Implemented (mock data) | 12 |
| `/school/queries` | Parent queries | School owner, Principal | Implemented (mock data) | 12 |
| `/school/events` | Events & functions | School owner, Principal | Partial | 2, 13 |
| `/school/ptm` | Parent-teacher meetings | School owner, Principal | Implemented (mock data) | 12 |
| `/school/students` | Students | School owner, Principal, Vice principal, Admission officer | Implemented (mock data) | 4 |
| `/school/students/:id` | Student profile | School owner, Principal, Vice principal, Admission officer | Implemented (mock data) | 4 |
| `/school/admissions` | Admissions | School owner, Principal, Vice principal, Admission officer, Reception | Implemented (mock data) | 4 |
| `/school/staff` | Staff | School owner, Principal, HR manager | Implemented (mock data) | 11 |
| `/school/leave` | Staff leave | School owner, Principal, HR manager | Implemented (mock data) | 11, 7 |
| `/school/campuses` | Campuses | School owner, Principal | Implemented (mock data) | 1 |
| `/school/attendance` | Attendance overview | School owner, Principal, Vice principal | Implemented (mock data) | 6 |
| `/school/exams` | Exam datesheet | School owner, Principal | Implemented (mock data) | 9 |
| `/school/results` | Results overview | School owner, Principal | Partial | 9 |
| `/school/rollover` | Academic-year rollover | School owner, Principal | Implemented (mock data) | 3 |
| `/school/timetable` | Timetable | School owner, Principal, Vice principal | Partial | 7 |
| `/school/curriculum` | Classes, subjects & syllabus | School owner, Principal | Partial | 8 |
| `/school/fees` | Fee collection | School owner, Principal, Accountant | Implemented (mock data) | 10 |
| `/school/fees/structure` | Fee structure | School owner, Principal, Accountant | Implemented (mock data) | 10 |
| `/school/fees/ledger` | Student ledger | School owner, Principal, Accountant | Implemented (mock data) | 10 |
| `/school/vendors` | Vendors | School owner, Principal, Accountant | Implemented (mock data) | 10 |
| `/school/fees/screenshots` | Payment screenshots | School owner, Principal, Accountant | Implemented (mock data) | 10 |
| `/school/fees/opening-balances` | Opening balances | School owner, Principal, Accountant | Implemented (mock data) | 10 |
| `/school/fees/payment-details` | Payment details | School owner, Principal, Accountant | Implemented (mock data) | 10 |
| `/school/fees/refunds` | Refunds | School owner, Principal, Accountant | Implemented (mock data) | 10 |
| `/school/certificates` | Certificate requests | School owner, Principal | Implemented (mock data) | 5 |
| `/school/certificates/new` | Generate certificate | School owner, Principal | Implemented (mock data) | 5 |
| `/school/certificates/register` | Issue register | School owner, Principal | Implemented (mock data) | 5 |
| `/school/certificates/verify` | Verify a certificate | School owner, Principal | Implemented (mock data) | 5 |
| `/school/library` | Library catalogue | School owner, Principal, Librarian | Implemented (mock data) | 14 |
| `/school/library/loans` | Issues & returns | School owner, Principal, Librarian | Implemented (mock data) | 14 |
| `/school/transport` | Vehicles | School owner, Principal, Transport coordinator | Implemented (mock data) | 14 |
| `/school/transport/routes` | Routes & stops | School owner, Principal, Transport coordinator | Implemented (mock data) | 14 |
| `/school/reports` | Reports | School owner, Principal | Partial | 17 |
| `/school/audit` | Audit history | School owner, Principal | Implemented (mock data) | 19 |
| `/school/settings` | Settings & permissions | School owner, Principal | Partial | 1, 19 |
| `/school/achievements` | Achievements | School owner, Principal | Implemented (mock data) | 13 |
| `/school/records` | Registers | School owner, Principal, Vice principal, Admission officer, HR manager, Reception, Accountant, Librarian, Transport coordinator | Implemented (mock data) | 2, 4, 5, 6, 7, 10, 11, 13, 14, 15, 16, 21 |
| `/school/records/:module` | Register | School owner, Principal, Vice principal, Admission officer, HR manager, Reception, Accountant, Librarian, Transport coordinator | Implemented (mock data) | 16 |
| `/school/staff-attendance` | Staff attendance | School owner, Principal, Vice principal, HR manager | Implemented (mock data) | 6 |
| `/school/cover` | Cover lessons | School owner, Principal, Vice principal | Implemented (mock data) | 8 |
| `/school/student-files` | Student documents | School owner, Principal, Vice principal, Admission officer | Implemented (mock data) | 3 |
| `/school/stock` | Stock | School owner, Principal, Accountant, Librarian | Implemented (mock data) | 10 |
| `/school/payroll` | Payroll | School owner, Accountant | Implemented (mock data) | 6 |
| `/school/payslips` | My payslips | School owner, Principal, Vice principal, Admission officer, HR manager, Reception, Accountant, Librarian, Transport coordinator | Implemented (mock data) | 6 |
| `/school/seating` | Exam seating | School owner, Principal, Vice principal | Implemented (mock data) | 9 |
| `/school/report-builder` | Report builder | School owner, Principal, Vice principal, Admission officer, HR manager, Accountant | Implemented (mock data) | 17 |
| `/school/early-warning` | Students to check on | School owner, Principal, Vice principal | Implemented (mock data) | 17 |
| `/school/polls` | Polls and read receipts | School owner, Principal, Vice principal, Admission officer, HR manager, Reception, Accountant, Librarian, Transport coordinator | Implemented (mock data) | 12 |
| `/school/print` | Print centre | School owner, Principal, Accountant | Implemented (mock data) | 5 |
| `/school/print/:kind/:ref` | Print | School owner, Principal, Accountant, Vice principal, Admission officer, HR manager, Reception, Librarian, Transport coordinator | Implemented (mock data) | 5 |

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
| `/teacher/materials` | Study material | Teacher | Implemented (mock data) | 8 |
| `/teacher/lessons` | Lesson plans | Teacher | Implemented (mock data) | 8 |
| `/teacher/messages` | Parent messages | Teacher | Implemented (mock data) | 12 |
| `/teacher/achievements` | Achievements | Teacher | Implemented (mock data) | 13 |
| `/teacher/records` | Registers | Teacher | Implemented (mock data) | 2, 4, 5, 6, 7, 10, 11, 13, 14, 15, 16, 21 |
| `/teacher/records/:module` | Register | Teacher | Implemented (mock data) | 16 |
| `/teacher/covers` | Cover lessons | Teacher | Implemented (mock data) | 8 |
| `/teacher/submissions` | Homework answers | Teacher | Implemented (mock data) | 8 |
| `/teacher/quizzes` | Online tests | Teacher | Implemented (mock data) | 9 |
| `/teacher/polls` | Polls and read receipts | Teacher | Implemented (mock data) | 12 |
| `/teacher/payslips` | My payslips | Teacher | Implemented (mock data) | 6 |
| `/teacher/print/:kind/:ref` | Print | Teacher | Implemented (mock data) | 5 |

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
| `/parent/ask` | Ask the school | Parent | Implemented (mock data) | 12 |
| `/parent/certificates` | Certificates | Parent | Implemented (mock data) | 5 |
| `/parent/documents` | Documents | Parent | Implemented (mock data) | 16 |
| `/parent/profile` | Profile & preferences | Parent | Implemented (mock data) | 12 |
| `/parent/messages` | Teacher messages | Parent | Implemented (mock data) | 12 |
| `/parent/achievements` | Achievements | Parent | Implemented (mock data) | 13 |
| `/parent/records` | Registers | Parent | Implemented (mock data) | 2, 4, 5, 6, 7, 10, 11, 13, 14, 15, 16, 21 |
| `/parent/records/:module` | Register | Parent | Implemented (mock data) | 16 |
| `/parent/answers` | Send homework | Parent | Implemented (mock data) | 12 |
| `/parent/quizzes` | Online tests | Parent | Implemented (mock data) | 12 |
| `/parent/polls` | Polls and read receipts | Parent | Implemented (mock data) | 12 |
| `/parent/print/:kind/:ref` | Print | Parent | Implemented (mock data) | 5 |

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
| `/student/materials` | Study material | Student | Implemented (mock data) | 8 |
| `/student/achievements` | Achievements | Student | Implemented (mock data) | 4, 13 |
| `/student/records` | Registers | Student | Implemented (mock data) | 2, 4, 5, 6, 7, 10, 11, 13, 14, 15, 16, 21 |
| `/student/records/:module` | Register | Student | Implemented (mock data) | 16 |
| `/student/answers` | Send homework | Student | Implemented (mock data) | 12 |
| `/student/quizzes` | Online tests | Student | Implemented (mock data) | 9 |
| `/student/polls` | Polls and read receipts | Student | Implemented (mock data) | 12 |

