"""CLI entry point for wishlist management commands."""

import typer

from app.commands.gift import gift_app
from app.commands.prepopulate import prepopulate_app

app = typer.Typer(
    name="wishlist-cli",
    help="Wishlist management commands",
    add_completion=False,
)

app.add_typer(prepopulate_app, name="prepopulate")
app.add_typer(gift_app, name="gift")

if __name__ == "__main__":
    app()
