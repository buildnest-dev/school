/**
 * Sample answers for the few screens that call the server directly, so the sample build can show
 * them. Reading returns the records below; saving says so and changes nothing.
 */
const subjects = (...names: string[]) => names.map((name) => ({ id: name.toLowerCase(), name }));

const CLASSES = ["6", "7", "8"].map((name) => ({
  id: `class-${name}`,
  name,
  stage: "middle",
  sections: [
    { id: `${name}a`, name: "A", students: 32 },
    { id: `${name}b`, name: "B", students: 30 },
  ],
  subjects: subjects("English", "Hindi", "Mathematics", "Science", "Social Science"),
}));

const BELL = [
  { slot: 1, label: "Period 1", startsAt: "08:50", endsAt: "09:30", isBreak: false },
  { slot: 2, label: "Period 2", startsAt: "09:40", endsAt: "10:20", isBreak: false },
  { slot: 3, label: "Period 3", startsAt: "10:30", endsAt: "11:10", isBreak: false },
  { slot: 4, label: "Lunch", startsAt: "11:10", endsAt: "11:40", isBreak: true },
  { slot: 5, label: "Period 4", startsAt: "11:40", endsAt: "12:20", isBreak: false },
];

const TAUGHT = [
  ["English", "Kavita Iyer"],
  ["Mathematics", "Arjun Menon"],
  ["Science", "Sana Sheikh"],
  ["Hindi", "Ramesh Gupta"],
  ["Social Science", "Neha Bose"],
] as const;

const PERIODS = [1, 2, 3, 4, 5, 6].flatMap((day) =>
  [1, 2, 3, 5].map((slot, i) => {
    const [subject, teacher] = TAUGHT[(day + i) % TAUGHT.length]!;
    return { day, slot, subject, teacher, room: `R-${10 + i}` };
  }),
);

const SLOTS = [
  { id: "p1", teacher: "Kavita Iyer", date: "2026-11-07", time: "10:00", bookedBy: "Rahul Mehta" },
  { id: "p2", teacher: "Kavita Iyer", date: "2026-11-07", time: "10:15", bookedBy: "" },
  { id: "p3", teacher: "Arjun Menon", date: "2026-11-07", time: "10:00", bookedBy: "" },
];

const QUERIES = [
  {
    id: "q1",
    subject: "Bus timing on exam days",
    body: "Will Route 4 run at the usual time during the exams?",
    reply: "Yes, Route 4 runs as usual. Please be at the stop by 7:40.",
    assignedTo: "School office",
    status: "answered",
    openedOn: "2026-10-20",
  },
];

export function sampleResponse(path: string, method: string): unknown {
  const known = /^\/(classes|timetable\/sections|ptm-slots|parent-queries)/.test(path);
  if (!known) return undefined;
  if (method !== "GET")
    return { ok: true, mode: "mock", message: "Sample data: nothing was saved." };
  if (path === "/classes") return CLASSES;
  if (path.startsWith("/timetable/sections/")) {
    const id = path.split("/").pop() ?? "6a";
    return { classSection: id.toUpperCase(), bell: BELL, periods: PERIODS };
  }
  if (path === "/ptm-slots") return { items: SLOTS };
  if (path === "/parent-queries") return { items: QUERIES };
  return undefined;
}
