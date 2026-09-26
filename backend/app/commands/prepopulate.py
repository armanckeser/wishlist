"""Prepopulate wishlist with test data from CSV."""

import asyncio
from pathlib import Path
from typing import Annotated

import typer
from rich.console import Console
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn
from sqlmodel import Session

# Import central models registry first to ensure all models are loaded
import app.core.models  # noqa: F401
from app.core.db import engine
from app.core.security import get_password_hash
from app.features.budget.service import get_or_create_budget
from app.features.category.service import (
    create_default_categories_for_user,
    get_categories_for_user,
)
from app.features.url_parser.service import parse_url
from app.features.users.models import User
from app.features.users.service import get_user_by_email
from app.features.wishlist_item.models import WishlistItemCreate
from app.features.wishlist_item.service import (
    create_wishlist_item,
    get_wishlist_items_for_user,
)
from app.features.wishlist_share.service import create_share, get_shares_with_user

prepopulate_app = typer.Typer(help="Prepopulate wishlist with test data")
console = Console()

DATA_DIR = Path(__file__).parent.parent.parent / "data"


@prepopulate_app.command()
def run(
    user_email: Annotated[
        str,
        typer.Option(
            "--user-email",
            "-u",
            help="Email of user to prepopulate data for",
        ),
    ],
    limit: Annotated[
        int,
        typer.Option(
            "--limit",
            "-l",
            help="Maximum number of URLs to parse",
            min=1,
        ),
    ] = 10,
    timeout: Annotated[
        float,
        typer.Option(
            "--timeout",
            "-t",
            help="Timeout in seconds for each URL parse",
            min=1.0,
        ),
    ] = 45.0,
    csv_path: Annotated[
        Path,
        typer.Option(
            "--csv-path",
            "-c",
            help="Path to CSV file with product URLs",
        ),
    ] = DATA_DIR / "product_urls.csv",
    verbose: Annotated[
        bool,
        typer.Option(
            "--verbose",
            "-v",
            help="Enable verbose output with detailed parsing info",
        ),
    ] = False,
    force: Annotated[
        bool,
        typer.Option(
            "--force",
            "-f",
            help="Force prepopulate even if user already has items (appends new products)",
        ),
    ] = False,
) -> None:
    """Prepopulate wishlist with test products from product_urls.csv.

    Sets up budget, default categories, test user with shared wishlist,
    and parses URLs to create wishlist items.

    By default, skips if user already has items. Use --force to append anyway.
    """
    exit_code = asyncio.run(
        prepopulate_async(
            user_email=user_email,
            limit=limit,
            timeout=timeout,
            csv_path=csv_path,
            verbose=verbose,
            force=force,
        )
    )
    raise typer.Exit(code=exit_code)


async def prepopulate_async(
    user_email: str,
    limit: int,
    timeout: float,
    csv_path: Path,
    verbose: bool,
    force: bool = False,
    session: Session | None = None,
) -> int:
    """Async implementation of prepopulate command.

    Args:
        user_email: Email of user to prepopulate data for
        limit: Maximum number of URLs to parse
        timeout: Timeout in seconds for each URL parse
        csv_path: Path to CSV file with product URLs
        verbose: Enable verbose output
        force: Force prepopulate even if user already has items
        session: Optional database session (for testing)

    Returns:
        Exit code (0 = success, 1 = failure)
    """
    console.print("\n[bold cyan]Wishlist Prepopulate[/bold cyan]")
    console.print(f"User: {user_email}")
    console.print(f"Limit: {limit} URLs")
    console.print(f"Timeout: {timeout}s per URL")
    console.print(f"CSV: {csv_path}")
    if force:
        console.print(
            "[yellow]Force mode: Will append products even if user has items[/yellow]"
        )
    console.print()

    if session is None:
        with Session(engine) as session:
            return await _prepopulate_with_session(
                session, user_email, limit, timeout, csv_path, verbose, force
            )
    return await _prepopulate_with_session(
        session, user_email, limit, timeout, csv_path, verbose, force
    )


async def _prepopulate_with_session(
    session: Session,
    user_email: str,
    limit: int,
    timeout: float,
    csv_path: Path,
    verbose: bool,
    force: bool,
) -> int:
    """Helper function with session already provided.

    Args:
        session: Database session
        user_email: Email of user to prepopulate data for
        limit: Maximum number of URLs to parse
        timeout: Timeout in seconds for each URL parse
        csv_path: Path to CSV file with product URLs
        verbose: Enable verbose output
        force: Force prepopulate even if user already has items

    Returns:
        Exit code (0 = success, 1 = failure)
    """
    # Get user
    user = get_user_by_email(session, user_email)
    if not user:
        console.print(f"[bold red]Error:[/bold red] User '{user_email}' not found")
        return 1

    console.print(f"[green]✓[/green] Found user: {user.full_name}")

    # Set up budget
    budget = get_or_create_budget(session, user.id)
    budget.cents_at_last_update = 50000  # $500
    budget.monthly_rate_cents = 60000  # $600/mo
    session.add(budget)
    session.commit()
    console.print("[green]✓[/green] Budget set: $500.00 at $600/month")

    # Create default categories
    existing_categories = get_categories_for_user(session, user.id)
    if not existing_categories:
        new_categories = create_default_categories_for_user(session, user.id)
        console.print(
            f"[green]✓[/green] Created {len(new_categories)} default categories"
        )
    else:
        console.print(
            f"[yellow]•[/yellow] {len(existing_categories)} categories already exist"
        )

    # Check if user already has items (skip unless forced)
    existing_items, _ = get_wishlist_items_for_user(session, user.id)
    if existing_items and not force:
        console.print(
            f"\n[yellow]Warning:[/yellow] User already has {len(existing_items)} wishlist items"
        )
        console.print(
            "[yellow]Skipping product import (use --force to append anyway)[/yellow]"
        )
        return 0
    elif existing_items:
        console.print(
            f"[yellow]•[/yellow] User has {len(existing_items)} existing items, will append new products"
        )

    # Create test user and share
    test_user_created = await setup_test_user(session, user)
    if test_user_created:
        console.print(
            "[green]✓[/green] Created test user 'Abed Nadir' and shared wishlist"
        )
    else:
        console.print("[yellow]•[/yellow] Test user already exists, ensured share")

    # Read URLs from CSV
    if not csv_path.exists():
        console.print(f"[bold red]Error:[/bold red] CSV file not found: {csv_path}")
        return 1

    with open(csv_path, encoding="utf-8") as file:
        urls = [line.strip() for line in file if line.strip()]

    console.print(f"\n[cyan]Found {len(urls)} URLs in CSV[/cyan]")
    console.print(f"[cyan]Parsing first {min(limit, len(urls))} URLs...[/cyan]\n")

    # Parse URLs and create items
    items_created = 0
    errors: list[tuple[str, str]] = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        console=console,
    ) as progress:
        task = progress.add_task("[cyan]Parsing URLs...", total=min(limit, len(urls)))

        for idx, url in enumerate(urls[:limit], 1):
            progress.update(
                task, description=f"[cyan]Parsing URL {idx}/{min(limit, len(urls))}"
            )

            try:
                if verbose:
                    console.print(f"\n[dim]URL {idx}:[/dim] {url[:80]}...")

                metadata, fetch_method = await parse_url(url, timeout=timeout)

                if not metadata.title:
                    error_msg = "No title found"
                    errors.append((url, error_msg))
                    if verbose:
                        console.print(f"[yellow]  ✗ {error_msg}[/yellow]")
                    progress.advance(task)
                    continue

                item_create = WishlistItemCreate(
                    title=metadata.title,
                    description=metadata.description,
                    price_cents=metadata.price_cents or 0,
                    image_url=metadata.image_url,
                    product_url=metadata.source_url,
                )
                create_wishlist_item(session, item_create, user.id)
                items_created += 1

                if verbose:
                    price_str = (
                        f"${metadata.price_cents / 100:.2f}"
                        if metadata.price_cents
                        else "no price"
                    )
                    console.print(
                        f"[green]  ✓ {metadata.title[:60]}[/green] ({price_str}, via {fetch_method})"
                    )

            except Exception as e:
                error_msg = str(e)
                errors.append((url, error_msg))
                if verbose:
                    console.print(f"[red]  ✗ {error_msg}[/red]")

            progress.advance(task)

    # Print summary
    console.print("\n[bold]Summary[/bold]")
    console.print(f"[green]✓[/green] Items created: {items_created}")
    console.print(f"[red]✗[/red] Failed: {len(errors)}")
    total_attempted = min(limit, len(urls))
    if total_attempted > 0:
        success_rate = items_created / total_attempted * 100
        console.print(f"[cyan]Success rate: {success_rate:.1f}%[/cyan]")
    else:
        console.print("[cyan]Success rate: N/A (no URLs to parse)[/cyan]")

    if errors:
        console.print(f"\n[bold red]Failed URLs ({len(errors)}):[/bold red]")
        for url, error in errors:
            console.print(f"  • {url[:60]}...")
            console.print(f"    [dim]{error}[/dim]")

    console.print()
    return 0


async def setup_test_user(session: Session, current_user: User) -> bool:
    """Create test user with wishlist items and share with current user.

    Args:
        session: Database session
        current_user: Current user to share with

    Returns:
        True if test user was created, False if already existed
    """
    test_email = "abed.nadir@greendale.edu"
    existing_test_user = get_user_by_email(session, test_email)

    if not existing_test_user:
        # Create test user
        test_user = User(
            email=test_email,
            full_name="Abed Nadir",
            hashed_password=get_password_hash("sixseasonsandamovie"),
        )
        session.add(test_user)
        session.commit()
        session.refresh(test_user)

        # Create wishlist items for test user
        test_items = [
            WishlistItemCreate(
                title="Inspector Spacetime DVD Box Set",
                price_cents=4999,
                description="Complete series collection",
            ),
            WishlistItemCreate(
                title="Dreamatorium Equipment",
                price_cents=29999,
                description="For imagination adventures",
            ),
            WishlistItemCreate(
                title="Film Camera",
                price_cents=89999,
                description="For making documentaries about everything",
            ),
        ]
        for item_create in test_items:
            create_wishlist_item(session, item_create, test_user.id)

        # Share test user's wishlist with current user
        create_share(session, test_user.id, current_user.email)

        return True

    # Test user exists, ensure share exists
    existing_shares = get_shares_with_user(session, current_user.id)
    has_share = any(s.owner_id == existing_test_user.id for s in existing_shares)
    if not has_share:
        create_share(session, existing_test_user.id, current_user.email)

    return False
