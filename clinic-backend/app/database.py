import ssl
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

def _make_ssl_ctx():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx

_connect_args: dict = {"prepared_statement_cache_size": 0}  # required for PgBouncer transaction mode
if settings.DATABASE_SSL:
    _connect_args["ssl"] = _make_ssl_ctx()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=False,   # skip health-check ping — wastes a round-trip per checkout
    pool_size=5,           # PgBouncer manages the real pool; keep SQLAlchemy side small
    max_overflow=5,
    pool_timeout=30,
    pool_recycle=1800,     # recycle connections every 30 min to avoid stale TLS sessions
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
