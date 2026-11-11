# Parts of the product that are not connected to a backend yet

In the live app (API mode) these screens say "This part is not available yet." They still work with
sample data in demo (mock) mode. Each one needs tables, rules and a decision about how it should
behave before it is built, so none of them was guessed at.

| Screen | What is missing |
| --- | --- |
| Vendors | No vendors table or routes. |
| School calendar | No calendar events table. |
| Staff leave requests (teachers and admin) | No leave table or approval rules. |
| Approvals inbox | No approvals model; depends on what needs approval (leave, expenses, certificates?). |
| Events planning | No event plans table. |
| Parent queries | No queries/messages table between parents and the school. |
| Exam datesheet | Exams exist (name, marks) but have no dates, subjects, classes or rooms. |
| Fee structure by class | Screen built: fee heads (name, GST) and "Raise a fee" for a class or section with a preview. Amounts per class and frequency are still not stored; each raised fee carries its own amount. |
| Year-end rollover wizard | The backend has a one-step promote (`POST /api/academic-years/rollover`), but the screen is a different, rules-based flow (attendance and marks thresholds, section capacity, checks). One of the two must change. |
| Parent-teacher meeting slots | No slots or bookings. |
| Certificate verification inside the school portal | The public check exists (`/api/public/certificates/verify`, needs school and serial). The screen only sends a serial. |

Connected and working: students, staff, admissions enquiries, campuses, invoices and payments, fee
heads (admin API), notices, library books and loans, transport, certificates (requests and register),
attendance, homework, marks, report cards, teacher workspace, family views, school bank details,
payment screenshots, opening balances, phone notifications, and the ZAQSA team screens (schools,
plans and usage, onboarding, support, system status).
