import { Outlet } from "@tanstack/react-router";
import { Nav } from "./Nav";
import { Footer } from "./Footer";
import { CartDrawer } from "./CartDrawer";
import { Toaster } from "sonner";

export function Layout() {
  return (
    <div className="min-h-screen bg-[color:var(--color-mist)]">
      <Nav />
      <main>
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <Toaster position="bottom-right" toastOptions={{ className: "!font-sans" }} />
    </div>
  );
}
