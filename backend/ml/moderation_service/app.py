import os
from typing import Dict, Any

from fastapi import FastAPI
from pydantic import BaseModel

from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch


MODEL_NAME = os.getenv("MODERATION_MODEL", "nd-khoa/vihsd-uit-visobert")


class PredictRequest(BaseModel):
    text: str


app = FastAPI(title="SocialApp Moderation Service")


@app.on_event("startup")
def _load_model() -> None:
    # Load once at startup
    global tokenizer, model, id2label

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
    model.eval()

    cfg = getattr(model, "config", None)
    id2label = getattr(cfg, "id2label", None) or {}


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"ok": True, "model": MODEL_NAME}


@app.post("/predict")
def predict(req: PredictRequest) -> Dict[str, Any]:
    text = (req.text or "").strip()

    if not text:
        return {"label": "clean", "score": 1.0, "scores": {"clean": 1.0}}

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=256,
        padding=True,
    )

    with torch.no_grad():
        logits = model(**inputs).logits
        probs = torch.softmax(logits, dim=-1).squeeze(0)

    # Build score dict
    scores: Dict[str, float] = {}
    for idx, p in enumerate(probs.tolist()):
        label = id2label.get(idx, str(idx))
        scores[str(label).lower()] = float(p)

    # Pick top
    best_label = max(scores.items(), key=lambda kv: kv[1])[0]
    best_score = scores[best_label]

    return {"label": best_label, "score": best_score, "scores": scores}
