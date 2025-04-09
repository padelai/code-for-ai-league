import { cn } from "@/lib/utils";

interface LogoProps {
  showText?: boolean;
}

export function Logo({ showText = true }: LogoProps) {
  return (
    <div className="flex items-center gap-2">
      <img
        src="/assets/logo.jpg"
        className={cn(
          "h-8 w-8 object-contain",
          "dark:invert dark:brightness-200",
        )}
      />
      {showText && (
        <span className="font-bold text-lg text-foreground">Value Metrics</span>
      )}
    </div>
  );
}
