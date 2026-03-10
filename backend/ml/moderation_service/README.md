# Moderation Service (nd-khoa/vihsd-uit-visobert)

This is a small **FastAPI** service used by the Node backend to moderate post captions.

## Run locally

```bash
cd backend/ml/moderation_service
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\\Scripts\\activate

pip install -r requirements.txt

uvicorn app:app --host 0.0.0.0 --port 8001
```

## Endpoints

- `GET /health`
- `POST /predict` with JSON body:

```json
{ "text": "..." }
```

Response:

```json
{ "label": "clean|offensive|hate", "score": 0.87, "scores": {"clean": 0.1, "offensive": 0.87, "hate": 0.03} }
```
