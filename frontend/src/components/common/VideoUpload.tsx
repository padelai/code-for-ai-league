// components/VideoUpload.tsx
import { useState, useRef } from "react";
import { Video, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

import { apiClient } from "@/utils/apiClient";

interface VideoUploadProps {
  onUploadComplete?: (fileUrl: string) => void;
  maxSize?: number; // in bytes
}

interface PresignedPostResponse {
  uploadUrl: string;
  fileKey: string;
}

export function VideoUpload({
  onUploadComplete,
  maxSize = 512 * 1024 * 1024,
}: VideoUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const allowedTypes = ["video/mp4", "video/quicktime", "video/x-msvideo"];

  const getPresignedUrl = async (file: File) => {
    const response = await apiClient.fetch("/videos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to get upload URL");
    }

    return response.json() as Promise<PresignedPostResponse>;
  };

  const uploadToS3 = async (
    presignedData: PresignedPostResponse,
    file: File,
  ) => {
    try {
      const response = await fetch(presignedData.uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      return presignedData.fileKey;
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    }
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!allowedTypes.includes(file.type)) {
      setError(`Invalid file type. Allowed types: MP4, MOV, AVI`);
      return;
    }

    // Validate file size
    if (file.size > maxSize) {
      setError(`File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`);
      return;
    }

    // Create preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const presignedData = await getPresignedUrl(file);
      const fileKey = await uploadToS3(presignedData, file);

      if (!fileKey) {
        throw new Error("Failed to get file key after upload");
      }

      // Use the fileKey from the successful upload
      onUploadComplete?.(fileKey);
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload video. Please try again.");
      // Clean up preview on error
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      const input = document.createElement("input");
      input.files = event.dataTransfer.files;
      handleFileSelect({ target: input } as any);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <div className="space-y-4">
      <div
        className="flex flex-col items-center justify-center w-full"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {previewUrl ? (
          <div className="w-full max-w-2xl">
            <video
              ref={videoRef}
              src={previewUrl}
              controls
              className="w-full rounded-lg"
            />
            {!isUploading && (
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => {
                  setPreviewUrl(null);
                  URL.revokeObjectURL(previewUrl);
                }}
              >
                Remove video
              </Button>
            )}
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {isUploading ? (
                <Loader2 className="w-8 h-8 mb-2 text-gray-500 animate-spin" />
              ) : (
                <Video className="w-8 h-8 mb-2 text-gray-500" />
              )}
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload</span> or drag
                and drop
              </p>
              <p className="text-xs text-gray-500">
                MP4, MOV, or AVI (max {maxSize / (1024 * 1024)}MB)
              </p>
            </div>
            <input
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              accept={allowedTypes.join(",")}
              disabled={isUploading}
            />
          </label>
        )}
      </div>

      {isUploading && (
        <div className="space-y-2">
          <Progress value={uploadProgress} />
          <p className="text-sm text-gray-500 text-center">
            Uploading... {uploadProgress}%
          </p>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
