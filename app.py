import os
import psycopg2
from typing import Union, Optional
from litestar import Controller, get, post
from pydantic import BaseModel


# ======= DB  ========


def get_connection():
    host = os.environ.get("HOST", default="localhost")
    port = os.environ.get("PORT", default=9091)
    pwd = os.environ.get("PASSWORD", default="PG PWD")
    user = os.environ.get("USER", default="PG USER")
    database = os.environ.get("DATABASE", default="Sentences")
    return psycopg2.connect(
        database=database, user=user, password=pwd, host=host, port=port
    )


# ======= API ========


class CreateSentenceDTO(BaseModel):
    sentence: str
    username: Optional[str] = None


class UniqueResponse(BaseModel):
    message: str


class NotUniqueResponse(BaseModel):
    message: str
    number_other_submissions: int


class CountResponse(BaseModel):
    count: int
    message: str


class ApiController(Controller):
    path = "/api"

    @post("/sentence")
    async def check_sentence(
        data: CreateSentenceDTO,
    ) -> Union[UniqueResponse, NotUniqueResponse]:
        pass

    @get("/count")
    async def check_count() -> CountResponse:
        pass
