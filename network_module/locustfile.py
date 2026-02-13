from locust import HttpUser, task, between
import random

class WebsiteUser(HttpUser):
    # Wait between 1 and 3 seconds (Simulates a HUMAN)
    wait_time = between(1, 3)

    @task(3) # Higher weight = more frequent
    def view_home(self):
        self.client.get("/")

    @task(1)
    def attempt_login(self):
        # Simulate failed login
        self.client.post("/login", json={"username": "student", "password": "wrongpassword"})

class DDoSAttacker(HttpUser):
    # No wait time (Simulates a BOT/ATTACKER)
    wait_time = between(0.01, 0.1) 

    @task
    def flood_server(self):
        self.client.get("/")