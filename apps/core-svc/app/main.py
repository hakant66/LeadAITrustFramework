from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import ping_db
from .scorecard import router as scorecard_router
from .trends import router as trends_router   
from .projects import router as projects_router  
from .admin import router as admin_router 

app = FastAPI(title="LeadAI Core Service")

# CORS: allow local Next.js/React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/healthz")
def healthz():
    ok = ping_db()
    return {"status": "ok" if ok else "fail", "postgres": ok}

app.include_router(scorecard_router)
app.include_router(trends_router)    
app.include_router(projects_router)     
app.include_router(admin_router)  
