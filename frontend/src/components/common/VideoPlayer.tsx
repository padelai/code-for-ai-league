import React, { useCallback, useEffect, useRef, useState } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

export interface Chapter {
  start: number;
  end?: number;
  title: string;
}

export interface VideoPlayerProps {
  videoTitle: string;
  videoSrc: string;
  chapters?: Chapter[];
  duration?: number; // External duration provided (in seconds)
  startTime?: number;
  endTime?: number;
  className?: string; // Allow custom styling
}

/**
 * VideoPlayer - A component that displays a video player with reliable chapter navigation.
 * When startTime and/or endTime are provided, both the custom and Plyr's built-in progress UI
 * are limited to that segment and scrolled immediately to the trimmed fragment.
 */
const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoTitle,
  videoSrc,
  chapters = [],
  duration: externalDuration,
  startTime = 0,
  endTime,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Plyr | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(externalDuration || 0);
  const [currentTime, setCurrentTime] = useState<number>(startTime);
  const [playerInitialized, setPlayerInitialized] = useState<boolean>(false);
  const [videoLoaded, setVideoLoaded] = useState<boolean>(false);
  const [seekRequested, setSeekRequested] = useState<boolean>(false);
  const [lastSource, setLastSource] = useState<string>(videoSrc);
  const [lastStartTime, setLastStartTime] = useState<number>(startTime);
  
  // For debug logs
  const debugLog = (message: string, ...args: any[]) => {
    const now = new Date().toISOString().substring(11, 23);
    console.log(`[VideoPlayer ${now}] ${message}`, ...args);
  };

  // ========== INITIALIZATION AND CLEANUP ==========
  
  // Destroy player on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        debugLog("Cleaning up Plyr on unmount");
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

  // ========== HANDLING PROPS CHANGES ==========
  
  // Reset states when source changes
  useEffect(() => {
    if (videoSrc !== lastSource) {
      debugLog(`Video source changed from ${lastSource} to ${videoSrc}`);
      setLastSource(videoSrc);
      setVideoLoaded(false);
      setSeekRequested(false);
    }
  }, [videoSrc, lastSource]);
  
  // Update when startTime changes
  useEffect(() => {
    if (startTime !== lastStartTime) {
      debugLog(`Start time changed from ${lastStartTime} to ${startTime}`);
      setLastStartTime(startTime);
      setCurrentTime(startTime);
      setSeekRequested(true);
    }
  }, [startTime, lastStartTime]);
  
  // Handle duration changes
  useEffect(() => {
    if (externalDuration && externalDuration > 0) {
      debugLog(`External duration set to ${externalDuration}`);
      setVideoDuration(externalDuration);
      if (videoRef.current) {
        videoRef.current.setAttribute('duration', externalDuration.toString());
      }
    }
  }, [externalDuration]);

  // ========== VIDEO ELEMENT INTERACTIONS ==========
  
  // Set up video element ref
  const setVideoElement = useCallback((node: HTMLVideoElement | null) => {
    if (node !== videoRef.current) {
      debugLog("Video element reference changed");
      videoRef.current = node;
    }
  }, []);
  
  // Handle video metadata loaded
  useEffect(() => {
    if (!videoRef.current) return;
    
    const handleMetadataLoaded = () => {
      debugLog("Video metadata loaded");
      setVideoLoaded(true);
      
      if (!externalDuration && videoRef.current && isFinite(videoRef.current.duration)) {
        debugLog(`Setting duration from video: ${videoRef.current.duration}`);
        setVideoDuration(videoRef.current.duration);
      }
      
      // Don't seek here - we'll do it in a separate effect
    };
    
    videoRef.current.addEventListener('loadedmetadata', handleMetadataLoaded);
    return () => videoRef.current?.removeEventListener('loadedmetadata', handleMetadataLoaded);
  }, [externalDuration]);

  // ========== SEEKING LOGIC ==========
  
  // Perform seeking when video is ready or when seek is requested
  useEffect(() => {
    if (!videoRef.current || !videoLoaded) return;
    
    if (seekRequested || (videoLoaded && currentTime !== videoRef.current.currentTime)) {
      debugLog(`Performing seek to ${currentTime}`);
      
      try {
        // Try to seek both through the video element and Plyr if available
        videoRef.current.currentTime = currentTime;
        
        if (playerRef.current && playerInitialized) {
          playerRef.current.currentTime = currentTime;
        }
        
        setSeekRequested(false);
      } catch (err) {
        console.error("Error during seek:", err);
      }
    }
  }, [videoLoaded, seekRequested, currentTime, playerInitialized]);
  
  // Handle endTime boundary
  useEffect(() => {
    if (endTime && currentTime >= endTime) {
      debugLog(`Reached endTime (${currentTime} >= ${endTime}), seeking back to ${startTime}`);
      setCurrentTime(startTime);
      setSeekRequested(true);
    }
  }, [currentTime, endTime, startTime]);

  // ========== PLAYER INITIALIZATION ==========
  
  // Initialize Plyr once video is loaded
  useEffect(() => {
    if (!videoLoaded || playerInitialized || !videoRef.current) return;
    
    debugLog("Initializing Plyr");
    try {
      const player = new Plyr(videoRef.current, {
        controls: [
          'play-large', 'play', 'progress', 'current-time',
          'mute', 'volume', 'captions', 'settings', 'pip',
          'airplay', 'fullscreen'
        ]
      });
      
      playerRef.current = player;
      
      // Set up event listeners
      player.on('ready', () => {
        debugLog("Plyr ready");
        setPlayerInitialized(true);
        
        if (chapters.length > 0) {
          createChapterTrack(videoRef.current!);
        }
        
        // Seek to startTime
        setCurrentTime(startTime);
        setSeekRequested(true);
      });
      
      // Update time
      const handleTimeUpdate = () => {
        if (player && typeof player.currentTime === 'number') {
          setCurrentTime(player.currentTime);
        }
      };
      
      player.on('timeupdate', handleTimeUpdate);
      
      return () => {
        player.off('timeupdate', handleTimeUpdate);
      };
    } catch (err) {
      console.error("Error initializing Plyr:", err);
    }
  }, [videoLoaded, playerInitialized, chapters, startTime]);
  
  // Add a safety timer for time updates
  useEffect(() => {
    if (!videoLoaded) return;
    
    const timerId = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.currentTime === 'number' && !playerRef.current.paused) {
        setCurrentTime(playerRef.current.currentTime);
      } else if (videoRef.current && isFinite(videoRef.current.currentTime) && !videoRef.current.paused) {
        setCurrentTime(videoRef.current.currentTime);
      }
    }, 250);
    
    return () => clearInterval(timerId);
  }, [videoLoaded]);

  // ========== UTILITY FUNCTIONS ==========
  
  // Create chapter track
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
    
    // Remove any existing track elements
    videoElement.querySelectorAll('track').forEach(t => t.remove());
    videoElement.appendChild(track);
  };
  
  // Handle chapter seeking
  const handleSeek = (time: number) => {
    debugLog(`Manual seek requested to ${time}`);
    setCurrentTime(time);
    setSeekRequested(true);
  };
  
  // Format time for VTT
  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };
  
  // Format time for display
  const formatTimeHMS = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
  };
  
  // Handle video errors
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoElement = e.currentTarget;
    console.error("Video error:", e);
    console.error("Error code:", videoElement.error?.code, "Message:", videoElement.error?.message);
  };

  // ========== TIMELINE CALCULATIONS ==========
  
  // Process chapters to ensure they don't overlap
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
  
  // Calculate if timeline is trimmed
  const isTrimmed = (startTime > 0 || endTime !== undefined) && effectiveDurationFinal > 0;
  const timelineStart = startTime;
  const timelineEnd = endTime !== undefined ? endTime : effectiveDurationFinal;
  const timelineDuration = timelineEnd - timelineStart;
  
  // Calculate position percentage
  const getPercentage = (time: number) => {
    if (isTrimmed) {
      return ((time - timelineStart) / timelineDuration) * 100;
    }
    return (time / effectiveDurationFinal) * 100;
  };
  
  // Calculate progress bar width
  const getCustomProgressWidth = () => {
    if (!isTrimmed && startTime > 0 && endTime && currentTime >= startTime) {
      const progress = Math.min((currentTime - startTime) / (endTime - startTime), 1);
      return progress * (((endTime - startTime) / effectiveDurationFinal) * 100);
    }
    return isTrimmed && currentTime >= timelineStart
      ? Math.min(((currentTime - timelineStart) / timelineDuration) * 100, 100)
      : getPercentage(currentTime);
  };

  // ========== RENDER ==========
  
  return (
    <div className={`video-player-widget ${className}`}>
      <h2 className="text-xl font-semibold mb-2">{videoTitle}</h2>
      <p className="text-sm text-gray-500 mb-3">
        {isTrimmed 
          ? `Playing segment: ${formatTimeHMS(timelineStart)} - ${formatTimeHMS(timelineEnd)}`
          : 'Click on the colored timeline regions to jump to the beginning of each chapter.'}
      </p>
      <div className="flex flex-col">
        <div className="aspect-video">
          <video
            ref={setVideoElement}
            playsInline
            controls
            className="w-full h-full"
            onError={handleVideoError}
            crossOrigin="anonymous"
            preload="metadata"
            {...(effectiveDurationFinal > 0 ? { "data-duration": effectiveDurationFinal } : {})}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          >
            {videoSrc && <source src={videoSrc} type="video/mp4" key={videoSrc} />}
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
    </div>
  );
};

export default VideoPlayer;
