export function ConfigScreen() {
  return (
    <section className="screen active">
      <div className="card card-center">
        <h2>Configuración requerida</h2>
        <p>
          Para jugar en línea necesitas configurar Firebase en{" "}
          <code>src/lib/firebase-config.js</code>:
        </p>
        <ol className="setup-steps">
          <li>
            Crea un proyecto en{" "}
            <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer">
              Firebase Console
            </a>
          </li>
          <li>
            Habilita <strong>Authentication</strong> → Email/Password, Google y Facebook
          </li>
          <li>
            Crea una base de datos <strong>Firestore</strong>
          </li>
          <li>Copia las credenciales al archivo de configuración</li>
        </ol>
        <p className="hint">
          Luego ejecuta <code>npm install</code> y <code>npm run dev</code>.
        </p>
      </div>
    </section>
  );
}
