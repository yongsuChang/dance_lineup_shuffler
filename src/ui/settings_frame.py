import customtkinter as ctk

class SettingsFrame(ctk.CTkFrame):
    def __init__(self, master, data_manager):
        super().__init__(master, corner_radius=0, fg_color="transparent")
        self.data_manager = data_manager
        
        self.label = ctk.CTkLabel(self, text="설정 (Settings)", font=ctk.CTkFont(size=24, weight="bold"))
        self.label.grid(row=0, column=0, padx=20, pady=20, sticky="w")

        self.settings_container = ctk.CTkFrame(self)
        self.settings_container.grid(row=1, column=0, padx=20, pady=10, sticky="nsew")

        # Define fields
        self.entries = {}
        self.checkboxes = {}
        
        self.load_settings()

        # Save Button
        self.save_button = ctk.CTkButton(self, text="저장 (Save)", command=self.save_settings)
        self.save_button.grid(row=2, column=0, padx=20, pady=20, sticky="e")

    def load_settings(self):
        settings = self.data_manager.get_settings()
        
        # Clear existing
        for widget in self.settings_container.winfo_children():
            widget.destroy()

        row = 0
        
        # Text Fields
        text_fields = [
            ("year", "연도 (Year)"),
            ("semester", "학기 (Semester)"),
            ("min_rest_leader", "리더 최소 휴식 (Min Rest Leader)"),
            ("min_rest_follower", "팔로워 최소 휴식 (Min Rest Follower)")
        ]

        for key, label_text in text_fields:
            lbl = ctk.CTkLabel(self.settings_container, text=label_text)
            lbl.grid(row=row, column=0, padx=10, pady=5, sticky="w")
            
            entry = ctk.CTkEntry(self.settings_container, width=200)
            entry.grid(row=row, column=1, padx=10, pady=5, sticky="w")
            entry.insert(0, str(settings.get(key, "")))
            self.entries[key] = entry
            row += 1

        # Checkboxes
        bool_fields = [
            ("exclude_staff_from_photo", "운영진 촬영 제외 (Exclude Staff from Photo)"),
            ("exclude_newbies_from_photo", "신입생 촬영 제외 (Exclude Newbies from Photo)")
        ]

        for key, label_text in bool_fields:
            chk_var = ctk.BooleanVar(value=settings.get(key, False))
            chk = ctk.CTkCheckBox(self.settings_container, text=label_text, variable=chk_var)
            chk.grid(row=row, column=0, columnspan=2, padx=10, pady=5, sticky="w")
            self.checkboxes[key] = chk_var
            row += 1

    def save_settings(self):
        new_settings = {}
        
        # Collect text entries
        for key, entry in self.entries.items():
            val = entry.get()
            # Convert to int if possible for specific keys
            if key in ["min_rest_leader", "min_rest_follower", "year"]:
                try:
                    val = int(val)
                except ValueError:
                    pass # Keep as string if conversion fails
            new_settings[key] = val
            
        # Collect checkboxes
        for key, var in self.checkboxes.items():
            new_settings[key] = var.get()

        self.data_manager.update_settings(new_settings)
        print("Settings saved:", new_settings)
