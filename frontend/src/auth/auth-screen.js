import { useState } from "react";
import { guestLogin, login, register, storeSession } from "./auth-api";
import { useDispatch } from "react-redux";
import { setSessionId } from "../game/reducers/websocket.reducer";

const AuthScreen = ({ onAuthenticated }) => {
  const dispatch = useDispatch();
  const [isRegistering, setIsRegistering] = useState(false);
  const [form, setForm] = useState({ identifier: "", username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (isRegistering && !form.username.trim() && !form.email.trim()) {
      setError("Enter a username or email address to create an account.");
      return;
    }

    setIsSubmitting(true);

    try {
      const user = isRegistering
        ? await register({
            username: form.username.trim(),
            email: form.email.trim(),
            password: form.password,
          })
        : await login({
            ...(form.identifier.includes("@")
              ? { email: form.identifier }
              : { username: form.identifier }),
            password: form.password,
          });
      storeSession(user);
      dispatch(setSessionId(user.sessionId));
      onAuthenticated(user.sessionId);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const continueAsGuest = async () => {
    setError("");
    setIsSubmitting(true);

    try {
      const user = await guestLogin();
      storeSession(user);
      dispatch(setSessionId(user.sessionId));
      onAuthenticated(user.sessionId);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = () => {
    setIsRegistering((current) => !current);
    setError("");
    setForm({ identifier: "", username: "", email: "", password: "" });
  };

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-intro">
          <span className="waiting-kicker">CHESS ARENA</span>
          <h1>Make your move.</h1>
          <p>Sign in to find an opponent and keep your place in the arena.</p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <div className="auth-heading">
            <h2>{isRegistering ? "Create account" : "Welcome back"}</h2>
            <p>{isRegistering ? "Choose a username, an email, or both." : "Continue your next game."}</p>
          </div>
          {isRegistering ? (
            <>
              <label>
                Username
                <input name="username" type="text" value={form.username} onChange={updateField} minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" autoComplete="username" />
              </label>
              <label>
                Email
                <input name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" />
              </label>
            </>
          ) : (
            <label>
              Username or email
              <input name="identifier" type="text" value={form.identifier} onChange={updateField} placeholder="name@example.com" required autoComplete="username" />
            </label>
          )}
          <label>
            Password
            <input name="password" type="password" value={form.password} onChange={updateField} required minLength={8} autoComplete={isRegistering ? "new-password" : "current-password"} />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Working..." : isRegistering ? "Create account" : "Sign in"}
          </button>
          <button className="auth-switch" type="button" onClick={switchMode}>
            {isRegistering ? "Already have an account? Sign in" : "New to the arena? Create an account"}
          </button>
          {!isRegistering && (
            <button className="auth-switch" type="button" onClick={continueAsGuest} disabled={isSubmitting}>
              Continue as guest
            </button>
          )}
        </form>
      </section>
    </main>
  );
};

export default AuthScreen;
