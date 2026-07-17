import { getCurrentUser } from "./auth";
import { getDifficulty } from "./difficulty";
import { db, firebase } from "./firebase";

const RANKINGS = "rankings";
const LOSS_POINTS = 5;
const { FieldValue } = firebase.firestore;

function playerRankingPayload(user) {
  return {
    uid: user.uid,
    name: user.displayName || user.email?.split("@")[0] || "Jugador",
    photoURL: user.photoURL || "",
    points: 0,
    wins: 0,
    losses: 0,
    games: 0,
  };
}

export class RankingService {
  constructor() {
    this.db = db;
    this.unsubscribe = null;
  }

  async ensurePlayerProfile(user) {
    const ref = this.db.collection(RANKINGS).doc(user.uid);
    const doc = await ref.get();
    if (!doc.exists) {
      await ref.set({
        ...playerRankingPayload(user),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return ref;
  }

  async recordMyResult(room) {
    const user = getCurrentUser();
    if (!user || !room?.winner) return;

    const processed = room.rankingProcessed || [];
    if (processed.includes(user.uid)) return;

    const won = room.winner === user.uid;
    const difficulty = getDifficulty(room.difficulty);
    const points = won ? difficulty.winPoints : LOSS_POINTS;

    const playerRef = this.db.collection(RANKINGS).doc(user.uid);
    const roomRef = this.db.collection("rooms").doc(room.id);

    await this.db.runTransaction(async (tx) => {
      const roomSnap = await tx.get(roomRef);
      if (!roomSnap.exists) return;

      const roomData = roomSnap.data();
      if ((roomData.rankingProcessed || []).includes(user.uid)) return;

      const playerSnap = await tx.get(playerRef);
      const base = playerSnap.exists
        ? playerSnap.data()
        : playerRankingPayload(user);

      tx.set(
        playerRef,
        {
          uid: user.uid,
          name: user.displayName || base.name || "Jugador",
          photoURL: user.photoURL || base.photoURL || "",
          points: (base.points || 0) + points,
          wins: (base.wins || 0) + (won ? 1 : 0),
          losses: (base.losses || 0) + (won ? 0 : 1),
          games: (base.games || 0) + 1,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.update(roomRef, {
        rankingProcessed: FieldValue.arrayUnion(user.uid),
      });
    });
  }

  listenLeaderboard(callback, limit = 10) {
    if (this.unsubscribe) this.unsubscribe();

    this.unsubscribe = this.db
      .collection(RANKINGS)
      .orderBy("points", "desc")
      .limit(limit)
      .onSnapshot((snap) => {
        const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        callback(entries);
      });
  }

  async getPlayerRank(uid) {
    const doc = await this.db.collection(RANKINGS).doc(uid).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  stopListening() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}

export function formatWinRate(wins, games) {
  if (!games) return "0%";
  return `${Math.round((wins / games) * 100)}%`;
}
