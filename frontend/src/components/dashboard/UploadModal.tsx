import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VideoUpload } from "@/components/common/VideoUpload";

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function UploadModal({
  open,
  onOpenChange,
  // onSuccess,
}: UploadModalProps) {
  // const [title, setTitle] = useState("");
  // const [file, setFile] = useState<File | null>(null);
  // const [isUploading, setIsUploading] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload New Video</DialogTitle>
        </DialogHeader>
        <VideoUpload
        //onUploadComplete={handleUploadComplete}
        />
      </DialogContent>
    </Dialog>
  );
}
