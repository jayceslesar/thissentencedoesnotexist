import os
import psycopg2
from typing import Union, Optional, cast
from sqlachemy.ext.asyncio import AsyncEngine, create_async_engine
from litestar import Controller, get, post, Litestar, Request
from pydantic import BaseModel
from datetime import datetime, timezone

# ======= DB  ========

INIT_DB = """create table if not exists sentences(sentence text PRIMARY KEY, username text, awarded timestamp NOT NULL, count bigint NOT NULL);"""

CREATE_SENTENCE = """insert into sentences VALUES(%s, %s, %s, %s);"""

UPDATE_SENTENCE_COUNT = (
    """update sentences set count = count + 1 where sentence = %s;"""
)

GET_SENTENCE_COUNT = """select count from sentence where sentence = %s;"""

GET_SUBMISSION_COUNT = """select SUM(count) from sentences;"""

COUNT_UNIQUE_SENTENCES = """select COUNT(*) from sentences;"""

host = os.environ.get("HOST", default="localhost")
port = os.environ.get("PORT", default=9091)
pwd = os.environ.get("PASSWORD", default="PG PWD")
user = os.environ.get("USER", default="PG USER")
database = os.environ.get("DATABASE", default="Sentences")
db_uri = f"postgresql+asyncpg://{user}:{pwd}@{host}:{port}/db"


async def get_connection(app: Litestar):
    if not getattr(app.state, "engine", None):
        app.state.engine = create_async_engine(db_uri)
        async with app.state.engine.begin() as conn:
            conn.execute(INIT_DB)

    return cast("AsyncEngine", app.state.engine)


async def close_connection(app: Litestar) -> None:
    if getattr(app.state, "engine", None):
        await cast("AsyncEngine", app.state.engine).dispose()


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


class SentenceCountResponse(BaseModel):
    count: int


class SubmissionCount(BaseModel):
    count: int


def select_positive_message():
    pass


def select_negative_message():
    pass


class ApiController(Controller):
    path = "/api"

    @post("/sentence")
    async def check_sentence(
        request: Request,
        data: CreateSentenceDTO,
    ) -> Union[UniqueResponse, NotUniqueResponse]:
        engine = request.app.state.engine
        async with engine.connect() as conn:
            try:
                conn.execute(
                    CREATE_SENTENCE, (data.sentence, data.username, datetime.now(), 1)
                )
                conn.commit()
                return UniqueResponse(message=select_positive_message())
            except psycopg2.IntegrityError:
                cursor = conn.cursor()
                conn.execute(
                    GET_SENTENCE_COUNT,
                    (data.sentence,),
                )
                conn.commit()
                sentence_count = cursor.fetchone()[0]
                conn.execute(
                    UPDATE_SENTENCE_COUNT,
                    (data.sentence,),
                )
                conn.commit()
                return NotUniqueResponse(
                    message=select_negative_message(),
                    number_other_submissions=sentence_count,
                )

    @get("/sentence-count")
    async def check_sentence_count(request: Request) -> CountResponse:
        engine = request.app.state.engine
        async with engine.connect() as conn:
            conn.execute(COUNT_UNIQUE_SENTENCES)
            cursor = conn.cursor()
            conn.commit()
            sentences_count = cursor.fetchone()[0]
        return SentenceCountResponse(count=sentences_count)

    @get("/submission-count")
    async def check_submission_count(request: Request) -> CountResponse:
        engine = request.app.state.engine
        async with engine.connect() as conn:
            conn.execute(GET_SUBMISSION_COUNT)
            cursor = conn.cursor()
            conn.commit()
            submission_count = cursor.fetchone()[0]
        return SubmissionCount(count=submission_count)


app = Litestar(
    on_startup=[get_connection],
    on_shutdown=[close_connection],
    route_handlers=[ApiController],
)
