import time
from typing import Any

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel, to_snake


class CamelModel(BaseModel):
    model_config = ConfigDict(extra="ignore", alias_generator=to_camel, populate_by_name=True)

    def model_dump(self, **kwargs) -> dict[str, Any]:
        kwargs["by_alias"] = True
        return super().model_dump(**kwargs)

    @classmethod
    def model_validate(cls, obj: Any, **kwargs) -> Any:
        if isinstance(obj, dict):
            converted_dict = {to_snake(k): v for k, v in obj.items()}
            return super().model_validate(converted_dict, **kwargs)
        return super().model_validate(obj, **kwargs)


class Measure:
    def __init__(self, operation_name):
        self.operation_name = operation_name

    def __enter__(self):
        self.start_time = time.time()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        elapsed_time = (time.time() - self.start_time) * 1000  # Convert to milliseconds
        print(f"{self.operation_name} -> {elapsed_time:.2f}ms")
