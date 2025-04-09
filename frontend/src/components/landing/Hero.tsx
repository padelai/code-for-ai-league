import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function Hero() {
  return (
    <div className="pt-32 pb-16 px-4">
      <div className="container mx-auto text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
          Transforming Padel Performance
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Empowering players and coaches with game-changing video insights for
          smarter, faster improvement
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to="/auth">Start Your Journey</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="w-full sm:w-auto"
          >
            <Link to="/request-demo">Request a Demo</Link>
          </Button>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
          <img
            src="https://images.unsplash.com/photo-1526888935184-a82d2a4b7e67"
            alt="Padel action shot"
            className="rounded-lg shadow-lg aspect-video object-cover"
          />
          <img
            src="https://images.unsplash.com/photo-1657704358775-ed705c7388d2"
            alt="Analytics visualization"
            className="rounded-lg shadow-lg aspect-video object-cover"
          />
        </div>
      </div>
    </div>
  );
}
