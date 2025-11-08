# --- Config ---
$OLLAMA = "http://localhost:11434"
$QDRANT = "http://localhost:6333"
$COLL   = "test_ollama"
$MODEL  = "nomic-embed-text"   # ensure: ollama pull nomic-embed-text

# --- 1) Get an embedding from Ollama ---
$embedReq = @{ model = $MODEL; prompt = "hello" } | ConvertTo-Json
$res = Invoke-RestMethod -Method Post -Uri "$OLLAMA/api/embeddings" -ContentType application/json -Body $embedReq
$vec = $res.embedding
$dim = $vec.Count
"Embedding dim: $dim"

# --- 2) Create (or recreate) a collection with correct size ---
# (Comment out the DELETE if you prefer to keep an existing collection)
try { Invoke-RestMethod -Method Delete -Uri "$QDRANT/collections/$COLL" | Out-Null } catch {}
$createBody = @{ vectors = @{ size = $dim; distance = "Cosine" } } | ConvertTo-Json
Invoke-RestMethod -Method PUT -Uri "$QDRANT/collections/$COLL" -ContentType application/json -Body $createBody | Out-Null
"Collection '$COLL' ready."

# --- 3) Upsert a point ---
$points = @{
  points = @(@{
    id = 1
    vector = $vec
    payload = @{ text = "hello" }
  })
} | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method PUT -Uri "$QDRANT/collections/$COLL/points" -ContentType application/json -Body $points | Out-Null
"Inserted 1 point."

# --- 4) Search with a new query embedding ---
$qReq = @{ model = $MODEL; prompt = "hi there" } | ConvertTo-Json
$q = Invoke-RestMethod -Method Post -Uri "$OLLAMA/api/embeddings" -ContentType application/json -Body $qReq

$search = @{
  vector = $q.embedding
  limit = 3
  with_payload = $true
} | ConvertTo-Json -Depth 6

$result = Invoke-RestMethod -Method Post -Uri "$QDRANT/collections/$COLL/points/search" -ContentType application/json -Body $search
$result
