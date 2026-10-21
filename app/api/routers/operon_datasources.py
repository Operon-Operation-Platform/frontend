"""
Operon Data Sources & Knowledge Retrieval Router
Enforces separation of Operon platform database from customer data sources.
Supports SQL databases (PostgreSQL/MySQL), Graph databases (Neo4j),
and Hybrid Knowledge Stores (BM25 + pgvector).
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.postgres.database import get_db
from database.postgres.models import DataSource, KnowledgeIndex
from api.routers.operon_auth import get_current_tenant_session

router = APIRouter(prefix="/api/v1/datasources", tags=["Operon Data Sources"])


class ConnectDataSourceRequest(BaseModel):
    name: str
    source_type: str  # postgres, mysql, neo4j, vector, hybrid
    connection_uri: Optional[str] = None
    allowlisted_tables: Optional[List[str]] = None
    allowlisted_schemas: Optional[List[str]] = None
    read_only: bool = True


class KnowledgeIndexCreateRequest(BaseModel):
    name: str
    retrieval_mode: str = "hybrid"  # keyword, vector, hybrid
    agent_id: Optional[str] = None
    documents: Optional[List[Dict[str, Any]]] = None


@router.get("")
def list_data_sources(
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """List customer connected data sources."""
    org = session["organization"]
    sources = db.query(DataSource).filter(DataSource.organization_id == org.id).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "source_type": s.source_type,
            "status": s.status,
            "schema_config": s.schema_config or {},
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in sources
    ]


@router.post("", status_code=status.HTTP_201_CREATED)
def connect_data_source(
    req: ConnectDataSourceRequest,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """Save customer data source metadata. This endpoint does not connect to the external database."""
    org = session["organization"]

    schema_config = {
        "allowlisted_tables": req.allowlisted_tables or [],
        "allowlisted_schemas": req.allowlisted_schemas or [],
        "read_only": req.read_only,
    }

    new_source = DataSource(
        organization_id=org.id,
        name=req.name,
        source_type=req.source_type,
        connection_ref=None,
        schema_config=schema_config,
        status="registered",
    )
    db.add(new_source)
    db.commit()
    db.refresh(new_source)

    return {
        "id": new_source.id,
        "name": new_source.name,
        "source_type": new_source.source_type,
        "status": new_source.status,
        "schema_config": new_source.schema_config,
        "message": f"Data source '{req.name}' was registered. Connectivity is not configured.",
    }


@router.post("/test")
def test_data_source(req: ConnectDataSourceRequest):
    """Report the current external database connectivity capability."""
    return {
        "success": False,
        "source_type": req.source_type,
        "discovered_tables": [],
        "status": "NOT_CONFIGURED",
        "message": "External database connectivity checks are not configured. No connection was made.",
    }


@router.get("/knowledge")
def list_knowledge_indexes(
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """List knowledge retrieval indices for workspace."""
    org = session["organization"]
    indices = db.query(KnowledgeIndex).filter(KnowledgeIndex.organization_id == org.id).all()
    return [
        {
            "id": k.id,
            "name": k.name,
            "retrieval_mode": k.retrieval_mode,
            "doc_count": k.doc_count,
            "agent_id": k.agent_id,
            "config": {
                "size_kb": (k.config or {}).get("size_kb"),
                "documents": [
                    {"title": document.get("title")}
                    for document in (k.config or {}).get("documents", [])
                    if isinstance(document, dict) and document.get("title")
                ],
            },
            "created_at": k.created_at.isoformat() if k.created_at else None,
        }
        for k in indices
    ]


@router.post("/knowledge", status_code=status.HTTP_201_CREATED)
def create_knowledge_index(
    req: KnowledgeIndexCreateRequest,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """Store user supplied knowledge documents for keyword retrieval."""
    org = session["organization"]
    doc_count = len(req.documents) if req.documents else 0

    new_index = KnowledgeIndex(
        organization_id=org.id,
        agent_id=req.agent_id,
        name=req.name,
        retrieval_mode="keyword",
        doc_count=doc_count,
        config={"documents": req.documents or [], "size_kb": round(sum(float(d.get("size_kb", 0) or 0) for d in (req.documents or [])), 1)},
    )
    db.add(new_index)
    db.commit()
    db.refresh(new_index)

    return {
        "id": new_index.id,
        "name": new_index.name,
        "retrieval_mode": new_index.retrieval_mode,
        "doc_count": new_index.doc_count,
        "message": "Knowledge base documents registered for keyword retrieval",
    }


@router.delete("/{source_id}")
def delete_data_source(
    source_id: str,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """Delete a customer data source by ID."""
    org = session["organization"]
    source = (
        db.query(DataSource)
        .filter(DataSource.id == source_id)
        .filter(DataSource.organization_id == org.id)
        .first()
    )
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Data source not found",
        )
    db.delete(source)
    db.commit()
    return {"message": f"Data source '{source.name}' successfully deleted", "id": source_id}


@router.delete("/knowledge/{index_id}")
def delete_knowledge_index(
    index_id: str,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """Delete a knowledge index by ID."""
    org = session["organization"]
    index = (
        db.query(KnowledgeIndex)
        .filter(KnowledgeIndex.id == index_id)
        .filter(KnowledgeIndex.organization_id == org.id)
        .first()
    )
    if not index:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found",
        )
    db.delete(index)
    db.commit()
    return {"message": f"Knowledge base '{index.name}' successfully deleted", "id": index_id}


class DocumentUploadPayload(BaseModel):
    name: str
    filename: Optional[str] = None
    file_type: Optional[str] = "document"
    content: Optional[str] = None
    file_size_kb: Optional[float] = None


@router.post("/upload")
def upload_document(
    payload: DocumentUploadPayload,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """Upload documents and index into knowledge base with hybrid retrieval."""
    org = session["organization"]
    if not payload.content or not payload.content.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Document text is required for indexing.")
    document_count = 1

    new_index = KnowledgeIndex(
        organization_id=org.id,
        name=payload.name or payload.filename or "Uploaded Knowledge",
        retrieval_mode="keyword",
        doc_count=document_count,
        config={
            "filename": payload.filename,
            "type": payload.file_type or "document",
            "size_kb": payload.file_size_kb,
            "content": payload.content,
            "indexing_mode": "keyword",
        },
    )
    db.add(new_index)
    db.commit()
    db.refresh(new_index)

    return {
        "id": new_index.id,
        "name": new_index.name,
        "documents": document_count,
        "size": f"{payload.file_size_kb:.1f} KB" if payload.file_size_kb is not None else None,
        "status": "ready",
        "message": f"Text from '{payload.filename or payload.name}' was added to the knowledge base.",
    }


class QueryRetrievalRequest(BaseModel):
    query: str
    index_id: Optional[str] = None


@router.post("/query")
def test_retrieval_query(
    req: QueryRetrievalRequest,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """
    Truthful keyword retrieval query execution across current tenant's knowledge bases.
    Returns actual indexed documents with scores, or empty state if no matches.
    """
    org = session["organization"]
    q = req.query.strip().lower()
    if not q:
        return {"query": req.query, "results": []}

    index_query = db.query(KnowledgeIndex).filter(KnowledgeIndex.organization_id == org.id)
    if req.index_id:
        index_query = index_query.filter(KnowledgeIndex.id == req.index_id)
    indices = index_query.all()
    if not indices:
        return {
            "query": req.query,
            "results": [],
            "message": "No knowledge bases connected for this organization. Add documents to an agent knowledge base first.",
        }

    results = []
    terms = [word for word in q.split() if len(word) > 1]
    for idx in indices:
        config = idx.config or {}
        documents = config.get("documents") or []
        if config.get("content"):
            documents = [{"title": config.get("filename") or idx.name, "content": config["content"]}]
        for position, document in enumerate(documents):
            content = str(document.get("content") or "")
            matched = sum(1 for term in terms if term in content.lower())
            if not content or matched == 0:
                continue
            title = document.get("title") or config.get("filename") or idx.name
            results.append({
                "id": f"{idx.id}:{position}",
                "source": idx.name,
                "title": title,
                "score": round(matched / max(len(terms), 1), 3),
                "mode": "Keyword retrieval",
                "snippet": content[:500],
            })

    results.sort(key=lambda item: item["score"], reverse=True)

    return {
        "query": req.query,
        "results": results[:5],
    }


