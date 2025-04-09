import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/utils/apiClient";

interface ProfileData {
  email: string;
  displayName?: string;
}

interface RecordingDataEntry {
  media_id: string;
  tile: string;
  uploaded_at: Date;
}

interface RecordingsData {
  items: Array<RecordingDataEntry>;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  const [recordingsData, setRecordingsData] = useState<RecordingsData | null>(
    null,
  );

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await apiClient.fetch("/profile/me");
        const data = await response.json();

        console.log("Profile data: ", data);
        setProfileData(data);
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      }
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    const fetchRecordingsData = async () => {
      try {
        const response = await apiClient.fetch("/recordings");
        const data = await response.json();

        console.log("Recordings data: ", data);

        setRecordingsData(data);
      } catch (error) {
        console.error("Failed to fetch recordings: ", error);
      }
    };

    fetchRecordingsData();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Profile</h1>
      {user && (
        <div>
          <p>Email: {user.profile.email}</p>
          {/* Add more user info */}
        </div>
      )}
      {profileData && (
        <div className="mt-4">
          {profileData.displayName && (
            <p className="font-medium">
              Name:{" "}
              <span className="font-normal">{profileData.displayName}</span>
            </p>
          )}
        </div>
      )}
      {recordingsData && (
        <div className="mt-4">
          {recordingsData.items.map((recording: RecordingDataEntry) => (
            <div key={recording.media_id}>
              <p className="font-medium">
                Name: <span className="font-normal">{recording.tile}</span>
                Uploaded at:{" "}
                <span className="font-normal">
                  {recording.uploaded_at.toString()}
                </span>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
