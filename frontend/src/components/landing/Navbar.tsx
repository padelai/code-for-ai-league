import { Link } from "react-router-dom";

import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  return (
    <nav className="fixed w-full bg-background/80 backdrop-blur-sm z-50 border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <Link to="/auth">
            <Button variant="ghost">Sign In</Button>
          </Link>
          <Link to="/auth">
            <Button>Get Started</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
