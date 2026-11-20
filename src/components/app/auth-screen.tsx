import { useState } from "react";
import { toast } from "sonner";
import { Leaf } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PASSWORD_RULE = "Password needs at least 6 characters, one capital letter and one special character (like ! or #).";
export function passwordOk(p: string) {
  return p.length >= 6 && /[A-Z]/.test(p) && /[^A-Za-z0-9]/.test(p);
}

export function AuthScreen() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "up" && !passwordOk(password)) {
      toast.error(PASSWORD_RULE);
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) setNotice("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Leaf className="size-6" />
        </span>
        <div>
          <h1 className="text-3xl font-extrabold">Use It Up</h1>
          <p className="text-sm text-muted-foreground">Eat what you buy. Waste less.</p>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-3xl border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">{mode === "in" ? "Sign in" : "Create your account"}</h2>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" />
          {mode === "up" && (
            <p className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">{PASSWORD_RULE}</p>
          )}
        </div>
        {notice && <p className="rounded-xl bg-fresh-soft p-3 text-sm">{notice}</p>}
        <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
          {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
        </Button>
        <button type="button" className="w-full py-2 text-sm font-medium text-primary underline-offset-4 hover:underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-muted-foreground">Your food, diary and settings are private to your account.</p>
    </main>
  );
}
