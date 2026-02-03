import customtkinter as ctk
import re

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
        self.setup_students_tab()
        self.setup_pairs_tab()
        self.setup_exclusions_tab()

    # --- Classes Tab ---
    def setup_classes_tab(self):
        self.class_edit_index = None
        self.class_list_frame = ctk.CTkScrollableFrame(self.tab_classes, width=700, height=300)
        self.class_list_frame.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")
        
        self.class_edit_frame = ctk.CTkFrame(self.tab_classes)
        self.class_edit_frame.grid(row=1, column=0, padx=10, pady=10, sticky="ew")

        self.entry_class_name = ctk.CTkEntry(self.class_edit_frame, placeholder_text="반 이름 (Class Name)")
        self.entry_class_name.grid(row=0, column=0, padx=10, pady=10)
        
        self.entry_team_count = ctk.CTkEntry(self.class_edit_frame, placeholder_text="팀 수 (Team Count)")
        self.entry_team_count.grid(row=0, column=1, padx=10, pady=10)
        
        self.btn_add_class = ctk.CTkButton(self.class_edit_frame, text="추가 (Add)", command=self.add_or_update_class)
        self.btn_add_class.grid(row=0, column=2, padx=10, pady=10)
        
        self.btn_class_cancel = ctk.CTkButton(self.class_edit_frame, text="취소 (Cancel)", fg_color="gray", command=self.cancel_class_edit)
        # Initially hidden

        self.refresh_class_list()

    def refresh_class_list(self):
        for widget in self.class_list_frame.winfo_children():
            widget.destroy()
        
        classes = self.data_manager.get_classes()
        headers = ["반 이름", "팀 수", "수정", "삭제"]
        for i, h in enumerate(headers):
            ctk.CTkLabel(self.class_list_frame, text=h, font=("Arial", 12, "bold")).grid(row=0, column=i, padx=10, pady=5)

        for i, cls in enumerate(classes):
            row_idx = i + 1
            ctk.CTkLabel(self.class_list_frame, text=cls["name"]).grid(row=row_idx, column=0, padx=10, pady=5)
            ctk.CTkLabel(self.class_list_frame, text=str(cls["team_count"])).grid(row=row_idx, column=1, padx=10, pady=5)
            
            ctk.CTkButton(self.class_list_frame, text="E", width=30, 
                          command=lambda idx=i: self.start_edit_class(idx)).grid(row=row_idx, column=2, padx=10, pady=5)
            ctk.CTkButton(self.class_list_frame, text="X", width=30, fg_color="red", 
                                    command=lambda c=cls: self.delete_class(c)).grid(row=row_idx, column=3, padx=10, pady=5)

    def start_edit_class(self, index):
        classes = self.data_manager.get_classes()
        if index < 0 or index >= len(classes): return
        c = classes[index]
        self.class_edit_index = index
        self.entry_class_name.delete(0, 'end')
        self.entry_class_name.insert(0, c["name"])
        self.entry_team_count.delete(0, 'end')
        self.entry_team_count.insert(0, str(c["team_count"]))
        self.btn_add_class.configure(text="수정 완료 (Update)")
        self.btn_class_cancel.grid(row=0, column=3, padx=10, pady=10)

    def cancel_class_edit(self):
        self.class_edit_index = None
        self.entry_class_name.delete(0, 'end')
        self.entry_team_count.delete(0, 'end')
        self.btn_add_class.configure(text="추가 (Add)")
        self.btn_class_cancel.grid_forget()

    def add_or_update_class(self):
        name = self.entry_class_name.get()
        count = self.entry_team_count.get()
        if not name or not count: return
        try:
            count = int(count)
        except ValueError: return
            
        classes = self.data_manager.get_classes()
        new_data = {"name": name, "team_count": count}
        
        if self.class_edit_index is not None:
            classes[self.class_edit_index] = new_data
            self.cancel_class_edit()
        else:
            classes.append(new_data)
            self.entry_class_name.delete(0, 'end')
            self.entry_team_count.delete(0, 'end')
            
        self.data_manager.update_classes(classes)
        self.refresh_class_list()

    def delete_class(self, cls_to_delete):
        classes = self.data_manager.get_classes()
        classes = [c for c in classes if c["name"] != cls_to_delete["name"]]
        self.data_manager.update_classes(classes)
        self.refresh_class_list()

    # --- Students Tab ---
    def setup_students_tab(self):
        self.tab_students.grid_columnconfigure(0, weight=1)
        self.tab_students.grid_columnconfigure(1, weight=1)
        self.student_edit_index = None

        self.student_list_frame = ctk.CTkScrollableFrame(self.tab_students, width=400, height=400)
        self.student_list_frame.grid(row=0, column=0, rowspan=2, padx=10, pady=10, sticky="nsew")
        
        self.student_add_frame = ctk.CTkFrame(self.tab_students)
        self.student_add_frame.grid(row=0, column=1, padx=10, pady=10, sticky="ew")
        
        self.lbl_student_action = ctk.CTkLabel(self.student_add_frame, text="학생 추가", font=ctk.CTkFont(weight="bold"))
        self.lbl_student_action.pack(pady=5)
        
        self.entry_student_name = ctk.CTkEntry(self.student_add_frame, placeholder_text="닉네임 (Nickname)")
        self.entry_student_name.pack(pady=5, padx=10, fill="x")
        
        self.combo_student_class = ctk.CTkComboBox(self.student_add_frame, values=["반을 먼저 추가하세요"])
        self.combo_student_class.pack(pady=5, padx=10, fill="x")

        self.combo_student_role = ctk.CTkComboBox(self.student_add_frame, values=["leader", "follower"])
        self.combo_student_role.pack(pady=5, padx=10, fill="x")
        
        self.btn_student_action = ctk.CTkButton(self.student_add_frame, text="추가 (Add)", command=self.add_or_update_student)
        self.btn_student_action.pack(pady=10)
        
        self.btn_student_cancel = ctk.CTkButton(self.student_add_frame, text="취소 (Cancel)", fg_color="gray", command=self.cancel_student_edit)

        self.student_excel_frame = ctk.CTkFrame(self.tab_students)
        self.student_excel_frame.grid(row=1, column=1, padx=10, pady=10, sticky="nsew")
        
        ctk.CTkLabel(self.student_excel_frame, text="엑셀 붙여넣기 (반 행 ~ 이름 데이터)", font=ctk.CTkFont(weight="bold")).pack(pady=5)
        
        self.textbox_student_excel = ctk.CTkTextbox(self.student_excel_frame, height=150)
        self.textbox_student_excel.pack(pady=5, padx=10, fill="both", expand=True)
        
        ctk.CTkButton(self.student_excel_frame, text="엑셀 데이터 가져오기 (Import Excel)", command=self.import_student_excel).pack(pady=10)
        
        self.refresh_student_list()

    def refresh_student_list(self):
        classes = [c["name"] for c in self.data_manager.get_classes()]
        if classes:
            self.combo_student_class.configure(values=classes)
            if self.combo_student_class.get() not in classes:
                self.combo_student_class.set(classes[0])
        else:
            self.combo_student_class.configure(values=["반을 먼저 추가하세요"])
        
        for widget in self.student_list_frame.winfo_children():
            widget.destroy()

        students = self.data_manager.get_students()
        headers = ["닉네임", "반", "역할", "수정", "삭제"]
        for i, h in enumerate(headers):
            ctk.CTkLabel(self.student_list_frame, text=h, font=("Arial", 12, "bold")).grid(row=0, column=i, padx=5, pady=5)
            
        for i, s in enumerate(students):
            r = i + 1
            ctk.CTkLabel(self.student_list_frame, text=s["nickname"]).grid(row=r, column=0, padx=5, pady=2)
            ctk.CTkLabel(self.student_list_frame, text=s["class"]).grid(row=r, column=1, padx=5, pady=2)
            ctk.CTkLabel(self.student_list_frame, text=s["role"]).grid(row=r, column=2, padx=5, pady=2)
            
            ctk.CTkButton(self.student_list_frame, text="E", width=30, command=lambda idx=i: self.start_edit_student(idx)).grid(row=r, column=3, padx=5, pady=2)
            ctk.CTkButton(self.student_list_frame, text="X", width=30, fg_color="red", command=lambda x=s: self.delete_student(x)).grid(row=r, column=4, padx=5, pady=2)

    def start_edit_student(self, index):
        students = self.data_manager.get_students()
        if index < 0 or index >= len(students): return
        s = students[index]
        self.student_edit_index = index
        self.entry_student_name.delete(0, "end")
        self.entry_student_name.insert(0, s["nickname"])
        self.combo_student_class.set(s["class"])
        self.combo_student_role.set(s["role"])
        self.lbl_student_action.configure(text="학생 수정 (Edit)")
        self.btn_student_action.configure(text="수정 완료 (Update)")
        self.btn_student_cancel.pack(pady=5)

    def cancel_student_edit(self):
        self.student_edit_index = None
        self.entry_student_name.delete(0, "end")
        self.lbl_student_action.configure(text="학생 추가")
        self.btn_student_action.configure(text="추가 (Add)")
        self.btn_student_cancel.pack_forget()

    def add_or_update_student(self):
        name, cls_name, role = self.entry_student_name.get(), self.combo_student_class.get(), self.combo_student_role.get()
        if not name or cls_name == "반을 먼저 추가하세요": return
        students = self.data_manager.get_students()
        new_data = {"nickname": name, "class": cls_name, "role": role}
        if self.student_edit_index is not None:
            students[self.student_edit_index] = new_data
            self.cancel_student_edit()
        else:
            students.append(new_data)
            self.entry_student_name.delete(0, "end")
        self.data_manager.update_students(students)
        self.refresh_student_list()

    def delete_student(self, s_to_delete):
        students = [s for s in self.data_manager.get_students() if s != s_to_delete]
        self.data_manager.update_students(students)
        self.refresh_student_list()

    def import_student_excel(self):
        raw_text = self.textbox_student_excel.get("1.0", "end").strip()
        if not raw_text: return
        lines = [line.rstrip() for line in raw_text.split('\n')]
        grid = [line.split('\t') for line in lines]
        role_row_idx = next((i for i, row in enumerate(grid) if any(v.strip() in ['남', '여', '리더', '팔로워'] for v in row)), -1)
        if role_row_idx == -1:
            self.import_simple_student_csv(lines)
            return
        class_row_idx = next((i for i in range(role_row_idx) if any(cell.strip() for cell in grid[i])), -1)
        if class_row_idx == -1: return
        col_map, class_row, role_row, current_class = {}, grid[class_row_idx], grid[role_row_idx], None
        for c in range(len(role_row)):
            if c < len(class_row) and class_row[c].strip(): current_class = class_row[c].strip()
            role_str = role_row[c].strip()
            role = 'leader' if role_str in ['남', '리더'] else 'follower' if role_str in ['여', '팔로워'] else None
            if current_class and role: col_map[c] = {"class": current_class, "role": role}
        new_students = []
        for r in range(role_row_idx + 1, len(grid)):
            for c, mapping in col_map.items():
                if c < len(grid[r]) and grid[r][c].strip():
                    name = re.sub(r'\s*\(\d+\)', '', grid[r][c]).strip()
                    if name: new_students.append({"nickname": name, "class": mapping["class"], "role": mapping["role"]})
        if new_students:
            classes = self.data_manager.get_classes()
            c_names = {c["name"] for c in classes}
            for s in new_students:
                if s["class"] not in c_names:
                    classes.append({"name": s["class"], "team_count": 1})
                    c_names.add(s["class"])
            self.data_manager.update_classes(classes)
            all_students = self.data_manager.get_students()
            all_students.extend(new_students)
            self.data_manager.update_students(all_students)
            self.textbox_student_excel.delete("1.0", "end")
            self.refresh_student_list()

    def import_simple_student_csv(self, lines):
        new_students = []
        for line in lines:
            parts = [p.strip() for p in line.split(',')]
            if len(parts) >= 3: new_students.append({"nickname": parts[0], "class": parts[1], "role": parts[2]})
        if new_students:
            s = self.data_manager.get_students()
            s.extend(new_students)
            self.data_manager.update_students(s)
            self.textbox_student_excel.delete("1.0", "end")
            self.refresh_student_list()

    # --- Pairs Tab ---
    def setup_pairs_tab(self):
        self.tab_pairs.grid_columnconfigure(0, weight=1)
        self.tab_pairs.grid_columnconfigure(1, weight=1)
        self.pair_edit_index = None

        self.pair_list_frame = ctk.CTkScrollableFrame(self.tab_pairs, width=500, height=400)
        self.pair_list_frame.grid(row=0, column=0, rowspan=2, padx=10, pady=10, sticky="nsew")
        
        self.pair_add_frame = ctk.CTkFrame(self.tab_pairs)
        self.pair_add_frame.grid(row=0, column=1, padx=10, pady=10, sticky="ew")
        self.lbl_pair_action = ctk.CTkLabel(self.pair_add_frame, text="발표 페어 추가", font=ctk.CTkFont(weight="bold"))
        self.lbl_pair_action.pack(pady=5)
        
        ctk.CTkLabel(self.pair_add_frame, text="반 선택").pack(pady=(10, 0))
        self.combo_pair_class = ctk.CTkComboBox(self.pair_add_frame, values=["반을 먼저 추가하세요"], command=self.on_pair_class_selected)
        self.combo_pair_class.pack(pady=5, padx=10, fill="x")

        ctk.CTkLabel(self.pair_add_frame, text="리더 (Leader)").pack(pady=(10, 0))
        self.combo_pair_leader = ctk.CTkComboBox(self.pair_add_frame, values=[""])
        self.combo_pair_leader.pack(pady=5, padx=10, fill="x")

        ctk.CTkLabel(self.pair_add_frame, text="팔로워 (Follower)").pack(pady=(10, 0))
        self.combo_pair_follower = ctk.CTkComboBox(self.pair_add_frame, values=[""])
        self.combo_pair_follower.pack(pady=5, padx=10, fill="x")
        
        # Checkboxes
        self.check_solo = ctk.CTkCheckBox(self.pair_add_frame, text="솔로 (Solo)", command=self.on_solo_checked)
        self.check_solo.pack(pady=5, padx=10, anchor="w")
        
        self.check_opening = ctk.CTkCheckBox(self.pair_add_frame, text="오프닝 (Opening)")
        self.check_opening.pack(pady=5, padx=10, anchor="w")
        
        self.check_ending = ctk.CTkCheckBox(self.pair_add_frame, text="엔딩 (Ending)")
        self.check_ending.pack(pady=5, padx=10, anchor="w")
        
        self.btn_pair_action = ctk.CTkButton(self.pair_add_frame, text="페어 추가 (Add Pair)", command=self.add_or_update_pair)
        self.btn_pair_action.pack(pady=15)
        self.btn_pair_cancel = ctk.CTkButton(self.pair_add_frame, text="취소 (Cancel)", fg_color="gray", command=self.cancel_pair_edit)

        self.pair_excel_frame = ctk.CTkFrame(self.tab_pairs)
        self.pair_excel_frame.grid(row=1, column=1, padx=10, pady=10, sticky="nsew")
        ctk.CTkLabel(self.pair_excel_frame, text="엑셀 붙여넣기 (반 이름 행 → 페어 목록)", font=ctk.CTkFont(weight="bold")).pack(pady=5)
        self.textbox_pair_excel = ctk.CTkTextbox(self.pair_excel_frame, height=150)
        self.textbox_pair_excel.pack(pady=5, padx=10, fill="both", expand=True)
        ctk.CTkButton(self.pair_excel_frame, text="엑셀 데이터 가져오기 (Import Excel)", command=self.import_pair_excel).pack(pady=10)

        self.refresh_pair_list()

    def on_solo_checked(self):
        if self.check_solo.get():
            self.combo_pair_follower.configure(state="disabled")
            self.combo_pair_follower.set("")
        else:
            self.combo_pair_follower.configure(state="normal")
            # Restore selection logic if needed, or just leave it empty for user to pick

    def on_pair_class_selected(self, cls_name):
        students = self.data_manager.get_students()
        leaders = [s["nickname"] for s in students if s["class"] == cls_name and s["role"] == "leader"]
        followers = [s["nickname"] for s in students if s["class"] == cls_name and s["role"] == "follower"]
        self.combo_pair_leader.configure(values=leaders if leaders else [""])
        if self.pair_edit_index is None and leaders: self.combo_pair_leader.set(leaders[0])
        elif not leaders: self.combo_pair_leader.set("")
        
        # Follower list shouldn't have "Solo" as option anymore
        self.combo_pair_follower.configure(values=followers if followers else [""])
        if self.pair_edit_index is None and followers and not self.check_solo.get(): 
            self.combo_pair_follower.set(followers[0])
        elif not followers:
            self.combo_pair_follower.set("")

    def refresh_pair_list(self):
        classes = [c["name"] for c in self.data_manager.get_classes()]
        if classes:
            if self.combo_pair_class.get() not in classes:
                self.combo_pair_class.configure(values=classes)
                self.combo_pair_class.set(classes[0])
                self.on_pair_class_selected(classes[0])
            else:
                self.combo_pair_class.configure(values=classes)
        
        for widget in self.pair_list_frame.winfo_children(): widget.destroy()
        pairs = self.data_manager.get_pairs()
        headers = ["반", "리더", "팔로워", "O/E/S", "수정", "삭제"]
        for i, h in enumerate(headers): ctk.CTkLabel(self.pair_list_frame, text=h, font=("Arial", 11, "bold")).grid(row=0, column=i, padx=5, pady=5)
        for i, p in enumerate(pairs):
            r = i + 1
            info = ""
            if p.get("is_opening"): info += "O"
            if p.get("is_ending"): info += "E"
            if p.get("is_solo"): info += "S"
            
            ctk.CTkLabel(self.pair_list_frame, text=p["class"]).grid(row=r, column=0, padx=5, pady=2)
            ctk.CTkLabel(self.pair_list_frame, text=p["leader"]).grid(row=r, column=1, padx=5, pady=2)
            ctk.CTkLabel(self.pair_list_frame, text=p["follower"]).grid(row=r, column=2, padx=5, pady=2)
            ctk.CTkLabel(self.pair_list_frame, text=info).grid(row=r, column=3, padx=5, pady=2)
            ctk.CTkButton(self.pair_list_frame, text="E", width=30, command=lambda idx=i: self.start_edit_pair(idx)).grid(row=r, column=4, padx=5, pady=2)
            ctk.CTkButton(self.pair_list_frame, text="X", width=30, fg_color="red", command=lambda x=p: self.delete_pair(x)).grid(row=r, column=5, padx=5, pady=2)

    def start_edit_pair(self, index):
        p = self.data_manager.get_pairs()[index]
        self.pair_edit_index = index
        self.combo_pair_class.set(p["class"])
        self.on_pair_class_selected(p["class"])
        self.combo_pair_leader.set(p["leader"])
        
        is_solo = p.get("is_solo", False)
        if is_solo:
            self.check_solo.select()
            self.combo_pair_follower.set("")
            self.combo_pair_follower.configure(state="disabled")
        else:
            self.check_solo.deselect()
            self.combo_pair_follower.configure(state="normal")
            self.combo_pair_follower.set(p["follower"])
        
        if p.get("is_opening"): self.check_opening.select()
        else: self.check_opening.deselect()
        if p.get("is_ending"): self.check_ending.select()
        else: self.check_ending.deselect()
        
        self.lbl_pair_action.configure(text="페어 수정 (Edit)")
        self.btn_pair_action.configure(text="수정 완료 (Update)")
        self.btn_pair_cancel.pack(pady=5)

    def cancel_pair_edit(self):
        self.pair_edit_index = None
        self.lbl_pair_action.configure(text="발표 페어 추가")
        self.btn_pair_action.configure(text="페어 추가 (Add Pair)")
        self.btn_pair_cancel.pack_forget()
        self.check_solo.deselect()
        self.combo_pair_follower.configure(state="normal")
        self.check_opening.deselect()
        self.check_ending.deselect()

    def add_or_update_pair(self):
        cls, ldr, flr = self.combo_pair_class.get(), self.combo_pair_leader.get(), self.combo_pair_follower.get()
        if not cls or not ldr: return
        
        is_solo = self.check_solo.get()
        if is_solo: flr = ""
        
        p_data = {"class": cls, "leader": ldr, "follower": flr, "is_solo": is_solo, "is_opening": self.check_opening.get(), "is_ending": self.check_ending.get()}
        pairs = self.data_manager.get_pairs()
        if self.pair_edit_index is not None: pairs[self.pair_edit_index] = p_data
        else: pairs.append(p_data)
        self.cancel_pair_edit()
        self.data_manager.update_pairs(pairs)
        self.refresh_pair_list()

    def delete_pair(self, p_to_delete):
        p = [p for p in self.data_manager.get_pairs() if p != p_to_delete]
        self.data_manager.update_pairs(p)
        self.refresh_pair_list()

    def import_pair_excel(self):
        raw_text = self.textbox_pair_excel.get("1.0", "end").strip()
        if not raw_text: return
        lines, new_pairs, current_class = [l.rstrip() for l in raw_text.split('\n')], [], None
        classes = self.data_manager.get_classes()
        c_names = {c["name"] for c in classes}
        for line in lines:
            parts = [p.strip() for p in line.split('\t') if p.strip()]
            if not parts: continue
            if len(parts) == 1:
                current_class = parts[0]
                if current_class not in c_names:
                    classes.append({"name": current_class, "team_count": 1})
                    c_names.add(current_class)
            elif len(parts) >= 2 and current_class:
                l, f = re.sub(r'\s*\(\d+\)', '', parts[0]).strip(), re.sub(r'\s*\(\d+\)', '', parts[1]).strip()
                new_pairs.append({"class": current_class, "leader": l, "follower": f, "is_solo": False, "is_opening": False, "is_ending": False})
        if new_pairs:
            self.data_manager.update_classes(classes)
            all_p = self.data_manager.get_pairs()
            all_p.extend(new_pairs)
            self.data_manager.update_pairs(all_p)
            self.textbox_pair_excel.delete("1.0", "end")
            self.refresh_pair_list()

    # --- Exclusions Tab ---
    def setup_exclusions_tab(self):
        self.tab_exclusions.grid_columnconfigure(0, weight=1)
        self.tab_exclusions.grid_columnconfigure(1, weight=1)
        self.ex_list_frame = ctk.CTkScrollableFrame(self.tab_exclusions, width=400, height=400)
        self.ex_list_frame.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")
        self.ex_add_frame = ctk.CTkFrame(self.tab_exclusions)
        self.ex_add_frame.grid(row=0, column=1, padx=10, pady=10, sticky="ew")
        ctk.CTkLabel(self.ex_add_frame, text="촬영 제외 닉네임 추가", font=ctk.CTkFont(weight="bold")).pack(pady=5)
        self.entry_ex_name = ctk.CTkEntry(self.ex_add_frame, placeholder_text="닉네임 (Nickname)")
        self.entry_ex_name.pack(pady=5, padx=10, fill="x")
        ctk.CTkButton(self.ex_add_frame, text="추가 (Add)", command=self.add_exclusion).pack(pady=10)
        self.refresh_exclusion_list()

    def refresh_exclusion_list(self):
        for widget in self.ex_list_frame.winfo_children(): widget.destroy()
        for name in self.data_manager.get_photo_exclusions():
            row = ctk.CTkFrame(self.ex_list_frame, fg_color="transparent")
            row.pack(fill="x", pady=2)
            ctk.CTkLabel(row, text=name).pack(side="left", padx=10)
            ctk.CTkButton(row, text="X", width=30, fg_color="red", command=lambda n=name: self.delete_exclusion(n)).pack(side="right", padx=10)

    def add_exclusion(self):
        name = self.entry_ex_name.get().strip()
        if not name: return
        ex = self.data_manager.get_photo_exclusions()
        if name not in ex:
            ex.append(name)
            self.data_manager.update_photo_exclusions(ex)
        self.entry_ex_name.delete(0, "end")
        self.refresh_exclusion_list()

    def delete_exclusion(self, name):
        ex = [n for n in self.data_manager.get_photo_exclusions() if n != name]
        self.data_manager.update_photo_exclusions(ex)
        self.refresh_exclusion_list()
