export interface Sitter {
  name: string;
  classLabel: string;
}
export interface Room {
  name: string;
  seats: number;
}

/** "Room 1: 30" on each line. */
export function readRooms(text: string): Room[] {
  return text.split("\n").flatMap((line) => {
    const m = /^(.+?)\s*:\s*(\d{1,3})$/.exec(line.trim());
    return m && Number(m[2]) > 0 ? [{ name: m[1]!, seats: Number(m[2]) }] : [];
  });
}

/**
 * Seats students room by room, taking one from each class in turn so that neighbours are from
 * different classes wherever the numbers allow. Whoever does not fit is returned as unseated.
 */
export function seatingPlan(students: Sitter[], rooms: Room[]) {
  const queues = new Map<string, Sitter[]>();
  for (const s of students) queues.set(s.classLabel, [...(queues.get(s.classLabel) ?? []), s]);
  const order: Sitter[] = [];
  let last = "";
  while (order.length < students.length) {
    // The fullest class goes next, but not the one just seated if another still has students.
    const left = [...queues].filter(([, q]) => q.length).sort((a, b) => b[1].length - a[1].length);
    const [label, queue] = left.find(([c]) => c !== last) ?? left[0]!;
    order.push(queue.shift()!);
    last = label;
  }
  let next = 0;
  const seated = rooms.map((r) => {
    const people = order.slice(next, next + r.seats);
    next += people.length;
    return { room: r.name, seats: people };
  });
  return { rooms: seated, unseated: order.slice(next) };
}
