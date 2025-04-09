// import { useEffect, useState } from 'react';
// import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from "@/utils/apiClient";

import { VideoUpload } from "@/components/common/VideoUpload";

export default function VideoUploadPage() {
  const handleUploadComplete = async (fileUrl: string) => {
    try {
      // Update user profile with the new video URL
      const response = await apiClient.fetch("/profile/update", {
        method: "POST",
        body: JSON.stringify({
          videoUrl: fileUrl,
        }),
      });

      if (!response.ok) throw new Error("Failed to update profile");
    } catch (error) {
      console.error("Failed to update profile:", error);
      throw error;
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Profile</h1>

      <p>Video Upload</p>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Upload Video</h2>
        <VideoUpload onUploadComplete={handleUploadComplete} />
      </div>
    </div>
  );
}
