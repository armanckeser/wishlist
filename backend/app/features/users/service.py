"""User service for database operations."""

from typing import Any

from sqlmodel import Session, select

from app.core.security import get_password_hash
from app.features.users.models import User, UserCreate, UserUpdate


def create_user(session: Session, user_create: UserCreate) -> User:
    """Create a new user in the database."""
    db_obj = User.model_validate(
        user_create, update={"hashed_password": get_password_hash(user_create.password)}
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_user(session: Session, db_user: User, user_in: UserUpdate) -> Any:
    """Update an existing user."""
    user_data = user_in.model_dump(exclude_unset=True)
    extra_data: dict[str, str] = {}
    if "password" in user_data:
        password = user_data["password"]
        hashed_password = get_password_hash(password)
        extra_data["hashed_password"] = hashed_password
    db_user.sqlmodel_update(user_data, update=extra_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def get_user_by_email(session: Session, email: str) -> User | None:
    """Find a user by email address."""
    statement = select(User).where(User.email == email)
    return session.exec(statement).first()
