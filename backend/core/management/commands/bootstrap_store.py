"""Create the first store admin and the default categories.

    python manage.py bootstrap_store --email you@example.com --password '...'
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Category, Profile, User, UserRole

CATEGORIES = [
    ("Dresses", "dresses", "Elegant day-to-evening dresses.", 1),
    ("Tops", "tops", "Blouses and tailored tops for office and church.", 2),
    ("Sets", "sets", "Co-ords and two-piece sets.", 3),
    ("Warm Wear", "warm-wear", "Trench coats, leather and fur jackets.", 4),
    ("Gifts", "gifts", "Curated gift packages for every occasion.", 5),
]


class Command(BaseCommand):
    help = "Seed default categories and create a store admin account."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--password", required=True)
        parser.add_argument("--name", default="Néra Wear Admin")

    @transaction.atomic
    def handle(self, *args, **options):
        for name, slug, description, order in CATEGORIES:
            Category.objects.get_or_create(
                slug=slug,
                defaults={"name": name, "description": description, "sort_order": order},
            )
        self.stdout.write(self.style.SUCCESS(f"Categories ready ({Category.objects.count()})."))

        email = options["email"].lower()
        user = User.objects.filter(email=email).first()
        if user is None:
            user = User.objects.create_user(email=email, password=options["password"])
        else:
            user.set_password(options["password"])
        user.is_staff = True
        user.is_superuser = True
        user.save()

        UserRole.objects.get_or_create(user=user, role=UserRole.ADMIN)
        Profile.objects.get_or_create(user=user, defaults={"full_name": options["name"]})
        self.stdout.write(self.style.SUCCESS(f"Store admin ready: {email}"))
