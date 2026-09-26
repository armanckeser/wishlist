"""Gift items from a user's wishlist via CLI."""

from typing import Annotated

import typer
from rich.console import Console
from rich.prompt import Confirm, Prompt
from rich.table import Table
from sqlmodel import Session

# Import central models registry first to ensure all models are loaded
import app.core.models  # noqa: F401
from app.core.db import engine
from app.features.users.service import get_user_by_email
from app.features.wishlist_item.models import WishlistItemStatus
from app.features.wishlist_item.service import (
    get_wishlist_items_for_user,
    mark_as_gifted,
)

gift_app = typer.Typer(help="Gift items from wishlists")
console = Console()

PAGE_SIZE = 10


def format_price(cents: int) -> str:
    """Format cents as dollar string."""
    return f"${cents / 100:.2f}"


def display_items_page(
    items: list[tuple[int, str, str, int, str]],
    page: int,
    total_pages: int,
) -> None:
    """Display a page of items in a table.

    Args:
        items: List of (index, id, title, price_cents, status) tuples
        page: Current page number (0-indexed)
        total_pages: Total number of pages
    """
    table = Table(title=f"Wishlist Items (Page {page + 1}/{total_pages})")
    table.add_column("#", style="cyan", width=4)
    table.add_column("Title", style="white", max_width=50)
    table.add_column("Price", style="green", justify="right")
    table.add_column("Status", style="yellow")

    for idx, _item_id, title, price_cents, status in items:
        status_display = status
        if status == "wishlisted":
            status_display = "[green]wishlisted[/green]"
        elif status == "gifted":
            status_display = "[magenta]gifted[/magenta]"
        elif status == "purchased":
            status_display = "[blue]purchased[/blue]"
        elif status == "archived":
            status_display = "[dim]archived[/dim]"

        table.add_row(
            str(idx),
            title[:50] + "..." if len(title) > 50 else title,
            format_price(price_cents),
            status_display,
        )

    console.print(table)


@gift_app.command()
def send(
    owner_email: Annotated[
        str,
        typer.Argument(help="Email of the wishlist owner to gift to"),
    ],
    gifter_email: Annotated[
        str,
        typer.Option(
            "--from",
            "-f",
            help="Email of the gifter (you). Defaults to test user.",
        ),
    ] = "abed.nadir@greendale.edu",
) -> None:
    """Interactively gift an item from someone's wishlist.

    Shows the user's wishlist items and lets you select one to gift.
    """
    with Session(engine) as session:
        # Find owner
        owner = get_user_by_email(session, owner_email)
        if not owner:
            console.print(f"[bold red]Error:[/bold red] User '{owner_email}' not found")
            raise typer.Exit(code=1)

        # Find gifter
        gifter = get_user_by_email(session, gifter_email)
        if not gifter:
            console.print(
                f"[bold red]Error:[/bold red] Gifter '{gifter_email}' not found"
            )
            raise typer.Exit(code=1)

        if owner.id == gifter.id:
            console.print("[bold red]Error:[/bold red] Cannot gift to yourself")
            raise typer.Exit(code=1)

        console.print(f"\n[bold cyan]Gift to {owner.full_name}[/bold cyan]")
        console.print(f"[dim]Gifter: {gifter.full_name} ({gifter_email})[/dim]\n")

        # Get all items
        all_items, total_count = get_wishlist_items_for_user(
            session, owner.id, skip=0, limit=1000
        )

        if not all_items:
            console.print("[yellow]This user has no wishlist items.[/yellow]")
            raise typer.Exit(code=0)

        # Prepare items with indices
        indexed_items: list[tuple[int, str, str, int, str]] = [
            (i + 1, str(item.id), item.title, item.price_cents, item.status.value)
            for i, item in enumerate(all_items)
        ]

        # Filter giftable items (only wishlisted)
        giftable_indices = {
            idx for idx, _, _, _, status in indexed_items if status == "wishlisted"
        }

        if not giftable_indices:
            console.print(
                "[yellow]No giftable items (all items are already purchased, gifted, or archived).[/yellow]"
            )
            raise typer.Exit(code=0)

        # Paginated display loop
        total_pages = (len(indexed_items) + PAGE_SIZE - 1) // PAGE_SIZE
        current_page = 0

        while True:
            start_idx = current_page * PAGE_SIZE
            end_idx = min(start_idx + PAGE_SIZE, len(indexed_items))
            page_items = indexed_items[start_idx:end_idx]

            display_items_page(page_items, current_page, total_pages)

            # Show navigation hints
            nav_hints = []
            if current_page > 0:
                nav_hints.append("[p]rev")
            if current_page < total_pages - 1:
                nav_hints.append("[n]ext")
            nav_hints.append("[q]uit")
            nav_hints.append("or enter item #")

            console.print(f"\n[dim]{' | '.join(nav_hints)}[/dim]")

            choice = Prompt.ask("Select").strip().lower()

            if choice == "q":
                console.print("[dim]Cancelled.[/dim]")
                raise typer.Exit(code=0)
            elif choice == "n" and current_page < total_pages - 1:
                current_page += 1
                continue
            elif choice == "p" and current_page > 0:
                current_page -= 1
                continue
            elif choice.isdigit():
                item_num = int(choice)
                if item_num < 1 or item_num > len(indexed_items):
                    console.print(
                        f"[red]Invalid number. Choose 1-{len(indexed_items)}[/red]"
                    )
                    continue
                if item_num not in giftable_indices:
                    console.print(
                        "[red]That item is not giftable (already purchased, gifted, or archived)[/red]"
                    )
                    continue

                # Found valid item
                selected = indexed_items[item_num - 1]
                _, item_id, title, price_cents, _ = selected
                break
            else:
                console.print("[red]Invalid input[/red]")
                continue

        # Confirm selection
        console.print(f"\n[bold]Selected:[/bold] {title} ({format_price(price_cents)})")

        if not Confirm.ask("Proceed with gifting?", default=True):
            console.print("[dim]Cancelled.[/dim]")
            raise typer.Exit(code=0)

        # Get gift details
        console.print("\n[dim]Optional gift details (press Enter to skip):[/dim]")
        gift_message = Prompt.ask("Gift message", default="").strip() or None
        display_name_default = gifter.full_name or ""
        display_name = (
            Prompt.ask("Your display name", default=display_name_default).strip()
            or None
        )
        tracking_url = Prompt.ask("Tracking URL", default="").strip() or None

        # Find the actual item object
        item_obj = next(item for item in all_items if str(item.id) == item_id)

        # Perform the gift
        try:
            mark_as_gifted(
                session,
                item_obj,
                gifter_id=gifter.id,
                gift_message=gift_message,
                gifter_display_name=display_name,
                tracking_url=tracking_url,
            )
            console.print(
                f"\n[bold green]✓ Successfully gifted '{title}' to {owner.full_name}![/bold green]"
            )
            if gift_message:
                console.print(f"[dim]Message: {gift_message}[/dim]")
        except ValueError as e:
            console.print(f"[bold red]Error:[/bold red] {e}")
            raise typer.Exit(code=1)


@gift_app.command()
def list_items(
    user_email: Annotated[
        str,
        typer.Argument(help="Email of the user whose wishlist to view"),
    ],
    status: Annotated[
        str | None,
        typer.Option(
            "--status",
            "-s",
            help="Filter by status (wishlisted, purchased, gifted, archived)",
        ),
    ] = None,
) -> None:
    """List all items in a user's wishlist."""
    with Session(engine) as session:
        user = get_user_by_email(session, user_email)
        if not user:
            console.print(f"[bold red]Error:[/bold red] User '{user_email}' not found")
            raise typer.Exit(code=1)

        items, count = get_wishlist_items_for_user(session, user.id, skip=0, limit=1000)

        if status:
            try:
                status_enum = WishlistItemStatus(status.lower())
                items = [item for item in items if item.status == status_enum]
            except ValueError:
                console.print(
                    f"[bold red]Error:[/bold red] Invalid status '{status}'. "
                    "Use: wishlisted, purchased, gifted, archived"
                )
                raise typer.Exit(code=1)

        console.print(f"\n[bold cyan]{user.full_name}'s Wishlist[/bold cyan]")
        console.print(f"[dim]Total items: {count}[/dim]\n")

        if not items:
            console.print("[yellow]No items found.[/yellow]")
            raise typer.Exit(code=0)

        table = Table()
        table.add_column("#", style="cyan", width=4)
        table.add_column("Title", style="white", max_width=40)
        table.add_column("Price", style="green", justify="right")
        table.add_column("Status", style="yellow")
        table.add_column("Gifter", style="magenta")

        for i, item in enumerate(items, 1):
            status_display = item.status.value
            if item.status == WishlistItemStatus.WISHLISTED:
                status_display = "[green]wishlisted[/green]"
            elif item.status == WishlistItemStatus.GIFTED:
                status_display = "[magenta]gifted[/magenta]"
            elif item.status == WishlistItemStatus.PURCHASED:
                status_display = "[blue]purchased[/blue]"
            elif item.status == WishlistItemStatus.ARCHIVED:
                status_display = "[dim]archived[/dim]"

            gifter_name = item.gifter_display_name or "-"
            if item.status == WishlistItemStatus.GIFTED and item.gift_message:
                gifter_name += f" [dim]({item.gift_message[:20]}...)[/dim]"

            table.add_row(
                str(i),
                item.title[:40] + "..." if len(item.title) > 40 else item.title,
                format_price(item.price_cents),
                status_display,
                gifter_name,
            )

        console.print(table)
