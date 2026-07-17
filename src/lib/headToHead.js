import { getCurrentUser } from "./auth";
import { getDifficulty } from "./difficulty";
import { db, firebase } from "./firebase";

const RIVALRIES = "rivalries";
const { FieldValue } = firebase.firestore;

export function getPairKey(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

export class HeadToHeadService {
  constructor() {
    this.db = db;
    this.unsubscribe = null;
    this.currentPairKey = null;
  }

  async recordMatch(room) {
    if (!room?.winner || room.players?.length !== 2) return;

    const roomRef = this.db.collection("rooms").doc(room.id);
    const [p1, p2] = room.players;
    const pairKey = getPairKey(p1.uid, p2.uid);
    const rivalryRef = this.db.collection(RIVALRIES).doc(pairKey);

    await this.db.runTransaction(async (tx) => {
      const roomSnap = await tx.get(roomRef);
      if (!roomSnap.exists) return;

      const roomData = roomSnap.data();
      if (roomData.headToHeadRecorded) return;

      const rivalrySnap = await tx.get(rivalryRef);
      const base = rivalrySnap.exists
        ? rivalrySnap.data()
        : {
            pairKey,
            playerUids: [p1.uid, p2.uid].sort(),
            wins: { [p1.uid]: 0, [p2.uid]: 0 },
            playerNames: { [p1.uid]: p1.name, [p2.uid]: p2.name },
            totalGames: 0,
            recentMatches: [],
          };

      const wins = { ...base.wins };
      wins[roomData.winner] = (wins[roomData.winner] || 0) + 1;

      const matchEntry = {
        roomId: room.id,
        winnerId: roomData.winner,
        winnerName: roomData.winnerName,
        difficulty: roomData.difficulty || "medium",
        scores: Object.fromEntries(
          roomData.players.map((p) => [p.uid, p.solvedCount || 0])
        ),
        finishedAt: Date.now(),
      };

      const recentMatches = [matchEntry, ...(base.recentMatches || [])].slice(0, 10);

      tx.set(
        rivalryRef,
        {
          pairKey,
          playerUids: [p1.uid, p2.uid].sort(),
          wins,
          playerNames: {
            [p1.uid]: p1.name,
            [p2.uid]: p2.name,
          },
          totalGames: (base.totalGames || 0) + 1,
          recentMatches,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.update(roomRef, { headToHeadRecorded: true });
    });
  }

  listenRivalry(opponentUid, callback) {
    const user = getCurrentUser();
    if (!user || !opponentUid) return;

    const pairKey = getPairKey(user.uid, opponentUid);
    if (this.unsubscribe && this.currentPairKey === pairKey) return;

    this.stopListening();
    this.currentPairKey = pairKey;

    this.unsubscribe = this.db
      .collection(RIVALRIES)
      .doc(pairKey)
      .onSnapshot((snap) => {
        callback(snap.exists ? { id: snap.id, ...snap.data() } : null);
      });
  }

  stopListening() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.currentPairKey = null;
  }
}

export function getHeadToHeadStats(rivalry, myUid, opponent) {
  if (!rivalry || !myUid || !opponent) {
    return { myWins: 0, opponentWins: 0, totalGames: 0, recentMatches: [] };
  }

  return {
    myWins: rivalry.wins?.[myUid] || 0,
    opponentWins: rivalry.wins?.[opponent.uid] || 0,
    totalGames: rivalry.totalGames || 0,
    recentMatches: rivalry.recentMatches || [],
  };
}

export function formatMatchDate(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
