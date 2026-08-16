"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirebaseAuth } from "../lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email");
    const password = formData.get("password");

    try {
      const auth = getFirebaseAuth();
      const credential = await signInWithEmailAndPassword(auth, email, password);

      if (credential.user.email?.toLowerCase() !== process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase()) {
        await signOut(auth);
        setMessage("This account does not have admin access.");
        return;
      }

      setMessage("Login successful!");
      router.replace("/dashboard");
    } catch (error) {
      if (error.code === "auth/invalid-credential") {
        setMessage("Email or password is incorrect.");
      } else if (error.code === "auth/too-many-requests") {
        setMessage("Too many attempts. Please try again later.");
      } else {
        setMessage("Unable to log in. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="login-page">
      <header className="site-header">
        <Link className="logo" href="/" aria-label="Classmates home">CLASSMATES</Link>
      </header>

      <section className="login-area">
        <form className="login-form" onSubmit={handleSubmit}>
          <h1>Sign in to Classmates</h1>

          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" placeholder="EMAIL" autoComplete="email" required />

          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" placeholder="PASSWORD" autoComplete="current-password" required />

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Log in"}
          </button>

          {message && (
            <p className={message === "Login successful!" ? "form-message success" : "form-message"} role="status">
              {message}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
