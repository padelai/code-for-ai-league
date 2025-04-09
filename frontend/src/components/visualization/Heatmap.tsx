import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import simpleheat from 'simpleheat';

interface HeatmapProps {
  defencePercentage?: number;
  transitionPercentage?: number;
  volleyPercentage?: number;
  netPossession?: number;
  points: [[number, number], number][]
}

export default function Heatmap({
  defencePercentage = 0,
  transitionPercentage = 0,
  volleyPercentage = 0,
  netPossession = 0,
  points = []
}: HeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Temporary calculating values here
  let totalValue = 0;
  let defenceValue = 0;
  let transitionValue = 0;
  let volleyValue = 0;

  points.map(([[_, y], intensity]) => {
      const norm = Math.abs(y - 25) / 25;
      // console.log(`(${x}, ${y}) -> ${norm}`);
      totalValue += intensity;
      if(norm < 0.4) {
        volleyValue += intensity;
      } else if (norm > 0.7) {
        defenceValue += intensity;
      } else {
        transitionValue += intensity
      }
  })

  console.log(`Values: def=${defenceValue}, tra=${transitionValue}, vol=${volleyValue}`);

  defencePercentage = defenceValue / totalValue * 100;
  transitionPercentage = transitionValue / totalValue * 100;
  volleyPercentage = volleyValue / totalValue * 100;

  console.log(`Percentages: def=${defencePercentage}, tra=${transitionPercentage}, vol=${volleyPercentage}`);


  const data = [
    { name: 'Defence', value: defencePercentage },
    { name: 'Transition', value: transitionPercentage },
    { name: 'Volley', value: volleyPercentage }
  ];
  const COLORS = ['#3b82f6', '#f59e0b', '#ef4444'];

  
  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
  
    // Get canvas dimensions from container styling
    const rect = canvasRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
  
    // Set canvas intrinsic size and scale for retina BEFORE initializing simpleheat
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvasRef.current.width = width * devicePixelRatio;
    canvasRef.current.height = height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    canvasRef.current.style.width = `${width}px`;
    canvasRef.current.style.height = `${height}px`;

    // Initialize heatmap
    const heat = simpleheat(canvasRef.current);
    const radius = 30;

    // Transform court coordinates to canvas pixels
    const transformedPoints: [number, number, number][] = points.map(([[x, y], intensity]) => {
      // Map X from [50,100] to [width/2,width]
      // const canvasX = width/2 + ((x - 250) / 250) * (width/2);
      // Map Y from [0,50] to [0,height/2]
      // const canvasY = (y / 500) * (height/2);
      const canvasX = x / 25 * width;
      const canvasY = y / 50 * height;

      // console.log(`(${x}, ${y}) -> (${canvasX}, ${canvasY})`)

      return [canvasX, canvasY, intensity];
    });

    // Set data points and render with explicit RGB colors
    heat
      .data(transformedPoints)
      .radius(radius, radius * 1.2)
      .max(5)
      .gradient({
        '0.2': 'rgba(0, 0, 255, 0.8)',    // Blue
        '0.4': 'rgba(0, 255, 255, 0.8)',  // Cyan
        '0.5': 'rgba(255, 0, 0, 0.8)',     // Red
        '0.6': 'rgba(0, 255, 0, 0.8)',    // Green
        '0.8': 'rgba(255, 255, 0, 0.8)',  // Yellow
        
      });

    /*
    // Scale canvas for retina displays
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      const devicePixelRatio = window.devicePixelRatio || 1;

      canvasRef.current.width = width * devicePixelRatio;
      canvasRef.current.height = height * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);

      canvasRef.current.style.width = width + 'px';
      canvasRef.current.style.height = height + 'px';
    }
      */

    heat.draw();
  }, [defencePercentage, transitionPercentage, volleyPercentage]);

  return (
    <Card className="p-4">
      <div className="grid grid-cols-2 gap-4 h-[600px]">
        {/* Stats column with pie chart */}
        <div className="flex flex-col">
          <div className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data}
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(2)}%`}
                  contentStyle={{ backgroundColor: 'var(--background)', border: 'none', color: 'var(--foreground)' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Net Possession Counter */}
          {false && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Net Possession</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Time spent in volley zone when opponents in defense
                </p>
              </div>
              <div className="text-2xl font-bold text-primary">
                {netPossession}%
              </div>
            </div>
            {netPossession < 30 && (
              <p className="text-xs text-amber-600 mt-2">
                Low net possession indicates missed opportunities at the net
              </p>
            )}
          </div>)}
        </div>

        {/* Court visualization */}
        <div className="relative h-full">
          {/* Base court layout */}
          <div className="absolute inset-0 bg-muted rounded-lg">
            {/* Court zones */}
            <div className="absolute inset-0">
              {/* Defence zone (top) */}
              <div
                className="absolute top-0 left-0 right-0 h-[15%] rounded-t-lg overflow-hidden bg-primary/5"
              />

              {/* Transition zone (middle) */}
              <div
                className="absolute top-[15%] left-0 right-0 h-[15%] bg-amber-500/5"
              />

              {/* Volley zone (bottom near middle line) */}
              <div
                className="absolute top-[30%] left-0 right-0 h-[20%] bg-red-500/5"
              />

              {/* Court lines */}
              <div className="absolute inset-0">
                {/* Vertical center line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border transform -translate-x-1/2" />
                {/* Horizontal center line */}
                <div className="absolute top-1/2 left-0 right-0 h-px bg-border transform -translate-y-1/2" />
                {/* Court outline */}
                <div className="absolute inset-0 border border-border rounded-lg" />
              </div>

              {/* Zone labels */}
              <div className="absolute top-4 left-4 text-m">Defence: {Math.round(defencePercentage)}%</div>
              <div className="absolute top-[15%] left-4 transform translate-y-4 text-m">
                Transition: {Math.round(transitionPercentage)}%
              </div>
              <div className="absolute top-[35%] left-4 transform -translate-y-4 text-m">
                Volley: {Math.round(volleyPercentage)}%
              </div>
            </div>
          </div>

          {/* Heatmap canvas overlay */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ mixBlendMode: 'multiply' }}
          />
        </div>
      </div>
    </Card>
  );
}