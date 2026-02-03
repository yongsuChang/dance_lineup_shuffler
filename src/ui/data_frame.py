import customtkinter as ctk

class DataFrame(ctk.CTkFrame):
    def __init__(self, master, data_manager):
        super().__init__(master, corner_radius=0, fg_color="transparent")
        self.data_manager = data_manager

        self.label = ctk.CTkLabel(self, text="데이터 관리 (Data Management)", font=ctk.CTkFont(size=24, weight="bold"))
        self.label.grid(row=0, column=0, padx=20, pady=20, sticky="w")

        # Tab View
        self.tabview = ctk.CTkTabview(self, width=800, height=500)
        self.tabview.grid(row=1, column=0, padx=20, pady=10, sticky="nsew")
        
        self.tab_classes = self.tabview.add("Classes")
        self.tab_students = self.tabview.add("Students")
        self.tab_pairs = self.tabview.add("Pairs")
        self.tab_exclusions = self.tabview.add("Exclusions")

        # Initialize Sub-UIs
        self.setup_classes_tab()
        self.setup_students_tab() # Placeholder
        self.setup_pairs_tab()    # Placeholder
        self.setup_exclusions_tab() # Placeholder

    def setup_classes_tab(self):
        # Frame for list
        self.class_list_frame = ctk.CTkScrollableFrame(self.tab_classes, width=700, height=300)
        self.class_list_frame.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")
        
        # Frame for add/edit
        self.class_edit_frame = ctk.CTkFrame(self.tab_classes)
        self.class_edit_frame.grid(row=1, column=0, padx=10, pady=10, sticky="ew")

        # Add inputs
        self.entry_class_name = ctk.CTkEntry(self.class_edit_frame, placeholder_text="반 이름 (Class Name)")
        self.entry_class_name.grid(row=0, column=0, padx=10, pady=10)
        
        self.entry_team_count = ctk.CTkEntry(self.class_edit_frame, placeholder_text="팀 수 (Team Count)")
        self.entry_team_count.grid(row=0, column=1, padx=10, pady=10)
        
        self.btn_add_class = ctk.CTkButton(self.class_edit_frame, text="추가 (Add)", command=self.add_class)
        self.btn_add_class.grid(row=0, column=2, padx=10, pady=10)

        self.refresh_class_list()

    def refresh_class_list(self):
        # Clear list
        for widget in self.class_list_frame.winfo_children():
            widget.destroy()
        
        classes = self.data_manager.get_classes()
        
        headers = ["반 이름", "팀 수", "삭제"]
        for i, h in enumerate(headers):
            ctk.CTkLabel(self.class_list_frame, text=h, font=("Arial", 12, "bold")).grid(row=0, column=i, padx=10, pady=5)

        for i, cls in enumerate(classes):
            row_idx = i + 1
            ctk.CTkLabel(self.class_list_frame, text=cls["name"]).grid(row=row_idx, column=0, padx=10, pady=5)
            ctk.CTkLabel(self.class_list_frame, text=str(cls["team_count"])).grid(row=row_idx, column=1, padx=10, pady=5)
            
            btn_del = ctk.CTkButton(self.class_list_frame, text="X", width=30, fg_color="red", 
                                    command=lambda c=cls: self.delete_class(c))
            btn_del.grid(row=row_idx, column=2, padx=10, pady=5)

    def add_class(self):
        name = self.entry_class_name.get()
        count = self.entry_team_count.get()
        
        if not name or not count:
            return # Validation
        
        try:
            count = int(count)
        except ValueError:
            return # Validation error
            
        classes = self.data_manager.get_classes()
        classes.append({"name": name, "team_count": count})
        self.data_manager.update_classes(classes)
        
        self.entry_class_name.delete(0, 'end')
        self.entry_team_count.delete(0, 'end')
        self.refresh_class_list()

    def delete_class(self, cls_to_delete):
        classes = self.data_manager.get_classes()
        classes = [c for c in classes if c["name"] != cls_to_delete["name"]]
        self.data_manager.update_classes(classes)
        self.refresh_class_list()

    def setup_students_tab(self):
        # Layout: Left (List), Right (Add & CSV Import)
        self.tab_students.grid_columnconfigure(0, weight=1)
        self.tab_students.grid_columnconfigure(1, weight=1)

        # --- Left: Student List ---
        self.student_list_frame = ctk.CTkScrollableFrame(self.tab_students, width=400, height=400)
        self.student_list_frame.grid(row=0, column=0, rowspan=2, padx=10, pady=10, sticky="nsew")
        
        # --- Right Top: Add Single Student ---
        self.student_add_frame = ctk.CTkFrame(self.tab_students)
        self.student_add_frame.grid(row=0, column=1, padx=10, pady=10, sticky="ew")
        
        ctk.CTkLabel(self.student_add_frame, text="학생 개별 추가", font=ctk.CTkFont(weight="bold")).pack(pady=5)
        
        self.entry_student_name = ctk.CTkEntry(self.student_add_frame, placeholder_text="닉네임 (Nickname)")
        self.entry_student_name.pack(pady=5, padx=10, fill="x")
        
        self.combo_student_class = ctk.CTkComboBox(self.student_add_frame, values=["반을 먼저 추가하세요"])
        self.combo_student_class.pack(pady=5, padx=10, fill="x")

        self.combo_student_role = ctk.CTkComboBox(self.student_add_frame, values=["leader", "follower"])
        self.combo_student_role.pack(pady=5, padx=10, fill="x")
        
        ctk.CTkButton(self.student_add_frame, text="추가 (Add)", command=self.add_student).pack(pady=10)

        # --- Right Bottom: CSV Import ---
        self.student_csv_frame = ctk.CTkFrame(self.tab_students)
        self.student_csv_frame.grid(row=1, column=1, padx=10, pady=10, sticky="nsew")
        
        ctk.CTkLabel(self.student_csv_frame, text="엑셀 붙여넣기 (반 이름 ~ 이름 목록)", font=ctk.CTkFont(weight="bold")).pack(pady=5)
        
        self.textbox_csv = ctk.CTkTextbox(self.student_csv_frame, height=150)
        self.textbox_csv.pack(pady=5, padx=10, fill="both", expand=True)
        
        ctk.CTkButton(self.student_csv_frame, text="CSV 파싱 및 추가 (Import CSV)", command=self.import_student_csv).pack(pady=10)
        
        self.refresh_student_list()

    def refresh_student_list(self):
        # Update Class Combobox
        classes = [c["name"] for c in self.data_manager.get_classes()]
        if classes:
            self.combo_student_class.configure(values=classes)
            self.combo_student_class.set(classes[0])
        else:
            self.combo_student_class.configure(values=["반을 먼저 추가하세요"])
        
        # Clear list
        for widget in self.student_list_frame.winfo_children():
            widget.destroy()

        students = self.data_manager.get_students()
        
        # Headers
        headers = ["닉네임", "반", "역할", "삭제"]
        for i, h in enumerate(headers):
            ctk.CTkLabel(self.student_list_frame, text=h, font=("Arial", 12, "bold")).grid(row=0, column=i, padx=5, pady=5)
            
        for i, s in enumerate(students):
            r = i + 1
            ctk.CTkLabel(self.student_list_frame, text=s["nickname"]).grid(row=r, column=0, padx=5, pady=2)
            ctk.CTkLabel(self.student_list_frame, text=s["class"]).grid(row=r, column=1, padx=5, pady=2)
            ctk.CTkLabel(self.student_list_frame, text=s["role"]).grid(row=r, column=2, padx=5, pady=2)
            ctk.CTkButton(self.student_list_frame, text="X", width=30, fg_color="red", 
                          command=lambda x=s: self.delete_student(x)).grid(row=r, column=3, padx=5, pady=2)

    def add_student(self):
        name = self.entry_student_name.get()
        cls_name = self.combo_student_class.get()
        role = self.combo_student_role.get()
        
        if not name or cls_name == "반을 먼저 추가하세요":
            return

        students = self.data_manager.get_students()
        students.append({"nickname": name, "class": cls_name, "role": role})
        self.data_manager.update_students(students)
        
        self.entry_student_name.delete(0, "end")
        self.refresh_student_list()

    def delete_student(self, s_to_delete):
        students = self.data_manager.get_students()
        # Filter by checking all fields to avoid deleting same-named people in different classes (though rare)
        students = [s for s in students if s != s_to_delete]
        self.data_manager.update_students(students)
        self.refresh_student_list()

    def import_student_csv(self):
        raw_text = self.textbox_csv.get("1.0", "end").strip()
        if not raw_text:
            return
            
        import re
        
        lines = [line.rstrip() for line in raw_text.split('\n')]
        if not lines:
            return

        # 1. Parse lines into a grid (handling tab-separated values)
        grid = [line.split('\t') for line in lines]
        
        # 2. Identify Header Rows
        class_row_idx = -1
        role_row_idx = -1
        
        for i, row in enumerate(grid):
            # Check for Role indicators
            if any(val.strip() in ['남', '여', '리더', '팔로워'] for val in row):
                role_row_idx = i
                break
        
        if role_row_idx == -1:
             # Fallback to simple CSV if no structured headers found
             print("Role header not found, trying simple CSV...")
             self.import_simple_csv(lines)
             return
             
        # Assume class row is somewhere above role row. 
        # Usually the first non-empty row, or specifically the one before role row?
        # Let's look for the first row that has content.
        for i in range(role_row_idx):
            if any(cell.strip() for cell in grid[i]):
                class_row_idx = i
                break
                
        if class_row_idx == -1:
            print("Class header not found.")
            return

        # 3. Map Columns to (Class, Role)
        col_map = {} # col_index -> {"class": name, "role": role}
        
        class_row = grid[class_row_idx]
        role_row = grid[role_row_idx]
        
        current_class = None
        
        # Determine max columns based on role row
        max_cols = len(role_row)
        
        for c in range(max_cols):
            # Update current class if cell is not empty
            if c < len(class_row):
                val = class_row[c].strip()
                if val:
                    current_class = val
            
            # Determine role
            role_str = role_row[c].strip()
            role = None
            if role_str in ['남', '리더']:
                role = 'leader'
            elif role_str in ['여', '팔로워']:
                role = 'follower'
            
            if current_class and role:
                col_map[c] = {"class": current_class, "role": role}

        # 4. Extract Students
        new_students = []
        existing_students = self.data_manager.get_students()
        # Create a set of (nickname, class) to avoid duplicates easily if needed, 
        # though DataManager doesn't enforce uniqueness, we might want to avoid exact dupes from import.
        
        # Start reading from the row after role_row
        for r in range(role_row_idx + 1, len(grid)):
            row = grid[r]
            for c in range(len(row)):
                if c not in col_map:
                    continue
                
                name_raw = row[c].strip()
                if not name_raw:
                    continue
                
                # Clean name: remove (number) e.g., "Name(2)" -> "Name"
                name_clean = re.sub(r'\s*\(\d+\)', '', name_raw).strip()
                
                if not name_clean:
                    continue
                    
                mapping = col_map[c]
                
                # Check if this class exists in DB, if not, maybe create it or just add student?
                # For safety, let's just add the student. 
                # Ideally, we should auto-create classes, but that might clutter if there are typos.
                # Let's auto-create classes if they don't exist? 
                # The user requirement implied just importing data. 
                # We'll add the student regardless.
                
                student_obj = {
                    "nickname": name_clean,
                    "class": mapping["class"],
                    "role": mapping["role"]
                }
                new_students.append(student_obj)
        
        # 5. Update Data
        if new_students:
            # Auto-register classes if missing?
            current_classes = self.data_manager.get_classes()
            existing_class_names = {c["name"] for c in current_classes}
            imported_class_names = {s["class"] for s in new_students}
            
            new_classes_found = False
            for c_name in imported_class_names:
                if c_name not in existing_class_names:
                    # Default team count 1
                    current_classes.append({"name": c_name, "team_count": 1}) 
                    existing_class_names.add(c_name)
                    new_classes_found = True
            
            if new_classes_found:
                self.data_manager.update_classes(current_classes)
                # Refresh class list in the other tab? 
                # The Data tab refreshes on switch, so it should be fine.

            existing_students.extend(new_students)
            self.data_manager.update_students(existing_students)
            
            self.textbox_csv.delete("1.0", "end")
            self.refresh_student_list()
            print(f"Imported {len(new_students)} students.")

    def import_simple_csv(self, lines):
        # Fallback for "Nickname, Class, Role" format
        new_students = []
        for line in lines:
            parts = [p.strip() for p in line.split(',')]
            if len(parts) >= 3:
                new_students.append({"nickname": parts[0], "class": parts[1], "role": parts[2]})
        
        if new_students:
            current = self.data_manager.get_students()
            current.extend(new_students)
            self.data_manager.update_students(current)
            self.textbox_csv.delete("1.0", "end")
            self.refresh_student_list()



    def setup_pairs_tab(self):
        # Layout: Left (List), Right (Add & Import)
        self.tab_pairs.grid_columnconfigure(0, weight=1)
        self.tab_pairs.grid_columnconfigure(1, weight=1)

        # --- Left: Pair List ---
        self.pair_list_frame = ctk.CTkScrollableFrame(self.tab_pairs, width=500, height=400)
        self.pair_list_frame.grid(row=0, column=0, rowspan=2, padx=10, pady=10, sticky="nsew")
        
        # --- Right Top: Add Pair ---
        self.pair_add_frame = ctk.CTkFrame(self.tab_pairs)
        self.pair_add_frame.grid(row=0, column=1, padx=10, pady=10, sticky="ew")
        
        ctk.CTkLabel(self.pair_add_frame, text="발표 페어 추가", font=ctk.CTkFont(weight="bold")).pack(pady=5)
        
        # 1. Select Class
        ctk.CTkLabel(self.pair_add_frame, text="반 선택").pack(pady=(10, 0))
        self.combo_pair_class = ctk.CTkComboBox(self.pair_add_frame, values=["반을 먼저 추가하세요"], command=self.on_pair_class_selected)
        self.combo_pair_class.pack(pady=5, padx=10, fill="x")

        # 2. Select Leader
        ctk.CTkLabel(self.pair_add_frame, text="리더 (Leader)").pack(pady=(10, 0))
        self.combo_pair_leader = ctk.CTkComboBox(self.pair_add_frame, values=[""])
        self.combo_pair_leader.pack(pady=5, padx=10, fill="x")

        # 3. Select Follower
        ctk.CTkLabel(self.pair_add_frame, text="팔로워 (Follower)").pack(pady=(10, 0))
        self.combo_pair_follower = ctk.CTkComboBox(self.pair_add_frame, values=["", "Solo"])
        self.combo_pair_follower.pack(pady=5, padx=10, fill="x")

        # 4. Options
        self.check_opening = ctk.CTkCheckBox(self.pair_add_frame, text="오프닝 (Opening)")
        self.check_opening.pack(pady=5, padx=10, anchor="w")
        self.check_ending = ctk.CTkCheckBox(self.pair_add_frame, text="엔딩 (Ending)")
        self.check_ending.pack(pady=5, padx=10, anchor="w")
        
        ctk.CTkButton(self.pair_add_frame, text="페어 추가 (Add Pair)", command=self.add_pair).pack(pady=15)

        # --- Right Bottom: Excel Import ---
        self.pair_excel_frame = ctk.CTkFrame(self.tab_pairs)
        self.pair_excel_frame.grid(row=1, column=1, padx=10, pady=10, sticky="nsew")
        
        ctk.CTkLabel(self.pair_excel_frame, text="엑셀 붙여넣기 (반 이름 행 → 페어 목록)", font=ctk.CTkFont(weight="bold")).pack(pady=5)
        
        self.textbox_pair_excel = ctk.CTkTextbox(self.pair_excel_frame, height=150)
        self.textbox_pair_excel.pack(pady=5, padx=10, fill="both", expand=True)
        
        ctk.CTkButton(self.pair_excel_frame, text="엑셀 데이터 가져오기 (Import Excel)", command=self.import_pair_excel).pack(pady=10)

        self.refresh_pair_list()

    def import_pair_excel(self):
        raw_text = self.textbox_pair_excel.get("1.0", "end").strip()
        if not raw_text:
            return
            
        import re
        lines = [line.rstrip() for line in raw_text.split('\n')]
        
        new_pairs = []
        current_class = None
        
        # Get existing classes to verify/auto-create if needed
        existing_classes = self.data_manager.get_classes()
        existing_class_names = {c["name"] for c in existing_classes}
        
        for line in lines:
            # Split by tab and remove empty strings
            parts = [p.strip() for p in line.split('\t') if p.strip()]
            
            if not parts:
                continue
            
            if len(parts) == 1:
                # Case 1: Class Name Header
                # If we encounter a single token line, treat it as a class header.
                current_class = parts[0]
                
                # Auto-create class if it doesn't exist?
                if current_class not in existing_class_names:
                    existing_classes.append({"name": current_class, "team_count": 1})
                    existing_class_names.add(current_class)
                    
            elif len(parts) >= 2:
                # Case 2: Pair Data (Leader, Follower)
                if not current_class:
                    print(f"Skipping pair {parts} because no class header was found yet.")
                    continue
                
                leader_raw = parts[0]
                follower_raw = parts[1]
                
                # Clean names
                leader_clean = re.sub(r'\s*\(\d+\)', '', leader_raw).strip()
                follower_clean = re.sub(r'\s*\(\d+\)', '', follower_raw).strip()
                
                new_pairs.append({
                    "class": current_class,
                    "leader": leader_clean,
                    "follower": follower_clean,
                    "is_solo": False,
                    "is_opening": False,
                    "is_ending": False
                })

        if new_pairs:
            # Update classes first in case new ones were added
            self.data_manager.update_classes(existing_classes)
            
            pairs = self.data_manager.get_pairs()
            pairs.extend(new_pairs)
            self.data_manager.update_pairs(pairs)
            self.textbox_pair_excel.delete("1.0", "end")
            self.refresh_pair_list()
            print(f"Imported {len(new_pairs)} pairs.")


    def on_pair_class_selected(self, cls_name):
        students = self.data_manager.get_students()
        leaders = [s["nickname"] for s in students if s["class"] == cls_name and s["role"] == "leader"]
        followers = [s["nickname"] for s in students if s["class"] == cls_name and s["role"] == "follower"]
        
        self.combo_pair_leader.configure(values=leaders if leaders else [""])
        self.combo_pair_leader.set(leaders[0] if leaders else "")
        
        f_values = ["Solo"] + followers if followers else ["Solo"]
        self.combo_pair_follower.configure(values=f_values)
        self.combo_pair_follower.set(f_values[0])

    def refresh_pair_list(self):
        # Update Class Combo
        classes = [c["name"] for c in self.data_manager.get_classes()]
        if classes:
            old_val = self.combo_pair_class.get()
            self.combo_pair_class.configure(values=classes)
            if old_val not in classes:
                self.combo_pair_class.set(classes[0])
                self.on_pair_class_selected(classes[0])
        
        # Clear list
        for widget in self.pair_list_frame.winfo_children():
            widget.destroy()

        pairs = self.data_manager.get_pairs()
        headers = ["반", "리더", "팔로워", "O/E", "삭제"]
        for i, h in enumerate(headers):
            ctk.CTkLabel(self.pair_list_frame, text=h, font=("Arial", 11, "bold")).grid(row=0, column=i, padx=5, pady=5)
            
        for i, p in enumerate(pairs):
            r = i + 1
            oe = ""
            if p.get("is_opening"): oe += "O"
            if p.get("is_ending"): oe += "E"
            
            ctk.CTkLabel(self.pair_list_frame, text=p["class"]).grid(row=r, column=0, padx=5, pady=2)
            ctk.CTkLabel(self.pair_list_frame, text=p["leader"]).grid(row=r, column=1, padx=5, pady=2)
            ctk.CTkLabel(self.pair_list_frame, text=p["follower"]).grid(row=r, column=2, padx=5, pady=2)
            ctk.CTkLabel(self.pair_list_frame, text=oe).grid(row=r, column=3, padx=5, pady=2)
            ctk.CTkButton(self.pair_list_frame, text="X", width=30, fg_color="red", 
                          command=lambda x=p: self.delete_pair(x)).grid(row=r, column=4, padx=5, pady=2)

    def add_pair(self):
        cls_name = self.combo_pair_class.get()
        leader = self.combo_pair_leader.get()
        follower = self.combo_pair_follower.get()
        is_opening = self.check_opening.get()
        is_ending = self.check_ending.get()
        
        if not cls_name or not leader:
            return

        pairs = self.data_manager.get_pairs()
        pairs.append({
            "class": cls_name,
            "leader": leader,
            "follower": follower if follower != "Solo" else "",
            "is_solo": follower == "Solo",
            "is_opening": is_opening,
            "is_ending": is_ending
        })
        self.data_manager.update_pairs(pairs)
        self.refresh_pair_list()

    def delete_pair(self, p_to_delete):
        pairs = self.data_manager.get_pairs()
        pairs = [p for p in pairs if p != p_to_delete]
        self.data_manager.update_pairs(pairs)
        self.refresh_pair_list()

        
    def setup_exclusions_tab(self):
        # Layout: Left (List), Right (Add)
        self.tab_exclusions.grid_columnconfigure(0, weight=1)
        self.tab_exclusions.grid_columnconfigure(1, weight=1)

        # --- Left: Exclusion List ---
        self.ex_list_frame = ctk.CTkScrollableFrame(self.tab_exclusions, width=400, height=400)
        self.ex_list_frame.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")
        
        # --- Right: Add Exclusion ---
        self.ex_add_frame = ctk.CTkFrame(self.tab_exclusions)
        self.ex_add_frame.grid(row=0, column=1, padx=10, pady=10, sticky="ew")
        
        ctk.CTkLabel(self.ex_add_frame, text="촬영 제외 닉네임 추가", font=ctk.CTkFont(weight="bold")).pack(pady=5)
        
        self.entry_ex_name = ctk.CTkEntry(self.ex_add_frame, placeholder_text="닉네임 (Nickname)")
        self.entry_ex_name.pack(pady=5, padx=10, fill="x")
        
        ctk.CTkButton(self.ex_add_frame, text="추가 (Add)", command=self.add_exclusion).pack(pady=10)

        self.refresh_exclusion_list()

    def refresh_exclusion_list(self):
        for widget in self.ex_list_frame.winfo_children():
            widget.destroy()

        exclusions = self.data_manager.get_photo_exclusions()
        for i, name in enumerate(exclusions):
            row = ctk.CTkFrame(self.ex_list_frame, fg_color="transparent")
            row.pack(fill="x", pady=2)
            ctk.CTkLabel(row, text=name).pack(side="left", padx=10)
            ctk.CTkButton(row, text="X", width=30, fg_color="red", 
                          command=lambda n=name: self.delete_exclusion(n)).pack(side="right", padx=10)

    def add_exclusion(self):
        name = self.entry_ex_name.get().strip()
        if not name: return
        
        exclusions = self.data_manager.get_photo_exclusions()
        if name not in exclusions:
            exclusions.append(name)
            self.data_manager.update_photo_exclusions(exclusions)
        
        self.entry_ex_name.delete(0, "end")
        self.refresh_exclusion_list()

    def delete_exclusion(self, name):
        exclusions = self.data_manager.get_photo_exclusions()
        if name in exclusions:
            exclusions.remove(name)
            self.data_manager.update_photo_exclusions(exclusions)
        self.refresh_exclusion_list()

