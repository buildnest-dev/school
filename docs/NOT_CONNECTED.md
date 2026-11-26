# Parts of the product that are not connected to a backend yet

Every screen in the app has a backend in the live app (API mode), and demo (mock) mode still works
with sample data. Some features are deliberately narrow:

| Feature | Limit |
| --- | --- |
| Files | Student documents and study material: PDF, JPEG or PNG up to 1 MB, ten per item, kept in the database. Larger files need an object storage service. |
| Teacher messages | A teacher writes to a parent and the parent can send one reply to each note. Not a chat. |
| Second parent or guardian | Recorded in a register as a contact. They get no login. |
| Online tests | Multiple choice only, one attempt each. |
| Payroll | The school types each earning and deduction. PF, ESI and tax are not worked out, and no money is moved. |
| Printing and PDF | Uses the browser's print window ("Save as PDF"). Files are not generated or e-signed on the server. |
| Registers | One shared form-and-stages screen for each record type; no special calculations. |
| Platform configuration | Read-only view of the server's settings. |
| Parent profile | A parent changes their phone number and password only. |
| School settings | Boards, grading scales, data download and help requests. School name, logo and colour are changed by the ZAQSA team, not on this screen. |
| Public forms | `/apply` (admission enquiry) and `/verify` (certificate check) on a school's own address. |
| New admission alerts | Sent inside the app, and to a phone where notifications are switched on. No SMS or e-mail. A desk with no login is not told, and the person admitting is shown which. |
| Feature switches | Switched per school by the ZAQSA team. Plans do not choose them yet. A home page or the daily briefing may still show a line from records saved before a feature was switched off. |

Not built, because each needs an outside service or a decision: SMS and WhatsApp, live bus GPS,
live video classes, an AI assistant, biometric devices, an online payment gateway, e-signature and
document scanning.

Connected and working: students, staff, admissions enquiries, campuses, invoices and payments, fee
heads and "raise a fee", notices, library books and loans, transport, certificates (requests,
register, verification and printing), attendance, homework (with answers and feedback), marks,
report cards, teacher workspace, family views, school bank details, payment screenshots, opening
balances, phone notifications, the ZAQSA team screens, school calendar, staff leave and the
approval inbox, vendors, events, parent queries, exam datesheet, year-end rollover, parent-teacher
meeting slots, reports, report builder, students to check on, syllabus progress, lesson plans,
achievements, timetable editing, student import from a file, exam creation and publishing, support requests, staff invites, staff attendance, cover lessons, exam seating, online tests, polls,
notice read receipts, stock, payroll, new admission alerts, bus requests, feature switches, and the registers (visitors, gate passes, health, clubs,
purchases, repairs and the rest listed in `src/config/modules.ts`).

Some database tables and columns are new (calendar, leave, vendors, events, queries, exam slots,
study material, lesson plans, teacher messages and replies, achievements, registers, staff
attendance, substitutions, homework answers, tests, polls, read receipts, files, stock, salaries and
payslips, plus the student bus request and the school's switched-off features): run `npm run db:push:pg` against the production database once **before** the version that
uses them goes live.
