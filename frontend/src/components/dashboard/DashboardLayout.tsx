import { useState } from "react";
// import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
// import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Link } from "react-router-dom";
import { Video, LogOut, MenuIcon, Wallet } from "lucide-react";
// import { useAuth } from "@/contexts/AuthContext";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

const sidebarItems = [
  {
    icon: Video,
    label: "Videos",
    href: "/dashboard/",
  },
  /*
  {
    icon: Users,
    label: "Coaches",
    href: "/dashboard/coaches",
  },
  */
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // const { logout, user } = useUser();
  // const { user } = useAuth();
  // const [location, setLocation] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b bg-background/80 backdrop-blur-sm z-50 flex items-center px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <MenuIcon className="h-5 w-5" />
        </Button>
        <div className="ml-4">
          <Logo showText={true} />
        </div>
      </div>

      {/* Sidebar backdrop for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 bottom-0 w-64 bg-sidebar border-r transform transition-transform duration-200 ease-in-out z-40
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        <div className="h-16 border-b flex items-center px-6">
          <Logo
            // href="/dashboard"
            showText={true}
            // className="text-sidebar-foreground"
          />
        </div>

        <div className="p-4 space-y-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            //const isActive = location === item.href;
            const isActive = true;

            return (
              <Link key={item.href} to={item.href}>
                <a
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
                    ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    }`}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </a>
              </Link>
            );
          })}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-4">
          {/* Wallet Card */}
          {false && (
            <Drawer>
              <DrawerTrigger asChild>
                <Card className="bg-sidebar-accent/10 border-none p-4 cursor-pointer hover:bg-sidebar-accent/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-sidebar-foreground">
                        Compute Units
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        {/*user?.computeUnits || 0 */}
                      </p>
                    </div>
                  </div>
                </Card>
              </DrawerTrigger>
              <DrawerContent className="h-[85vh] p-6">
                <div className="mx-auto w-full max-w-lg">
                  <DrawerHeader className="text-left px-0">
                    <DrawerTitle className="text-2xl font-bold">
                      Add Compute Units
                    </DrawerTitle>
                    <DrawerDescription>
                      Purchase compute units to analyze more videos. One compute
                      unit is required per minute of video analysis.
                    </DrawerDescription>
                  </DrawerHeader>

                  <div className="mt-8 space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      <Card className="p-4 text-center cursor-pointer hover:bg-accent transition-colors">
                        <p className="text-2xl font-bold">100</p>
                        <p className="text-sm text-muted-foreground">Units</p>
                        <p className="mt-2 font-medium">$10</p>
                      </Card>
                      <Card className="p-4 text-center cursor-pointer hover:bg-accent transition-colors border-primary">
                        <p className="text-2xl font-bold">500</p>
                        <p className="text-sm text-muted-foreground">Units</p>
                        <p className="mt-2 font-medium">$45</p>
                        <p className="text-xs text-primary">Best Value</p>
                      </Card>
                      <Card className="p-4 text-center cursor-pointer hover:bg-accent transition-colors">
                        <p className="text-2xl font-bold">1000</p>
                        <p className="text-sm text-muted-foreground">Units</p>
                        <p className="mt-2 font-medium">$80</p>
                      </Card>
                    </div>

                    {/* Stripe Elements will be added here */}
                    <div className="space-y-4">
                      <div className="h-12 bg-input rounded-md" />
                      <Button className="w-full" size="lg">
                        Purchase Units
                      </Button>
                    </div>

                    <p className="text-sm text-muted-foreground text-center">
                      Secure payment powered by Stripe. Your card information is
                      never stored on our servers.
                    </p>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>
          )}

          {/* User Card */}
          {false && (
            <Card className="bg-sidebar-accent/10 border-none p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-sidebar-foreground">
                    {/* user?.username */}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                onClick={() => {
                  // logout();
                  setIsSidebarOpen(false);
                  // setLocation("/");
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 min-h-screen transition-all duration-200 ease-in-out">
        {/* Add padding top on mobile for the header */}
        <main className="pt-16 lg:pt-0">
          <div className="container mx-auto p-4 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
