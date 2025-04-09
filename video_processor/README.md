# Padel AI Video Processor

Re-encodes uploaded video files with fixed framerate and resolution to simplify the further processing.

Executed as an SQS Queue processor in AWS ECS service.

Takes a job from the inbound queue, processes the video, uploads the processed video to the destination S3 bucket, 
and sends a message to the Video Analyzer via the outbound sqs queue.

