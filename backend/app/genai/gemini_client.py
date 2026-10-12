import os
import time

from dotenv import load_dotenv
from google import genai
from google.genai import types


# Load variables from .env relative to backend root
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
load_dotenv(dotenv_path=env_path)
load_dotenv()

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

class GeminiClientError(Exception):
    """Error raised when Gemini API fails."""
    pass

def _get_client():
    key = os.getenv("GEMINI_API_KEY")
    if not key or key == "your_gemini_api_key_here":
        raise GeminiClientError("GEMINI_API_KEY is not set or configured in .env file.")
    return genai.Client(api_key=key)


def generate_response(
    prompt: str,
    temperature: float = 0.2,
    max_retries: int = 3
) -> str:
    """
    Send a prompt to Gemini and return the response.
    """

    config = types.GenerateContentConfig(
        temperature=temperature
    )

    last_error = None

    for attempt in range(1, max_retries + 1):

        try:

            print(
                f"[Gemini] Attempt "
                f"{attempt}/{max_retries}"
            )

            client = _get_client()
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=config
            )

            if not response.text:
                raise GeminiClientError(
                    "Gemini returned an empty response."
                )

            return response.text

        except Exception as error:

            last_error = error

            print(
                f"[Gemini] Error: {error}"
            )

            if attempt < max_retries:

                wait_time = 2 ** (attempt - 1)

                print(
                    f"Retrying in "
                    f"{wait_time} seconds..."
                )

                time.sleep(wait_time)

    raise GeminiClientError(
        f"Gemini API failed after "
        f"{max_retries} attempts. "
        f"Last error: {last_error}"
    )

def generate_with_tools(
    prompt: str,
    tool
):
    """
    Send a prompt to Gemini with finance tools available.
    """

    config = types.GenerateContentConfig(
        temperature=0.2,
        tools=[tool]
    )

    client = _get_client()
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=config
    )

    return response

get_completion = generate_response