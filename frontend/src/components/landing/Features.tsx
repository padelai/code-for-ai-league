import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scissors, BarChart2, Video } from "lucide-react";
// import Heatmap from "../visualization/Heatmap";

const features = [
  {
    title: "AI Video Editing",
    description:
      "Automatically trims out downtime, delivering shareable, highlight-ready clips for social media in seconds.",
    icon: Scissors,
  },
  {
    title: "Match Analysis",
    description:
      "Advanced video and data analysis provides actionable insights, empowering players and coaches to elevate skills and refine tactics.",
    icon: BarChart2,
  },
  {
    title: "Remote Coaching Tools",
    description:
      "Enables coaches to assess player skill levels remotely and offer targeted, data-driven guidance via streamlined video insights.",
    icon: Video,
  },
];

export default function Features() {
  return (
    <div className="py-16 bg-muted/50">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          Powerful Features
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="border-none shadow-lg">
              <CardHeader>
                <feature.icon className="h-12 w-12 text-primary mb-4" />
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
