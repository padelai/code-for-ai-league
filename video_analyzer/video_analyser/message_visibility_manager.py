import logging
import time
from threading import Event, Thread


class MessageVisibilityManager:
    def __init__(self, sqs_client, queue_url, receipt_handle, extend_seconds=120):
        self.sqs = sqs_client
        self.queue_url = queue_url
        self.receipt_handle = receipt_handle
        self.extend_seconds = extend_seconds
        self.should_stop = Event()
        self.extension_thread = None
        self.logger = logging.getLogger(__name__)

    def _extend_visibility(self):
        """Periodically extend the message visibility timeout"""
        sleep_time = self.extend_seconds / 2

        while not self.should_stop.is_set():
            try:
                self.sqs.change_message_visibility(
                    QueueUrl=self.queue_url, ReceiptHandle=self.receipt_handle, VisibilityTimeout=self.extend_seconds
                )
                self.logger.debug(f"Extended message visibility by {self.extend_seconds} seconds")
            except Exception as e:
                self.logger.error(f"Failed to extend message visibility: {str(e)}")
                break

            # Sleep until next extension, but check should_stop every second
            for _ in range(int(sleep_time)):
                if self.should_stop.is_set():
                    break
                time.sleep(1)

    def __enter__(self):
        """Start the visibility timeout extension thread"""
        self.extension_thread = Thread(target=self._extend_visibility)
        self.extension_thread.daemon = True
        self.extension_thread.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Stop the visibility timeout extension thread"""
        self.should_stop.set()
        if self.extension_thread:
            self.extension_thread.join()

        # Log any errors that occurred
        if exc_type:
            self.logger.error(f"Error during message processing: {exc_type.__name__}: {exc_val}")
        return False  # Let exceptions propagate
