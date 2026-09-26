"""Tests for the wishlist sharing system - Community themed!"""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.features.users.models import User, UserCreate, WishlistVisibility
from app.features.users.service import create_user, get_user_by_email
from app.features.wishlist_item.models import WishlistItemCreate
from app.features.wishlist_item.service import create_wishlist_item
from app.features.wishlist_share.service import create_share


def get_superuser(db: Session) -> User:
    """Get or create the superuser (Jeff Winger) from the database."""
    user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
    if user:
        return user
    user_in = UserCreate(
        email=settings.FIRST_SUPERUSER,
        password=settings.FIRST_SUPERUSER_PASSWORD,
        is_superuser=True,
    )
    return create_user(session=db, user_create=user_in)


def create_test_user(db: Session, email: str, full_name: str) -> User:
    """Create a test user if they don't exist."""
    existing = get_user_by_email(session=db, email=email)
    if existing:
        return existing
    user_create = UserCreate(
        email=email,
        password="sixseasonsandamovie",
        full_name=full_name,
    )
    return create_user(session=db, user_create=user_create)


class TestWishlistShareEndpoints:
    """Test suite for the Greendale Study Group wishlist sharing."""

    def test_create_share_success(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Jeff shares his wishlist with Annie."""
        # Create Annie
        annie = create_test_user(db, "annie.edison@greendale.edu", "Annie Edison")

        response = client.post(
            f"{settings.API_V1_STR}/shares/",
            headers=superuser_token_headers,
            json={"shared_with_email": annie.email},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["shared_with_id"] == str(annie.id)
        assert "created_at" in content

    def test_create_share_user_not_found(
        self, client: TestClient, superuser_token_headers: dict[str, str]
    ) -> None:
        """Can't share with someone who doesn't exist (like Luis Guzman's character)."""
        response = client.post(
            f"{settings.API_V1_STR}/shares/",
            headers=superuser_token_headers,
            json={"shared_with_email": "fake.luis@greendale.edu"},
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_create_share_with_self(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Jeff can't share with himself - even his ego isn't that big."""
        superuser = get_superuser(db)

        response = client.post(
            f"{settings.API_V1_STR}/shares/",
            headers=superuser_token_headers,
            json={"shared_with_email": superuser.email},
        )

        assert response.status_code == 400
        assert "yourself" in response.json()["detail"].lower()

    def test_create_share_duplicate(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Can't share twice with the same person - one episode about sharing is enough."""
        britta = create_test_user(db, "britta.perry@greendale.edu", "Britta Perry")

        # First share
        client.post(
            f"{settings.API_V1_STR}/shares/",
            headers=superuser_token_headers,
            json={"shared_with_email": britta.email},
        )

        # Duplicate share
        response = client.post(
            f"{settings.API_V1_STR}/shares/",
            headers=superuser_token_headers,
            json={"shared_with_email": britta.email},
        )

        assert response.status_code == 409
        assert "already shared" in response.json()["detail"].lower()

    def test_list_my_shares(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Jeff can see all his study group members he's shared with."""
        # Create Troy and share
        troy = create_test_user(db, "troy.barnes@greendale.edu", "Troy Barnes")
        client.post(
            f"{settings.API_V1_STR}/shares/",
            headers=superuser_token_headers,
            json={"shared_with_email": troy.email},
        )

        response = client.get(
            f"{settings.API_V1_STR}/shares/",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        content = response.json()
        assert "data" in content
        assert "count" in content
        # Should have at least Troy
        shared_with_ids = [share["shared_with_id"] for share in content["data"]]
        assert str(troy.id) in shared_with_ids

    def test_list_shares_with_me(self, client: TestClient, db: Session) -> None:
        """Abed can see wishlists shared with him."""
        # Create Abed and get his token
        abed = create_test_user(db, "abed.nadir@greendale.edu", "Abed Nadir")
        login_response = client.post(
            f"{settings.API_V1_STR}/login/access-token",
            data={"username": abed.email, "password": "sixseasonsandamovie"},
        )
        abed_token = login_response.json()["access_token"]
        abed_headers = {"Authorization": f"Bearer {abed_token}"}

        response = client.get(
            f"{settings.API_V1_STR}/shares/with-me",
            headers=abed_headers,
        )

        assert response.status_code == 200
        content = response.json()
        assert "data" in content
        assert "count" in content

    def test_revoke_share(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Jeff can revoke sharing with Pierce (he'd understand why)."""
        pierce = create_test_user(
            db, "pierce.hawthorne@greendale.edu", "Pierce Hawthorne"
        )

        # Create share
        create_response = client.post(
            f"{settings.API_V1_STR}/shares/",
            headers=superuser_token_headers,
            json={"shared_with_email": pierce.email},
        )
        share_id = create_response.json()["id"]

        # Revoke it
        response = client.delete(
            f"{settings.API_V1_STR}/shares/{share_id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        assert "revoked" in response.json()["message"].lower()

        # Verify it's gone
        list_response = client.get(
            f"{settings.API_V1_STR}/shares/",
            headers=superuser_token_headers,
        )
        share_ids = [share["id"] for share in list_response.json()["data"]]
        assert share_id not in share_ids

    def test_revoke_nonexistent_share(
        self, client: TestClient, superuser_token_headers: dict[str, str]
    ) -> None:
        """Can't revoke a share that doesn't exist - streets behind."""
        fake_id = str(uuid.uuid4())

        response = client.delete(
            f"{settings.API_V1_STR}/shares/{fake_id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 404

    def test_revoke_other_users_share(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Shirley creates a share, Jeff can't revoke it - that's not Christian."""
        # Create Shirley and her share target
        shirley = create_test_user(
            db, "shirley.bennett@greendale.edu", "Shirley Bennett"
        )
        andre = create_test_user(db, "andre.bennett@greendale.edu", "Andre Bennett")

        # Login as Shirley
        login_response = client.post(
            f"{settings.API_V1_STR}/login/access-token",
            data={"username": shirley.email, "password": "sixseasonsandamovie"},
        )
        shirley_token = login_response.json()["access_token"]
        shirley_headers = {"Authorization": f"Bearer {shirley_token}"}

        # Shirley creates a share
        create_response = client.post(
            f"{settings.API_V1_STR}/shares/",
            headers=shirley_headers,
            json={"shared_with_email": andre.email},
        )
        share_id = create_response.json()["id"]

        # Jeff tries to revoke Shirley's share
        response = client.delete(
            f"{settings.API_V1_STR}/shares/{share_id}",
            headers=superuser_token_headers,
        )

        # Should fail - Jeff doesn't own this share
        assert response.status_code == 404


class TestViewSharedWishlist:
    """Test suite for viewing shared wishlists - the Dreamatorium of sharing."""

    def test_owner_can_view_own_wishlist(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """Jeff can always view his own wishlist."""
        superuser = get_superuser(db)

        response = client.get(
            f"{settings.API_V1_STR}/wishlist/user/{superuser.id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        content = response.json()
        assert "data" in content
        assert "count" in content

    def test_shared_user_can_view_wishlist(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        """When Jeff shares with Troy, Troy can view Jeff's wishlist."""
        superuser = get_superuser(db)

        # Create Troy
        troy = create_test_user(db, "troy.viewing@greendale.edu", "Troy Barnes Viewer")

        # Jeff shares with Troy
        create_share(db, superuser.id, troy.email)

        # Jeff adds an item
        item_in = WishlistItemCreate(
            title="Fancy Lawyer Briefcase",
            price_cents=50000,
        )
        create_wishlist_item(session=db, item_create=item_in, owner_id=superuser.id)

        # Troy logs in
        login_response = client.post(
            f"{settings.API_V1_STR}/login/access-token",
            data={"username": troy.email, "password": "sixseasonsandamovie"},
        )
        troy_token = login_response.json()["access_token"]
        troy_headers = {"Authorization": f"Bearer {troy_token}"}

        # Troy can view Jeff's wishlist
        response = client.get(
            f"{settings.API_V1_STR}/wishlist/user/{superuser.id}",
            headers=troy_headers,
        )

        assert response.status_code == 200
        content = response.json()
        assert content["count"] >= 1

    def test_unshared_user_cannot_view_private_wishlist(
        self, client: TestClient, db: Session
    ) -> None:
        """Chang can't view Jeff's wishlist without permission - nice try, Chang."""
        superuser = get_superuser(db)

        # Create Chang (no share with him)
        chang = create_test_user(db, "ben.chang@greendale.edu", "Ben Chang")

        # Chang logs in
        login_response = client.post(
            f"{settings.API_V1_STR}/login/access-token",
            data={"username": chang.email, "password": "sixseasonsandamovie"},
        )
        chang_token = login_response.json()["access_token"]
        chang_headers = {"Authorization": f"Bearer {chang_token}"}

        # Chang tries to view Jeff's wishlist
        response = client.get(
            f"{settings.API_V1_STR}/wishlist/user/{superuser.id}",
            headers=chang_headers,
        )

        # Should fail - no permission
        assert response.status_code == 403

    def test_anyone_can_view_public_wishlist(
        self, client: TestClient, db: Session
    ) -> None:
        """When Dean makes his wishlist public, everyone can see it."""
        # Create Dean with a public wishlist
        dean = create_test_user(db, "craig.pelton@greendale.edu", "Dean Pelton")
        dean.wishlist_visibility = WishlistVisibility.PUBLIC
        db.add(dean)
        db.commit()
        db.refresh(dean)

        # Dean adds an item
        item_in = WishlistItemCreate(
            title="Dalmatian Costume",
            price_cents=15000,
        )
        create_wishlist_item(session=db, item_create=item_in, owner_id=dean.id)

        # Create a random student (no share)
        random_student = create_test_user(
            db, "random.student@greendale.edu", "Random Student"
        )

        # Student logs in
        login_response = client.post(
            f"{settings.API_V1_STR}/login/access-token",
            data={"username": random_student.email, "password": "sixseasonsandamovie"},
        )
        student_token = login_response.json()["access_token"]
        student_headers = {"Authorization": f"Bearer {student_token}"}

        # Student can view Dean's public wishlist
        response = client.get(
            f"{settings.API_V1_STR}/wishlist/user/{dean.id}",
            headers=student_headers,
        )

        assert response.status_code == 200
        content = response.json()
        # Should see the Dalmatian Costume
        titles = [item["title"] for item in content["data"]]
        assert "Dalmatian Costume" in titles

    def test_view_nonexistent_user(
        self, client: TestClient, superuser_token_headers: dict[str, str]
    ) -> None:
        """Can't view wishlist of someone who doesn't exist."""
        fake_id = str(uuid.uuid4())

        response = client.get(
            f"{settings.API_V1_STR}/wishlist/user/{fake_id}",
            headers=superuser_token_headers,
        )

        # Should fail - user doesn't exist (returns 403 since can_view returns False)
        assert response.status_code == 403
