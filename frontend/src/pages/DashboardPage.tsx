import dayjs from 'dayjs';
import { useState, useCallback, useEffect } from "react";
import 'plyr/dist/plyr.css';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { apiClient } from "@/utils/apiClient";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Play,
  Plus,
  Download,
  Share2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import UploadModal from "@/components/dashboard/UploadModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
// import UploadModal from "@/components/dashboard/UploadModal";
import useEmblaCarousel from "embla-carousel-react";
// import { useToast } from "@/hooks/use-toast";
import Heatmap from "@/components/visualization/Heatmap";
import VideoPlayer from '@/components/common/VideoPlayer';
import ReactMarkdown from 'react-markdown';


import {
  TwitterShareButton,
  LinkedinShareButton,
  WhatsappShareButton,
  TwitterIcon,
  LinkedinIcon,
  WhatsappIcon,
} from "react-share";
import { toast } from "sonner";

/*
interface PlayerAnalysis {
  name: string;
  defencePercentage: number;
  transitionPercentage: number;
  volleyPercentage: number;
  netPossession: number;
  insights: {
    positioning: string[];
    movement: string[];
  };
}
*/

interface Player {
  playerId: number;
  heatmap: [[number, number], number][];
  insights: {
    positioning: string[];
    movement: string[];
  };
}


interface VideoClip {
  id: number;
  title: string;
  startSec: number;
  endSec: number;
  thumbnailUrl: string;
  videoUrl: string;
  mediaUrl: string;
  players: Record<number, Player>;
}

interface VideoUpload {
  id: number;
  title: string;
  thumbnailUrl: string;
  videoUrl?: string;
  mediaUrl: string;
  uploadedAt: string;
  processing?: boolean;
  durationSeconds?: number;
  framesCount?: number;
  clips: VideoClip[];
}

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
}

function ShareModal({ open, onOpenChange, shareUrl }: ShareModalProps) {
  const absoluteShareUrl = `${window.location.origin}${shareUrl}`;
  const copyToClipboard = async () => {};
  /*
  const { toast } = useToast();
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(absoluteShareUrl);
      toast({
        title: "Success",
        description: "Share URL copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy URL",
        variant: "destructive",
      });
    }
  };
  */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Analysis</DialogTitle>
          <DialogDescription>
            Share this analysis with anyone using this link or on social media
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2 mb-4">
          <div className="grid flex-1 gap-2">
            <Input readOnly value={absoluteShareUrl} className="w-full" />
          </div>
          <Button size="icon" variant="secondary" onClick={copyToClipboard}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="secondary" asChild>
            <a
              href={absoluteShareUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>

        <div className="flex justify-center gap-4">
          <TwitterShareButton
            url={absoluteShareUrl}
            title="Check out my Padel game analysis!"
          >
            <TwitterIcon size={32} round />
          </TwitterShareButton>

          {/*
          <FacebookShareButton url={absoluteShareUrl} quote="Check out my Padel game analysis!">
            <FacebookIcon size={32} round />
          </FacebookShareButton>
          */}
          <LinkedinShareButton
            url={absoluteShareUrl}
            title="My Padel Game Analysis"
            summary="Check out the insights from my latest Padel game!"
          >
            <LinkedinIcon size={32} round />
          </LinkedinShareButton>

          <WhatsappShareButton
            url={absoluteShareUrl}
            title="Check out my Padel game analysis!"
          >
            <WhatsappIcon size={32} round />
          </WhatsappShareButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function VideoAnalysisPage() {
  const { user } = useAuth();
  // const [isAnalyzing, setIsAnalyzing] = useState(false);
  // const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploads, setUploadsData] = useState<VideoUpload[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoUpload|null>(
    // mockUploads[0],
    null
  );
  
  const [selectedClip, setSelectedClip] = useState<VideoClip|null>(
    //mockUploads[0].clips[0],
    null
  );

  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    dragFree: true,
  });
  const [clipsRef, clipsApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    dragFree: true,
  });
  // const { toast } = useToast();
  // const toast = (x: any) => {};
  console.log(selectedPlayerIndex);
  console.log(selectedClip ? selectedClip.players : 'player not selected' );

  const [playerNames, setPlayerNames] = useState<string[]>([
    "Player 1",
    "Player 2",
    "Player 3",
    "Player 4",
  ]);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    const fetchRecordingsData = async () => {
      try {
        const response = await apiClient.fetch("/recordings");
        const data = await response.json();
        setUploadsData(data.items);
      } catch (error) {
        console.error("Failed to fetch recordings: ", error);
      }
    };

    fetchRecordingsData();
  }, []);

  useEffect(() => {
    if (selectedClip?.id) {
      fetch(`/api/clips/${selectedClip.id}/players`, {
        credentials: "include",
      })
        .then((res) => {
          if (!res.ok) {
            if (res.status === 404) {
              const defaultNames = [
                "Player 1",
                "Player 2",
                "Player 3",
                "Player 4",
              ];
              setPlayerNames(defaultNames);
              return fetch(`/api/clips/${selectedClip.id}/players`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                  players: defaultNames.map((name, index) => ({
                    name,
                    index,
                  })),
                }),
              });
            }
            throw new Error("Failed to fetch player names");
          }
          return res.json();
        })
        .then((players) => {
          if (Array.isArray(players)) {
            const names = new Array(4)
              .fill(null)
              .map((_, i) => `Player ${i + 1}`);
            players.forEach((player: { index: number; playerName: string }) => {
              if (player.index >= 0 && player.index < 4) {
                names[player.index] = player.playerName;
              }
            });
            setPlayerNames(names);
          }
        })
        .catch((error) => {
          console.error("Error fetching player names:", error);
          /*
          toast({
            title: "Error",
            description: "Failed to load player names",
            variant: "destructive",
          });
          */
        });
    }
  }, [selectedClip?.id]);

  const handlePlayerNameChange = (index: number, name: string) => {
    const newNames = [...playerNames];
    newNames[index] = name || `Player ${index + 1}`;
    setPlayerNames(newNames);

    if (selectedClip?.id) {
      const players = newNames.map((name, idx) => ({
        name,
        index: idx,
      }));

      fetch(`/api/clips/${selectedClip.id}/players`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ players }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to save player names");
          return res.json();
        })
        .then(() => {
          toast("Success", {
            description: "Player names saved successfully",
          });
        })
        .catch((error) => {
          console.error("Error saving player names:", error);
          toast.error("Error", {
            description: "Failed to save player names",
          });
        });
    }
  };

  const handleUploadSuccess = useCallback(() => {
    toast("Success", {
      description:
        "Match uploaded successfully. Processing will begin shortly.",
    });
  }, [toast]);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      const currentIndex = emblaApi.selectedScrollSnap();
      const selectedVideo = uploads[currentIndex];
      setSelectedVideo(selectedVideo);
      setSelectedClip(selectedVideo.clips[0]);
    };

    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, uploads]);

  const scrollPrev = useCallback(() => {
    emblaApi?.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  const scrollClipsPrev = useCallback(() => {
    clipsApi?.scrollPrev();
  }, [clipsApi]);

  const scrollClipsNext = useCallback(() => {
    clipsApi?.scrollNext();
  }, [clipsApi]);

  const handleShare = useCallback(async () => {
    if (!selectedClip?.id) return;
    if (!user) {
      toast.error("Error", {
        description: "Please log in to share analysis",
      });
      return;
    }

    try {
      const response = await fetch(`/api/clips/${selectedClip.id}/share`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("Error", {
            description: "Please log in to share analysis",
          });
          return;
        }
        const errorData = await response.text();
        throw new Error(errorData || "Failed to generate share URL");
      }

      const { shareUrl } = await response.json();
      setShareUrl(shareUrl);
      setIsShareModalOpen(true);
    } catch (error) {
      console.error("Share error:", error);
      toast.error("Error", {
        description:
          error instanceof Error
            ? error.message
            : "Failed to generate share URL",
      });
    }
  }, [selectedClip?.id, toast, user]);


  let chapters = selectedVideo?.clips.map((clip) => ({
    start: clip.startSec,
    end: clip.endSec,
    title: `Rally ${clip.id}`
  }))


  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold mb-2"></h1>
          <p className="text-sm lg:text-base text-muted-foreground">
            Upload your match footage to get detailed insights into player
            positioning and movement patterns.
          </p>
        </div>
        <Button onClick={() => setIsUploadModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Video
        </Button>
      </div>
      <UploadModal
        open={isUploadModalOpen}
        onOpenChange={setIsUploadModalOpen}
        onSuccess={handleUploadSuccess}
      />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg lg:text-xl">My Videos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div className="overflow-hidden" ref={emblaRef}>
              <div className="flex">
                {uploads.map((video) => (
                  <div
                    key={video.id}
                    className="flex-[0_0_100%] min-w-0 pl-4 first:pl-0 sm:flex-[0_0_50%] md:flex-[0_0_33.333%] lg:flex-[0_0_25%] xl:flex-[0_0_20%]"
                    onClick={() => {
                      console.log("Current video state is", video);
                      setSelectedVideo(video);                      
                    }}
                  >
                    <div
                      className={`
                        aspect-video relative cursor-pointer transition-transform
                        ${selectedVideo?.id === video.id ? "ring-2 ring-primary" : "hover:scale-[0.98]"}
                      `}
                    >
                      <img
                        src={
                          video.thumbnailUrl ||
                          "https://images.unsplash.com/photo-1526888935184-a82d2a4b7e67?q=80&w=100"
                        }
                        alt={`${video.title}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent text-white rounded-b-lg">
                        <p className="text-xs">Uploaded on {dayjs(video.uploadedAt).format('DD/MM/YYYY')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {false && 
            <Button
              variant="outline"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 hidden sm:flex"
              onClick={scrollPrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>}
            { false && 
            <Button
              variant="outline"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 hidden sm:flex"
              onClick={scrollNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>}
          </div>
        </CardContent>
      </Card>

      {selectedVideo && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg lg:text-xl">Video Clips</CardTitle>
              {false && selectedClip && ( 
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    fetch(`/api/clips/${selectedClip?.id}/download`, {
                      credentials: "include",
                    })
                      .then((response) => {
                        if (!response.ok) throw new Error("Download failed");
                        return response.blob();
                      })
                      .then((blob) => {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.style.display = "none";
                        a.href = url;
                        a.download = `clip_${selectedClip?.id}.mp4`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);

                        toast("Success", {
                          description: "Clip download started",
                        });
                      })
                      .catch((error) => {
                        console.error("Download error:", error);
                        toast.error("Error", {
                          description: "Failed to download clip",
                        });
                      });
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Save Clip
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="overflow-hidden" ref={clipsRef}>
                <div className="flex">
                  {selectedVideo?.clips.map((clip) => (
                    <div
                      key={clip.id}
                      className="flex-[0_0_100%] min-w-0 pl-4 first:pl-0 sm:flex-[0_0_33.333%] md:flex-[0_0_25%] lg:flex-[0_0_20%]"
                    >
                      <div
                        className={`
                          aspect-video relative cursor-pointer transition-transform
                          ${selectedClip?.id === clip.id ? "ring-2 ring-primary" : "hover:scale-[0.98]"}
                        `}
                        onClick={() => {
                          setSelectedClip(clip);
                        }
                        
                        }
                      >
                        <img
                          src={clip.thumbnailUrl}
                          alt={clip.title}
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Play className="w-8 h-8 text-white drop-shadow-lg" />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent text-white rounded-b-lg">
                          <p className="text-xs font-medium">{clip.title}</p>
                          <p className="text-xs opacity-75">
                            {clip.startSec} - {clip.endSec}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 hidden sm:flex"
                onClick={scrollClipsPrev}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 hidden sm:flex"
                onClick={scrollClipsNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}



      {selectedVideo?.id && (
        <div className="w-3/5 mx-auto">
          <VideoPlayer
          videoTitle={selectedVideo?.title || ''}
          videoSrc={selectedVideo?.mediaUrl || ''}
          duration={selectedClip ? selectedClip?.endSec - selectedClip?.startSec : selectedVideo?.durationSeconds || 0}
          chapters={selectedClip && selectedClip.startSec > 0 ? [] : chapters}
          startTime={selectedClip?.startSec || 0}
          endTime={selectedClip?.endSec || selectedVideo.durationSeconds}
        />
        </div>
      )}

      {false && (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg lg:text-xl">Players</CardTitle>
          <CardDescription>
            Identified players in this clip. You can customize their names
            below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {playerNames.map((name, index) => (
              <div key={index} className="space-y-2">
                <div className="aspect-square bg-muted rounded-lg overflow-hidden relative">
                  {/* Blurred background */}
                  <div
                    className="absolute inset-0 bg-cover bg-center blur-md scale-110 opacity-50"
                    style={{
                      backgroundImage: `url(/attached_assets/player_${index + 1}.png)`,
                    }}
                  />
                  {/* Main image */}
                  <img
                    src={`/attached_assets/player_${index + 1}.png`}
                    alt={name}
                    className="absolute inset-0 w-full h-full object-contain z-10"
                  />
                </div>
                <Input
                  placeholder="Enter player name"
                  value={name}
                  onChange={(e) =>
                    handlePlayerNameChange(index, e.target.value)
                  }
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>)}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg lg:text-xl">Analysis</CardTitle>
            <div className="flex gap-2">
              {selectedClip && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  className="flex items-center gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  Share results
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs
            defaultValue="0"
            className="w-full"
            onValueChange={(value) => setSelectedPlayerIndex(parseInt(value))}
          >
            <TabsList className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {playerNames.map((name, index) => (
                <TabsTrigger
                  key={index}
                  value={index.toString()}
                  className="w-full"
                >
                  <div className="text-left">
                    <div className="font-medium">{name}</div>
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>

            {selectedClip && Object.entries(selectedClip.players).map(([_, player], index) => (
              <TabsContent key={index} value={index.toString()}>
                <div className="grid grid-cols-1 gap-4 lg:gap-8">
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg lg:text-xl">Court Positioning</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="w-full max-w-3xl mx-auto">
                        <Heatmap
                          points={player.heatmap}
                          // key={`${selectedClip.id}-${player.playerId}-${player.defencePercentage}`}
                          // defencePercentage={player.defencePercentage}
                          // transitionPercentage={player.transitionPercentage}
                          // volleyPercentage={player.volleyPercentage}
                          // netPossession={player.netPossession}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg lg:text-xl">AI Recommendations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="p-4 bg-muted rounded-lg">
                          <h3 className="font-semibold mb-2 text-sm lg:text-base">Court Positioning</h3>
                          <ul className="list-disc list-inside space-y-2 text-sm lg:text-base text-muted-foreground">
                            {player.insights.positioning.map((insight, _) => (
                              <ReactMarkdown>{insight}</ReactMarkdown>
                            ))}
                          </ul>
                        </div>
                        { false && (<div className="p-4 bg-muted rounded-lg">
                          <h3 className="font-semibold mb-2 text-sm lg:text-base">Movement</h3>
                          <ul className="list-disc list-inside space-y-2 text-sm lg:text-base text-muted-foreground">
                            {false && player.insights.movement.map((insight, i) => (
                              <li key={i}>{insight}</li>
                            ))}
                          </ul>
                        </div>)}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {selectedVideo?.processing ? (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-lg font-medium">
                AI is analyzing your video. It might take some time.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        selectedClip?.players && <div></div>
      )}

      <ShareModal
        open={isShareModalOpen}
        onOpenChange={setIsShareModalOpen}
        shareUrl={shareUrl}
      />
    </div>
  );
}
