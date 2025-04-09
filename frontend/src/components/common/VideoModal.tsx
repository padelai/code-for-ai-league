import React, { useCallback, useEffect, useRef, useState } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface Chapter {
  start: number;
  end?: number;
  title: string;
}

export interface VideoModalProps {
  videoTitle: string;
  videoSrc: string;
  chapters?: Chapter[];
  duration?: number; // External duration provided (in seconds)
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startTime?: number;
  endTime?: number;
}

/**
 * VideoModal - A modal dialog that displays a video player with reliable chapter navigation.
 * When startTime and/or endTime are provided, both the custom and Plyr's built-in progress UI
 * are limited to that segment and scrolled immediately to the trimmed fragment.
 * The blue progress tracker has pointer-events disabled so that underlying chapter markers
 * remain clickable.
 */
const VideoModal: React.FC<VideoModalProps> = ({
  videoTitle,
  videoSrc,
  chapters = [],
  duration: externalDuration,
  open,
  onOpenChange,
  startTime = 0,
  endTime,
}) => {
  // Use a callback ref for the video element to ensure it's available.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Plyr | null>(null);
  // We'll keep track of the video duration; if externalDuration is provided, it will be used.
  const [videoDuration, setVideoDuration] = useState<number>(externalDuration || 0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playerInitialized, setPlayerInitialized] = useState<boolean>(false);

  const debugLog = (message: string, ...args: any[]) => {
    const now = new Date().toISOString().substring(11, 23);
    console.log(`[VideoModal ${now}] ${message}`, ...args);
  };

  // Callback ref: assign the video element when mounted.
  const setVideoElement = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && open) {
      // If externalDuration is provided, force it onto the video element.
      if (externalDuration && externalDuration > 0) {
        node.setAttribute('duration', externalDuration.toString());
        node.dispatchEvent(new Event('durationchange'));
      }
      node.currentTime = startTime;
      setCurrentTime(startTime);
      node.dispatchEvent(new Event('timeupdate'));
    }
  }, [open, startTime, externalDuration]);

  // When externalDuration changes, update our state and update the video element and Plyr UI.
  useEffect(() => {
    if (externalDuration && externalDuration > 0) {
      debugLog("Using external duration:", externalDuration);
      setVideoDuration(externalDuration);
      if (videoRef.current) {
        videoRef.current.setAttribute('duration', externalDuration.toString());
        videoRef.current.dispatchEvent(new Event('durationchange'));
      }
      // if (playerRef.current && playerInitialized && playerRef.current.elements.progress) {
      //  playerRef.current.elements.progress.setAttribute('max', externalDuration.toString());
      // }
    }
  }, [externalDuration, playerInitialized]);

  // When the modal opens, force a seek to the startTime.
  useEffect(() => {
    if (open && videoRef.current) {
      debugLog("Modal opened and video element is available.");
      videoRef.current.currentTime = startTime;
      setCurrentTime(startTime);
      videoRef.current.dispatchEvent(new Event('timeupdate'));
    }
  }, [open, startTime]);

  // Also listen for loaded metadata in case it fires after mounting.
  useEffect(() => {
    if (open && videoRef.current) {
      const handleLoadedMetadata = () => {
        debugLog("Loaded metadata, forcing seek to startTime:", startTime);
        if (externalDuration && externalDuration > 0) {
          videoRef.current!.setAttribute('duration', externalDuration.toString());
          videoRef.current!.dispatchEvent(new Event('durationchange'));
          setVideoDuration(externalDuration);
        }
        videoRef.current!.currentTime = startTime;
        setCurrentTime(startTime);
        videoRef.current!.dispatchEvent(new Event('timeupdate'));
      };
      videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      return () => videoRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
    }
  }, [open, startTime, externalDuration]);

  // Loop back when reaching endTime.
  useEffect(() => {
    if (endTime && currentTime >= endTime) {
      debugLog("Reached endTime, seeking back to startTime");
      handleSeek(startTime);
    }
  }, [currentTime, endTime, startTime]);

  // --- TRIMMED TIMELINE LOGIC ---
  const isTrimmed = (startTime > 0 || endTime !== undefined) && videoDuration > 0;
  const timelineStart = startTime;
  const timelineEnd = endTime !== undefined ? endTime : videoDuration;
  const timelineDuration = timelineEnd - timelineStart;
  const getPercentage = (time: number) => {
    if (isTrimmed) {
      return ((time - timelineStart) / timelineDuration) * 100;
    }
    return (time / videoDuration) * 100;
  };

  // Consolidated time update handler.
  const timeUpdateHandler = (newTime: number, playerInstance?: Plyr) => {
    setCurrentTime(newTime);
    if (endTime !== undefined && newTime >= endTime) {
      debugLog(`Time update: Reached endTime (${newTime} >= ${endTime}), resetting to ${startTime}`);
      if (playerInstance) {
        playerInstance.currentTime = startTime;
      } else if (videoRef.current) {
        videoRef.current.currentTime = startTime;
      }
    }
    // If trimmed, update Plyr's built-in progress bar manually.
    /*
    if (isTrimmed && playerInstance && playerInstance.elements.progress) {
      const adjustedTime = Math.max(0, newTime - timelineStart);
      const playedEl = playerInstance.elements.progress.querySelector('.plyr__progress__played') as HTMLElement;
      if (playedEl) {
        playedEl.style.width = `${(adjustedTime / timelineDuration) * 100}%`;
      }
    }
    */
  };

  // Initialize Plyr when the modal is open.
  useEffect(() => {
    if (!open) return;
    if (!playerInitialized && videoRef.current) {
      const videoElement = videoRef.current;
      debugLog("Initializing Plyr...");
      try {
        const player = new Plyr(videoElement, {
          controls: [
            'play-large', 'play', 'progress', 'current-time',
            'mute', 'volume', 'captions', 'settings', 'pip',
            'airplay', 'fullscreen'
          ],
          duration: externalDuration && externalDuration > 0 ? externalDuration : undefined,
        });
        playerRef.current = player;
        setPlayerInitialized(true);

        player.on('ready', () => {
          debugLog("Plyr ready");
          if (chapters.length > 0 && videoElement) {
            createChapterTrack(videoElement);
          }
          // Update the progress max attribute using the external duration or trimmed timeline.
          
          /*
          if (isTrimmed && player.elements.progress) {
            player.elements.progress.setAttribute('max', timelineDuration.toString());
          } else if (externalDuration && externalDuration > 0 && player.elements.progress) {
            player.elements.progress.setAttribute('max', externalDuration.toString());
          }
          */
          if (startTime > 0) {
            // Delay the seek slightly.
            setTimeout(() => {
              player.currentTime = startTime;
              timeUpdateHandler(startTime, player);
            }, 100);
          }
        });

        player.on('timeupdate', () => {
          timeUpdateHandler(player.currentTime, player);
        });
        videoElement.addEventListener('timeupdate', () => {
          if (isFinite(videoElement.currentTime)) {
            timeUpdateHandler(videoElement.currentTime);
          }
        });

        const metadataHandler = () => {
          if (videoElement && isFinite(videoElement.duration)) {
            const videoDur = videoElement.duration;
            debugLog("Loaded metadata, duration:", videoDur);
            if (!externalDuration) {
              setVideoDuration(videoDur);
            } /*else if (player.elements.progress) {
              player.elements.progress.setAttribute('max', externalDuration.toString());
            }*/
          }
        };
        player.on('loadedmetadata', metadataHandler);
        videoElement.addEventListener('loadedmetadata', metadataHandler);
        player.on('canplay', () => {
          if (videoElement && isFinite(videoElement.duration) && !externalDuration) {
            setVideoDuration(videoElement.duration);
          }
        });

        const timerId = setInterval(() => {
          if (player && typeof player.currentTime === 'number' && player.playing) {
            timeUpdateHandler(player.currentTime, player);
          } else if (videoElement && isFinite(videoElement.currentTime) && !videoElement.paused) {
            timeUpdateHandler(videoElement.currentTime);
          }
        }, 250);
        return () => clearInterval(timerId);
      } catch (err) {
        console.error("Error initializing Plyr:", err);
        setPlayerInitialized(false);
      }
    } else if (playerInitialized && playerRef.current && videoRef.current) {
      const player = playerRef.current;
      const videoElement = videoRef.current;
      player.on('timeupdate', () => {
        timeUpdateHandler(player.currentTime, player);
      });
      videoElement.addEventListener('timeupdate', () => {
        if (isFinite(videoElement.currentTime)) {
          timeUpdateHandler(videoElement.currentTime);
        }
      });
      const timerId = setInterval(() => {
        if (player && typeof player.currentTime === 'number' && player.playing) {
          timeUpdateHandler(player.currentTime, player);
        } else if (videoElement && isFinite(videoElement.currentTime) && !videoElement.paused) {
          timeUpdateHandler(videoElement.currentTime);
        }
      }, 250);
      return () => clearInterval(timerId);
    }
  }, [open, playerInitialized, chapters, externalDuration, startTime, endTime, isTrimmed, timelineDuration]);

  // Cleanup Plyr on unmount.
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        debugLog("Cleaning up Plyr...");
        try {
          playerRef.current.destroy();
        } catch (err) {
          console.error("Error destroying Plyr:", err);
        }
        playerRef.current = null;
        setPlayerInitialized(false);
      }
    };
  }, []);

  const createChapterTrack = (videoElement: HTMLVideoElement) => {
    if (!chapters.length) return;
    debugLog("Creating chapter track");
    const track = document.createElement('track');
    track.kind = 'chapters';
    track.label = 'Chapters';
    track.default = true;
    const totalDuration = externalDuration || videoElement.duration || 3600;
    const vttContent = `WEBVTT\n\n${chapters.map((chapter, index) => {
      const startTimeStr = formatTime(chapter.start);
      const endTimeStr = chapter.end
        ? formatTime(chapter.end)
        : index < chapters.length - 1
          ? formatTime(chapters[index + 1].start)
          : formatTime(totalDuration);
      return `${startTimeStr} --> ${endTimeStr}\n${chapter.title}`;
    }).join('\n\n')}`;
    const vttBlob = new Blob([vttContent], { type: 'text/vtt' });
    const vttUrl = URL.createObjectURL(vttBlob);
    track.src = vttUrl;
    // Remove any existing track elements.
    videoElement.querySelectorAll('track').forEach(t => t.remove());
    videoElement.appendChild(track);
  };

  const handleSeek = (time: number) => {
    debugLog("Seeking to:", time);
    try {
      if (playerRef.current) {
        playerRef.current.currentTime = time;
        // playerRef.current.play().catch(err => debugLog("Plyr autoplay error:", err));
      } else if (videoRef.current) {
        videoRef.current.currentTime = time;
        videoRef.current.play().catch(err => debugLog("Video autoplay error:", err));
      }
      setCurrentTime(playerRef.current ? playerRef.current.currentTime : videoRef.current?.currentTime || 0);
    } catch (err) {
      console.error("Error during seek:", err);
      if (videoRef.current) {
        try {
          videoRef.current.currentTime = time;
          videoRef.current.play().catch(() => {});
          setCurrentTime(videoRef.current.currentTime);
        } catch (innerErr) {
          console.error("Final seek error:", innerErr);
        }
      }
    }
  };

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const formatTimeHMS = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoElement = e.currentTarget;
    console.error("Video error:", e);
    console.error("Error code:", videoElement.error?.code, "Message:", videoElement.error?.message);
  };

  const processChapters = (rawChapters: Chapter[], duration: number): Chapter[] => {
    if (rawChapters.length === 0) return [];
    const effectiveDur = duration > 0 ? duration : 3600;
    const sortedChapters = [...rawChapters].sort((a, b) => a.start - b.start);
    const processed: Chapter[] = [];
    for (let i = 0; i < sortedChapters.length; i++) {
      const current = { ...sortedChapters[i] };
      current.start = Math.max(0, current.start);
      if (current.end === undefined) {
        current.end = i < sortedChapters.length - 1 ? sortedChapters[i + 1].start : effectiveDur;
      }
      current.end = Math.min(effectiveDur, Math.max(current.start + 0.5, current.end));
      if (processed.length > 0) {
        const prev = processed[processed.length - 1];
        if (current.start < (prev.end || 1)) {
          const midpoint = (prev.start + current.start) / 2;
          if (midpoint > prev.start) {
            prev.end = midpoint;
            current.start = midpoint;
          } else {
            prev.end = prev.start + 0.5;
            current.start = prev.end;
          }
        }
      }
      processed.push(current);
    }
    return processed;
  };

  const effectiveDurationFinal = externalDuration || videoDuration;
  const processedChaptersFinal = processChapters(chapters, effectiveDurationFinal);

  useEffect(() => {
    debugLog(`Current time: ${currentTime}, Duration: ${videoDuration}`);
  }, [currentTime, videoDuration]);

  const getCustomProgressWidth = () => {
    if (!isTrimmed && startTime > 0 && endTime && currentTime >= startTime) {
      const progress = Math.min((currentTime - startTime) / (endTime - startTime), 1);
      return progress * (((endTime - startTime) / effectiveDurationFinal) * 100);
    }
    return isTrimmed && currentTime >= timelineStart
      ? Math.min(((currentTime - timelineStart) / timelineDuration) * 100, 100)
      : getPercentage(currentTime);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{videoTitle}</DialogTitle>
          <DialogDescription>
            {isTrimmed 
              ? `Playing segment: ${formatTimeHMS(timelineStart)} - ${formatTimeHMS(timelineEnd)}`
              : 'Click on the colored timeline regions to jump to the beginning of each chapter.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col">
          <div className="aspect-video">
            <video
              ref={setVideoElement}
              playsInline
              controls
              onTimeUpdate={(e) => timeUpdateHandler(e.currentTarget.currentTime)}
              className="w-full h-full"
              onError={handleVideoError}
              crossOrigin="anonymous"
              preload="metadata"
              {...(effectiveDurationFinal > 0 ? { "data-duration": effectiveDurationFinal } : {})}
            >
              {videoSrc && <source src={videoSrc} type="video/mp4" />}
              Your browser does not support the video tag.
            </video>
          </div>
          <div className="mt-2 mb-2 px-2 w-full">
            <div className="relative h-6 bg-gray-200 rounded overflow-hidden w-full">
              {processedChaptersFinal.map((chapter, index) => {
                let chapterStart = chapter.start;
                let chapterEnd = chapter.end || (chapter.start + 60);
                if (isTrimmed) {
                  if (chapterEnd < timelineStart || chapterStart > timelineEnd) return null;
                  chapterStart = Math.max(chapterStart, timelineStart);
                  chapterEnd = Math.min(chapterEnd, timelineEnd);
                }
                const left = getPercentage(chapterStart);
                const right = getPercentage(chapterEnd);
                const width = Math.max(0.5, right - left);
                const isCurrentChapter = currentTime >= chapterStart && currentTime < chapterEnd;
                return (
                  <div
                    key={`chapter-${index}`}
                    className={`absolute h-full cursor-pointer flex items-center justify-center transition-colors duration-150 ${isCurrentChapter ? 'bg-red-600' : 'bg-red-400 hover:bg-red-500'}`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      zIndex: isCurrentChapter ? 2 : 1
                    }}
                    title={`${chapter.title} (${formatTimeHMS(chapterStart)} - ${formatTimeHMS(chapterEnd)})`}
                    onClick={() => handleSeek(chapterStart)}
                  >
                    <span className="text-xs text-white font-medium truncate px-1">
                      {chapter.title}
                    </span>
                  </div>
                );
              })}
              {!isTrimmed && (
                <div
                  className="absolute h-1 bg-green-500 bottom-0 z-30 pointer-events-none"
                  style={{
                    left: `${(startTime / effectiveDurationFinal) * 100}%`,
                    width: `${(((endTime || effectiveDurationFinal) - startTime) / effectiveDurationFinal) * 100}%`
                  }}
                />
              )}
              {!isTrimmed && (
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
                  {startTime > 0 && (
                    <div
                      className="absolute h-full bg-black opacity-20"
                      style={{ left: 0, width: `${(startTime / effectiveDurationFinal) * 100}%` }}
                    />
                  )}
                  {endTime && (
                    <div
                      className="absolute h-full bg-black opacity-20"
                      style={{ left: `${(endTime / effectiveDurationFinal) * 100}%`, width: `${((effectiveDurationFinal - endTime) / effectiveDurationFinal) * 100}%` }}
                    />
                  )}
                </div>
              )}
              {effectiveDurationFinal > 0 && (
                <div
                  className="absolute top-0 h-full w-1 bg-white z-10 shadow-md pointer-events-none"
                  style={{
                    left: `${isTrimmed ? Math.min(100, Math.max(0, getPercentage(currentTime))) : Math.min(100, Math.max(0, (currentTime / effectiveDurationFinal) * 100))}%`,
                    transform: 'translateX(-50%)'
                  }}
                />
              )}
              {isTrimmed ? (
                <div
                  className="absolute h-full bg-blue-500 opacity-40 z-10 pointer-events-none"
                  style={{ left: `0%`, width: `${getCustomProgressWidth()}%` }}
                />
              ) : (
                startTime > 0 && endTime && effectiveDurationFinal > 0 && (
                  <div
                    className="absolute h-full bg-blue-500 opacity-40 z-10 pointer-events-none"
                    style={{
                      left: `${(startTime / effectiveDurationFinal) * 100}%`,
                      width: `${Math.min(((currentTime - startTime) / (endTime - startTime)) * ((endTime - startTime) / effectiveDurationFinal) * 100, ((endTime - startTime) / effectiveDurationFinal) * 100)}%`
                    }}
                  />
                )
              )}
              <div className="absolute top-0 right-0 bg-black bg-opacity-50 text-white text-xs px-1 rounded pointer-events-none">
                {isTrimmed
                  ? `${formatTimeHMS(currentTime)} / ${formatTimeHMS(timelineEnd)}`
                  : `${formatTimeHMS(currentTime)} / ${formatTimeHMS(effectiveDurationFinal)}`}
              </div>
              <div className="absolute bottom-0 w-full flex justify-between text-gray-500 text-xs px-1 pointer-events-none">
                <span>{isTrimmed ? formatTimeHMS(timelineStart) : formatTimeHMS(0)}</span>
                <span>{isTrimmed ? formatTimeHMS(timelineEnd) : formatTimeHMS(effectiveDurationFinal)}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoModal;
