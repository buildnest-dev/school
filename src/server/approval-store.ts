import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import type { ApprovalRequest, ApprovalStore } from "./approvals";

/** The shared Firestore collection the admin site also reads and writes. */
const COLLECTION = "login_requests";

export const firestoreConfigured = () => Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);

function db() {
  if (!getApps().length) {
    initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? "{}")),
    });
  }
  return getFirestore();
}

const date = (v: unknown) => (v instanceof Timestamp ? v.toDate() : undefined);

export function firestoreStore(): ApprovalStore {
  const col = () => db().collection(COLLECTION);
  return {
    async create(r) {
      const ref = await col().add({
        email: r.email,
        name: r.name,
        device: r.device,
        ip: r.ip,
        status: "pending",
        remember: r.remember,
        createdAt: FieldValue.serverTimestamp(),
      });
      return ref.id;
    },

    async recent(email): Promise<ApprovalRequest[]> {
      // One equality filter only, so no composite index is needed; sorting happens here.
      const snap = await col().where("email", "==", email).limit(30).get();
      return snap.docs
        .map((d) => {
          const x = d.data();
          return {
            id: d.id,
            status: String(x.status ?? ""),
            codeHash: typeof x.codeHash === "string" ? x.codeHash : undefined,
            expiresAt: date(x.expiresAt),
            attempts: Number(x.attempts ?? 0),
            createdAt: date(x.createdAt) ?? new Date(0),
            decidedAt: date(x.decidedAt) ?? date(x.approvedAt) ?? date(x.rejectedAt) ?? date(x.lockedAt),
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    async supersede(email) {
      const snap = await col().where("email", "==", email).limit(30).get();
      const open = snap.docs.filter((d) => ["pending", "approved"].includes(String(d.data().status)));
      await Promise.all(
        open.map((d) => d.ref.update({ status: "superseded", decidedAt: FieldValue.serverTimestamp() })),
      );
    },

    async failAttempt(id, max) {
      await db().runTransaction(async (tx) => {
        const ref = col().doc(id);
        const d = await tx.get(ref);
        if (!d.exists || d.data()?.status !== "approved") return;
        const attempts = Number(d.data()?.attempts ?? 0) + 1;
        tx.update(
          ref,
          attempts >= max
            ? { attempts, status: "locked", decidedAt: FieldValue.serverTimestamp() }
            : { attempts },
        );
      });
    },

    async consume(id) {
      return db().runTransaction(async (tx) => {
        const ref = col().doc(id);
        const d = await tx.get(ref);
        const x = d.data();
        const exp = date(x?.expiresAt);
        if (!d.exists || x?.status !== "approved" || !exp || exp < new Date()) return false;
        tx.update(ref, { status: "used", usedAt: FieldValue.serverTimestamp() });
        return true;
      });
    },
  };
}
