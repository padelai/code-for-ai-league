import { Card } from "@/components/ui/card";
import { Target, Users, Video } from "lucide-react";

const benefits = [
  {
    title: "Individual Metrics",
    description:
      "Gain objective insights into each player's strengths and improvement areas, with detailed data on court positioning, stroke variety, and overall impact.",
    icon: Target,
    image:
      "https://www.dropbox.com/scl/fi/kqf740cq4w4x4lat4ycnj/stats.png?rlkey=isho3njltl33wkpwvs9h2lifn&raw=1",
  },
  {
    title: "Team Metrics",
    description:
      "Enhance partner coordination and team strategy with data-driven insights, perfect for players preparing together for tournaments.",
    icon: Users,
    image:
      "https://www.dropbox.com/scl/fi/rz10nbzdvskln0xiclk49/team.jpg?rlkey=z4u0byl111mjp90iko7mf7g2f&raw=1",
  },
  {
    title: "Video Augmentation",
    description:
      "Streamline footage by removing downtime, and amplify analysis with visual highlights of ball trajectory and positioning heatmaps.",
    icon: Video,
    image:
      "https://www.dropbox.com/scl/fi/8nvdsvd7l64k1zg30p8bx/video-aug.jpg?rlkey=xjf064n6cqlqpi7l7fs1m5s9x&raw=1",
  },
];

export default function Benefits() {
  return (
    <div className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          Transform Your Game
        </h2>

        <div className="space-y-12">
          {benefits.map((benefit, index) => (
            <Card key={index} className="overflow-hidden border-none shadow-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div
                  className={`p-8 flex flex-col justify-center ${index % 2 === 1 ? "md:order-2" : ""}`}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <benefit.icon className="h-8 w-8 text-primary" />
                    <h3 className="text-2xl font-bold">{benefit.title}</h3>
                  </div>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </div>
                <div
                  className={`aspect-video ${index % 2 === 1 ? "md:order-1" : ""}`}
                >
                  <img
                    src={benefit.image}
                    alt={benefit.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
