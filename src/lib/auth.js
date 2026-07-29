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

export function getUserDisplayName(user) {
  if (!user) return "Jugador";
  return user.displayName || user.email?.split("@")[0] || "Jugador";
}

export function hasPasswordProvider(user) {
  return Boolean(user?.providerData?.some((p) => p.providerId === "password"));
}

export async function updateNickname(nickname) {
  const user = getCurrentUser();
  if (!user) throw new Error("Debes iniciar sesión");

  const trimmed = nickname.trim();
  if (trimmed.length < 2) throw new Error("El apodo debe tener al menos 2 caracteres");
  if (trimmed.length > 24) throw new Error("El apodo puede tener máximo 24 caracteres");

  await user.updateProfile({ displayName: trimmed });
  await user.reload();
  return getCurrentUser();
}

export async function changePassword(currentPassword, newPassword) {
  const user = getCurrentUser();
  if (!user) throw new Error("Debes iniciar sesión");
  if (!hasPasswordProvider(user)) {
    throw new Error("Tu cuenta no usa contraseña (iniciaste con Google/Facebook)");
  }
  if (!user.email) throw new Error("No hay correo asociado a la cuenta");
  if (!newPassword || newPassword.length < 6) {
    throw new Error("La nueva contraseña debe tener al menos 6 caracteres");
  }
  if (currentPassword === newPassword) {
    throw new Error("La nueva contraseña debe ser distinta a la actual");
  }

  const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
  await user.reauthenticateWithCredential(credential);
  await user.updatePassword(newPassword);
}
