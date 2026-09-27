import warnings
from io import BytesIO

from PIL import Image, UnidentifiedImageError

from app.repositories.master_data import DataError

MAX_BYTES = 5_000_000
MAX_PIXELS = 20_000_000


def validate_image(data: bytes, mime: str):
    if not data or len(data) > MAX_BYTES:
        raise DataError(422, "INVALID_IMAGE", "Image exceeds the upload limit.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                if image.format != {"image/png": "PNG", "image/jpeg": "JPEG"}.get(mime):
                    raise ValueError("format")
                if image.width * image.height > MAX_PIXELS or getattr(image, "n_frames", 1) != 1:
                    raise ValueError("dimensions")
                image.verify()
            with Image.open(BytesIO(data)) as image:
                image.load()
    except (
        ValueError,
        OSError,
        UnidentifiedImageError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise DataError(
            422, "INVALID_IMAGE", "Use one valid PNG/JPEG up to 20 megapixels."
        ) from None
