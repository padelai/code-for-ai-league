Video analyser
=

The brain of the service - a set of scripts to analyse video, capture palyer and ball movements, and calculate the metrics.
It uses mutliple fine-tuned models as well as various post-processing techniques.

This script receives tasks via the SQS queue, and stores processing results in the shared dynamodb table.
