import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const testimonials = [
  {
    quote:
      "Integrating this AI analysis solution into our video platform has been greatly appreciated by our customers. It not only enhances the value of connected court recordings but also empowers players and coaches with actionable insights they've never had before.",
    name: "Yegor Lebowski",
    title: "CEO and Founder of Supertrack",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
  },
  {
    quote:
      "Our coaching sessions have been completely transformed since we started using this platform. The AI-powered insights give our coaches a clear, objective view of each player's strengths and areas to improve, making training more focused and effective. The automated video highlights and player heatmaps save our coaches hours of preparation, allowing us to spend more time actually coaching. It's a must-have tool for any club that wants to deliver top-tier training experiences and keep players coming back for more.",
    name: "Prash Lewin",
    title: "Play Padel club owner",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e",
  },
];

export default function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const next = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prev = () => {
    setCurrentIndex(
      (prev) => (prev - 1 + testimonials.length) % testimonials.length,
    );
  };

  return (
    <div className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          What industry experts and padel players say
        </h2>

        <div className="relative max-w-4xl mx-auto">
          {/* Navigation buttons */}
          <button
            onClick={prev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 lg:-translate-x-12 z-10 p-2 rounded-full bg-background border shadow-lg hover:bg-accent hidden md:block"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={next}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 lg:translate-x-12 z-10 p-2 rounded-full bg-background border shadow-lg hover:bg-accent hidden md:block"
            aria-label="Next testimonial"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Testimonial card */}
          <Card className="relative bg-card shadow-lg border-none overflow-hidden">
            <div className="p-8 md:p-12">
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0">
                  <img
                    src={testimonials[currentIndex].avatar}
                    alt={testimonials[currentIndex].name}
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <blockquote>
                    <p className="text-lg md:text-xl text-muted-foreground mb-6 italic">
                      "{testimonials[currentIndex].quote}"
                    </p>
                    <footer>
                      <p className="font-semibold text-foreground">
                        {testimonials[currentIndex].name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {testimonials[currentIndex].title}
                      </p>
                    </footer>
                  </blockquote>
                </div>
              </div>
            </div>
          </Card>

          {/* Navigation dots */}
          <div className="flex justify-center gap-2 mt-6">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex ? "bg-primary" : "bg-primary/20"
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
