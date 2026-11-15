# Parts of the product that are not connected to a backend yet

In the live app (API mode) these screens say "This part is not available yet." They still work with
sample data in demo (mock) mode. Each one needs tables, rules and a decision about how it should
behave before it is built, so none of them was guessed at.

| Screen | What is missing |
| --- | --- |
| Year-end rollover wizard | The backend has a one-step promote (`POST /api/academic-years/rollover`), but the screen is a different, rules-based flow (attendance and marks thresholds, section capacity, checks). One of the two must change. |
| Parent-teacher meeting slots | No slots or bookings. |
| Results overview (school) | Needs a per-class results summary endpoint over the existing marks. |
| Reports (school) | Needs report definitions (which reports, which columns). |
| Syllabus progress (teacher) | Syllabus coverage is not tracked. |
| Certificate verification inside the school portal | The public check exists (`/api/public/certificates/verify`, needs school and serial). The screen only sends a serial. |

Connected and working: students, staff, admissions enquiries, campuses, invoices and payments, fee
heads and "raise a fee", notices, library books and loans, transport, certificates (requests and
register), attendance, homework, marks, report cards, teacher workspace, family views, school bank
details, payment screenshots, opening balances, phone notifications, the ZAQSA team screens (schools,
plans and usage, onboarding, support, system status), and, added later: school calendar (staff,
parents and students each see what is meant for them), staff leave requests with the approval inbox
(approve or reject once), vendors, events and functions, parent queries (parents ask from "Ask the
school", the office replies), and the exam datesheet (also shown to the parent and student of that
class).

The database tables for the later group (`CalendarEvent`, `LeaveRequest`, `Vendor`, `EventPlan`,
`ParentQuery`, `ExamSlot`) are new: run `npm run db:push:pg` against the production database once
before the version that uses them goes live.
