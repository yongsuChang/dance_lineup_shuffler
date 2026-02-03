import json
import os
import shutil

class DataManager:
    def __init__(self, db_path='data/db.json'):
        self.db_path = db_path
        self.data = self.load_data()

    def load_data(self):
        """Loads data from the JSON file. Creates default if not exists."""
        if not os.path.exists(self.db_path):
            return self.create_default_db()
        
        try:
            with open(self.db_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError:
            print("Error decoding JSON. Creating new default DB.")
            return self.create_default_db()

    def create_default_db(self):
        """Creates a default database structure."""
        default_data = {
            "settings": {
                "year": 2024,
                "semester": "1",
                "min_rest_leader": 2,
                "min_rest_follower": 2,
                "exclude_staff_from_photo": True,
                "exclude_newbies_from_photo": True
            },
            "classes": [],
            "pairs": [],
            "students": [],
            "photo_exclusions": []
        }
        self.save_data(default_data)
        return default_data

    def save_data(self, data=None):
        """Saves the current data to the JSON file."""
        if data:
            self.data = data
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        with open(self.db_path, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, indent=4, ensure_ascii=False)

    # --- Getters ---
    def get_settings(self):
        return self.data.get("settings", {})

    def get_classes(self):
        return self.data.get("classes", [])

    def get_students(self):
        return self.data.get("students", [])
    
    def get_pairs(self):
        return self.data.get("pairs", [])

    def get_photo_exclusions(self):
        return self.data.get("photo_exclusions", [])

    # --- Setters/Updaters ---
    def update_settings(self, new_settings):
        self.data["settings"] = new_settings
        self.save_data()

    def update_classes(self, new_classes):
        self.data["classes"] = new_classes
        self.save_data()

    def update_students(self, new_students):
        self.data["students"] = new_students
        self.save_data()

    def update_pairs(self, new_pairs):
        self.data["pairs"] = new_pairs
        self.save_data()

    def update_photo_exclusions(self, new_exclusions):
        self.data["photo_exclusions"] = new_exclusions
        self.save_data()
