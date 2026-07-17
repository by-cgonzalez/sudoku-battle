import { auth, firebase } from "./firebase";

export function onAuthChange(callback) {
  return auth.onAuthStateChanged(callback);
}

export async function signInWithEmail(email, password) {
  return auth.signInWithEmailAndPassword(email, password);
}

export async function signUpWithEmail(email, password, displayName) {
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  await cred.user.updateProfile({ displayName });
  return cred;
}

export async function signInWithFacebook() {
  const provider = new firebase.auth.FacebookAuthProvider();
  provider.addScope("email");
  return auth.signInWithPopup(provider);
}

export async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  return auth.signInWithPopup(provider);
}

export async function signOut() {
  return auth.signOut();
}

export function getCurrentUser() {
  return auth.currentUser ?? null;
}
