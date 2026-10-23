import { useState, type ReactNode } from "react";
import { Wallet } from "lucide-react";
import toast from "react-hot-toast";
import { api, getToken, setToken, ApiError } from "../lib/api";
import { Button } from "./ui/button";

export function AuthGate({ authRequired, children }: { authRequired: boolean; children: ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(!authRequired || getToken() !== null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (loggedIn) return <>{children}</>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || pending) return;
    setPending(true);
    setError(null);
    try {
      const { token } = await api.login(password);
      setToken(token);
      setLoggedIn(true);
      toast.success("Welcome back");
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Incorrect password" : "Login failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-base-100 border border-base-300 rounded-2xl shadow-soft w-full max-w-sm p-8 flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 mb-2">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <Wallet className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-semibold">Commitment Tracker</h1>
          <p className="text-sm text-base-content/60">Enter your password to continue</p>
        </div>
        <input
          type="password"
          placeholder="Password"
          className="input input-bordered w-full rounded-btn bg-base-100 border-base-300 focus:border-primary"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <div className="text-sm text-error">{error}</div>}
        <Button type="submit" disabled={pending || password.length === 0} className="w-full">
          {pending ? <span className="loading loading-spinner loading-sm" /> : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
