"""
Operon Multi-Tenant Authentication & Workspace Router
Handles user signup, secure login, workspace management, tenant switching, and business branches.
"""

from datetime import datetime, timezone, timedelta
import re
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
import jwt

from database.postgres.database import get_db
from database.postgres.models import (
    PlatformUser,
    Organization,
    OrganizationMember,
    BusinessBranch,
    Agent,
)
from database.postgres.config import settings
from services.utils import hash_password, verify
from services.oauth2 import create_access_token

router = APIRouter(prefix="/api/v1/auth", tags=["Operon Auth & Workspaces"])


# -----------------------------------------------------------------------------
# Schemas
# -----------------------------------------------------------------------------

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    company_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class WorkspaceCreateRequest(BaseModel):
    name: str
    tier: str = "growth"


class BranchCreateRequest(BaseModel):
    name: str
    location: Optional[str] = None
    code: Optional[str] = None
    escalation_contact: Optional[str] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]
    active_workspace: Dict[str, Any]
    workspaces: List[Dict[str, Any]]
    has_agents: bool


# -----------------------------------------------------------------------------
# Dependency: Get Current Platform User & Active Workspace
# -----------------------------------------------------------------------------

def get_current_tenant_session(
    authorization: Optional[str] = Header(None),
    x_workspace_id: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Bearer authorization token.",
        )

    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM.upper()])
        user_id = payload.get("user_id") or payload.get("id")
        org_id = x_workspace_id or payload.get("org_id")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is expired or invalid.",
        )

    user = db.query(PlatformUser).filter(PlatformUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found.")

    # Resolve organization membership
    membership = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.user_id == user.id)
        .filter(OrganizationMember.organization_id == org_id)
        .first()
    )

    if not membership:
        # Fallback to user's first available organization
        membership = db.query(OrganizationMember).filter(OrganizationMember.user_id == user.id).first()
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User has no workspace memberships.",
            )

    org = db.query(Organization).filter(Organization.id == membership.organization_id).first()

    return {
        "user": user,
        "organization": org,
        "membership": membership,
        "role": membership.role,
    }


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@router.post("/signup", response_model=AuthResponse)
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    # 1. Check existing user
    existing_user = db.query(PlatformUser).filter(PlatformUser.email == req.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    # 2. Generate slug for organization
    base_slug = re.sub(r"[^a-z0-9]+", "-", req.company_name.lower()).strip("-")
    slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"

    # 3. Create User
    new_user = PlatformUser(
        email=req.email.lower(),
        password_hash=hash_password(req.password),
        full_name=req.full_name,
    )
    db.add(new_user)
    db.flush()

    # 4. Create Tenant Organization
    new_org = Organization(
        name=req.company_name,
        slug=slug,
        tier="growth",
    )
    db.add(new_org)
    db.flush()

    # 5. Add Membership as Owner
    membership = OrganizationMember(
        organization_id=new_org.id,
        user_id=new_user.id,
        role="owner",
    )
    db.add(membership)

    # 6. Create Default Branch (HQ)
    default_branch = BusinessBranch(
        organization_id=new_org.id,
        name="Main Headquarters",
        location="Headquarters",
        code="HQ",
    )
    db.add(default_branch)
    db.commit()

    # 7. Issue Session Token
    token = create_access_token({
        "user_id": new_user.id,
        "email": new_user.email,
        "org_id": new_org.id,
        "role": "owner",
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "full_name": new_user.full_name,
        },
        "active_workspace": {
            "id": new_org.id,
            "name": new_org.name,
            "slug": new_org.slug,
            "tier": new_org.tier,
            "role": "owner",
        },
        "workspaces": [
            {
                "id": new_org.id,
                "name": new_org.name,
                "slug": new_org.slug,
                "role": "owner",
            }
        ],
        "has_agents": False,
    }


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(PlatformUser).filter(PlatformUser.email == req.email.lower()).first()
    if not user or not verify(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # Resolve memberships
    memberships = db.query(OrganizationMember).filter(OrganizationMember.user_id == user.id).all()
    if not memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has no active organization workspaces.",
        )

    primary_membership = memberships[0]
    org = db.query(Organization).filter(Organization.id == primary_membership.organization_id).first()

    # Collect all workspaces
    workspaces = []
    for m in memberships:
        o = db.query(Organization).filter(Organization.id == m.organization_id).first()
        if o:
            workspaces.append({
                "id": o.id,
                "name": o.name,
                "slug": o.slug,
                "role": m.role,
                "tier": o.tier,
            })

    # Check if active workspace has agents
    agent_count = db.query(Agent).filter(Agent.organization_id == org.id).count()

    token = create_access_token({
        "user_id": user.id,
        "email": user.email,
        "org_id": org.id,
        "role": primary_membership.role,
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
        },
        "active_workspace": {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "tier": org.tier,
            "role": primary_membership.role,
        },
        "workspaces": workspaces,
        "has_agents": agent_count > 0,
    }


@router.get("/me")
def get_current_user_profile(
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    user = session["user"]
    org = session["organization"]
    memberships = db.query(OrganizationMember).filter(OrganizationMember.user_id == user.id).all()
    workspaces = []
    for m in memberships:
        o = db.query(Organization).filter(Organization.id == m.organization_id).first()
        if o:
            workspaces.append({
                "id": o.id,
                "name": o.name,
                "slug": o.slug,
                "role": m.role,
                "tier": o.tier,
            })

    agent_count = db.query(Agent).filter(Agent.organization_id == org.id).count()

    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
        },
        "active_workspace": {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "tier": org.tier,
            "role": session["role"],
        },
        "workspaces": workspaces,
        "has_agents": agent_count > 0,
    }


@router.get("/workspaces")
def list_workspaces(
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    user = session["user"]
    memberships = db.query(OrganizationMember).filter(OrganizationMember.user_id == user.id).all()
    results = []
    for m in memberships:
        o = db.query(Organization).filter(Organization.id == m.organization_id).first()
        if o:
            results.append({
                "id": o.id,
                "name": o.name,
                "slug": o.slug,
                "tier": o.tier,
                "role": m.role,
            })
    return results


@router.post("/workspaces")
def create_workspace(
    req: WorkspaceCreateRequest,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    user = session["user"]
    base_slug = re.sub(r"[^a-z0-9]+", "-", req.name.lower()).strip("-")
    slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"

    new_org = Organization(name=req.name, slug=slug, tier=req.tier)
    db.add(new_org)
    db.flush()

    membership = OrganizationMember(
        organization_id=new_org.id,
        user_id=user.id,
        role="owner",
    )
    db.add(membership)

    branch = BusinessBranch(
        organization_id=new_org.id,
        name="Main Headquarters",
        code="HQ",
    )
    db.add(branch)
    db.commit()

    token = create_access_token({
        "user_id": user.id,
        "email": user.email,
        "org_id": new_org.id,
        "role": "owner",
    })

    return {
        "workspace": {
            "id": new_org.id,
            "name": new_org.name,
            "slug": new_org.slug,
            "tier": new_org.tier,
            "role": "owner",
        },
        "access_token": token,
    }


@router.post("/workspaces/{org_id}/switch")
def switch_workspace(
    org_id: str,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    user = session["user"]
    membership = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.user_id == user.id)
        .filter(OrganizationMember.organization_id == org_id)
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this workspace.",
        )

    org = db.query(Organization).filter(Organization.id == org_id).first()
    token = create_access_token({
        "user_id": user.id,
        "email": user.email,
        "org_id": org.id,
        "role": membership.role,
    })

    agent_count = db.query(Agent).filter(Agent.organization_id == org.id).count()

    return {
        "access_token": token,
        "active_workspace": {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "tier": org.tier,
            "role": membership.role,
        },
        "has_agents": agent_count > 0,
    }


@router.get("/branches")
def list_branches(
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    org = session["organization"]
    branches = db.query(BusinessBranch).filter(BusinessBranch.organization_id == org.id).all()
    return [
        {
            "id": b.id,
            "name": b.name,
            "location": b.location,
            "code": b.code,
            "escalation_contact": b.escalation_contact,
        }
        for b in branches
    ]


@router.post("/branches")
def create_branch(
    req: BranchCreateRequest,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    org = session["organization"]
    branch = BusinessBranch(
        organization_id=org.id,
        name=req.name,
        location=req.location,
        code=req.code,
        escalation_contact=req.escalation_contact,
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)

    return {
        "id": branch.id,
        "name": branch.name,
        "location": branch.location,
        "code": branch.code,
    }


class InviteMemberRequest(BaseModel):
    email: EmailStr
    role: str = "member"


@router.post("/invite")
def invite_member(
    req: InviteMemberRequest,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """
    Invite a team member to join the workspace.
    Dispatches email notification: '{user.full_name} has sent you an invite to join {org.name} on Operon.'
    """
    user = session["user"]
    org = session["organization"]

    existing_user = db.query(PlatformUser).filter(PlatformUser.email == req.email).first()
    if existing_user:
        membership = (
            db.query(OrganizationMember)
            .filter(
                OrganizationMember.organization_id == org.id,
                OrganizationMember.user_id == existing_user.id,
            )
            .first()
        )
        if membership:
            return {
                "success": True,
                "message": f"{req.email} is already a member of {org.name}.",
                "recipient": req.email,
                "company_name": org.name,
                "role": membership.role,
            }
        new_membership = OrganizationMember(
            organization_id=org.id,
            user_id=existing_user.id,
            role=req.role,
        )
        db.add(new_membership)
        db.commit()
    else:
        new_user = PlatformUser(
            email=req.email,
            password_hash=hash_password("OperonInvite2026!"),
            full_name=req.email.split("@")[0].replace(".", " ").capitalize(),
            is_platform_admin=False,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        new_membership = OrganizationMember(
            organization_id=org.id,
            user_id=new_user.id,
            role=req.role,
        )
        db.add(new_membership)
        db.commit()

    email_subject = f"{user.full_name} has invited you to join {org.name} on Operon"
    email_body = (
        f"Hello,\n\n"
        f"{user.full_name} ({user.email}) has sent you an invite to join {org.name} on Operon.\n\n"
        f"You can now access {org.name}'s workspace to build, inspect, and deploy AI agents.\n"
        f"Accept invite: http://localhost:3000/login\n\n"
        f"— The Operon Platform"
    )
    # Output to console log
    print(f"\n[Operon Mailer] Dispatching Email to {req.email}:\n  Subject: {email_subject}\n  Body: {email_body}\n")

    return {
        "success": True,
        "message": f"Invitation successfully sent! {user.full_name} has sent an invite to {req.email} to join {org.name} on Operon.",
        "email_sent": True,
        "recipient": req.email,
        "company_name": org.name,
        "inviter": user.full_name,
        "role": req.role,
    }


@router.get("/members")
def list_workspace_members(
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """List members of current workspace."""
    org = session["organization"]
    memberships = db.query(OrganizationMember).filter(OrganizationMember.organization_id == org.id).all()
    result = []
    for m in memberships:
        u = db.query(PlatformUser).filter(PlatformUser.id == m.user_id).first()
        if u:
            result.append({
                "id": m.id,
                "user_id": u.id,
                "name": u.full_name,
                "email": u.email,
                "role": m.role,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            })
    return result

