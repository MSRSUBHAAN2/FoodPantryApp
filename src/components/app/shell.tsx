import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, ChefHat, Home, Package, Plus, Settings, ShoppingBasket, WifiOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AuthScreen } from "./auth-screen";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/inventory", label: "Stock", icon: Package },
  { to: "/add", label: "Add", icon: Plus },
  { to: "/diary", label: "Diary", icon: BookOpen },
  { to: "/recipes", label: "Recipes", icon: ChefHat },
] as const;

export function AppShell({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  }
  if (!session) return <AuthScreen />;
  return (
    <div className="mx-auto min-h-screen max-w-2xl pb-28">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <h1 className="truncate text-2xl font-extrabold">{title}</h1>
        <div className="flex items-center gap-1">
          {actions}
          <Link to="/shopping" aria-label="Shopping list" className="grid size-11 place-items-center rounded-full hover:bg-muted">
            <ShoppingBasket className="size-5" />
          </Link>
          <Link to="/settings" aria-label="Settings" className="grid size-11 place-items-center rounded-full hover:bg-muted">
            <Settings className="size-5" />
          </Link>
        </div>
      </header>
      <main className="space-y-6 px-4 py-5">{children}</main>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur">
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground data-[status=active]:text-primary"
              >
                {to === "/add" ? (
                  <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Icon className="size-5" />
                  </span>
                ) : (
                  <Icon className="size-5" />
                )}
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function OfflineBanner() {
  return (
    <p className="flex items-center gap-2 rounded-2xl bg-muted p-3 text-sm">
      <WifiOff className="size-4" /> You're offline — showing your last saved stock (read only).
    </p>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed p-8 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  return (
    <p role="alert" className="rounded-2xl bg-danger-soft p-3 text-sm">
      {error instanceof Error ? error.message : "Something went wrong."}
    </p>
  );
}
