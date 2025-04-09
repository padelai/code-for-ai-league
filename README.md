# Code for the AI League 


## Content:
- **Frontend**: an react application used to upload the videos, and visualise the processing results
- **API Service**: a backend app, REST API that provides account management and interaction with the frontend
- **Video Processor**: a script (ECS job), that re-encodes video in the more convenient format with stable resolution and framerate
- **Video Analyzer**: the "brain" of the project - another script that takes video, performs analysis and publishes the results

## General information:
- The application is implemented to be run in AWS, and heavily uses following AWS services:
  - Cognito for account management
  - DynamoDB to store the user profiles, processing results, etc
  - SQS for interaction of the parts of the service (api service and both video processing parts)
  - S3 and Cloudfront to store and distribute the video content
 
