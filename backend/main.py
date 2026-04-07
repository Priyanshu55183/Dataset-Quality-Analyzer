from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Dataset EDA API")

from routers.datasets import router as datasets_router
from routers.chat import router as chat_router
from routers.export import router as export_router
from routers.recommendations import router as recommendations_router

app.include_router(datasets_router)
app.include_router(chat_router)
app.include_router(export_router)
app.include_router(recommendations_router)

# 🔌 CORS: Allows your Next.js frontend to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGIN", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Backend is alive & connected to Next.js"}

# Run with: uvicorn main:app --reload


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, loop="asyncio")