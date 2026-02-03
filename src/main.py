import customtkinter as ctk
import os
import sys
from data_manager import DataManager
from ui.settings_frame import SettingsFrame
from ui.data_frame import DataFrame
from shuffler import Shuffler

# 기본 테마 설정
ctk.set_appearance_mode("System")  # Modes: "System" (standard), "Dark", "Light"
ctk.set_default_color_theme("blue")  # Themes: "blue" (standard), "green", "dark-blue"

class App(ctk.CTk):
    def __init__(self):
        super().__init__()

        # Data Manager 및 Shuffler 초기화
        self.data_manager = DataManager()
        self.shuffler = Shuffler(self.data_manager)

        # 창 설정
        self.title("Dance Lineup Shuffler")
        self.geometry("1100x800")

        # 그리드 설정 (1x2)
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(1, weight=1)

        # 네비게이션 프레임 (왼쪽)
        self.navigation_frame = ctk.CTkFrame(self, corner_radius=0)
        self.navigation_frame.grid(row=0, column=0, sticky="nsew")
        self.navigation_frame.grid_rowconfigure(5, weight=1)

        self.navigation_frame_label = ctk.CTkLabel(self.navigation_frame, text="메뉴", font=ctk.CTkFont(size=20, weight="bold"))
        self.navigation_frame_label.grid(row=0, column=0, padx=20, pady=20)

        self.home_button = ctk.CTkButton(self.navigation_frame, corner_radius=0, height=40, border_spacing=10, text="홈 (Home)",
                                         fg_color="transparent", text_color=("gray10", "gray90"), hover_color=("gray70", "gray30"),
                                         anchor="w", command=self.home_button_event)
        self.home_button.grid(row=1, column=0, sticky="ew")

        self.data_button = ctk.CTkButton(self.navigation_frame, corner_radius=0, height=40, border_spacing=10, text="데이터 관리 (Data)",
                                             fg_color="transparent", text_color=("gray10", "gray90"), hover_color=("gray70", "gray30"),
                                             anchor="w", command=self.data_button_event)
        self.data_button.grid(row=2, column=0, sticky="ew")

        self.settings_button = ctk.CTkButton(self.navigation_frame, corner_radius=0, height=40, border_spacing=10, text="설정 (Settings)",
                                             fg_color="transparent", text_color=("gray10", "gray90"), hover_color=("gray70", "gray30"),
                                             anchor="w", command=self.settings_button_event)
        self.settings_button.grid(row=3, column=0, sticky="ew")
        
        # 메인 프레임 (오른쪽) - 홈
        self.home_frame = ctk.CTkFrame(self, corner_radius=0, fg_color="transparent")
        self.home_frame.grid_columnconfigure(0, weight=1)
        self.home_frame.grid_rowconfigure(2, weight=1)

        self.home_label = ctk.CTkLabel(self.home_frame, text="댄스 발표 순서 생성기", font=ctk.CTkFont(size=24, weight="bold"))
        self.home_label.grid(row=0, column=0, padx=20, pady=20)

        self.shuffle_button = ctk.CTkButton(self.home_frame, text="발표 순서 생성하기 (Shuffle)", 
                                            font=ctk.CTkFont(size=16, weight="bold"),
                                            height=50, command=self.run_shuffle)
        self.shuffle_button.grid(row=1, column=0, padx=20, pady=10)

        self.result_container = ctk.CTkScrollableFrame(self.home_frame, label_text="생성 결과 (Result)")
        self.result_container.grid(row=2, column=0, padx=20, pady=20, sticky="nsew")

        # 설정 프레임
        self.settings_frame = SettingsFrame(self, self.data_manager)
        
        # 데이터 프레임
        self.data_frame = DataFrame(self, self.data_manager)

        # 기본 화면 로드
        self.select_frame_by_name("home")

    def run_shuffle(self):
        # 결과 창 초기화
        for widget in self.result_container.winfo_children():
            widget.destroy()

        schedule = self.shuffler.generate_schedule()
        
        if not schedule:
            ctk.CTkLabel(self.result_container, text="데이터가 부족합니다 (반 및 페어 확인)").pack(pady=20)
            return

        for i, team in enumerate(schedule):
            team_text = f"[{i+1}] {team['class']}"
            if team.get("is_opening"): team_text += " (Opening)"
            if team.get("is_ending"): team_text += " (Ending)"
            
            frame = ctk.CTkFrame(self.result_container)
            frame.pack(fill="x", pady=5, padx=5)
            
            ctk.CTkLabel(frame, text=team_text, font=ctk.CTkFont(weight="bold")).pack(side="left", padx=10)
            
            pairs_text = ", ".join([f"{p['leader']} & {p['follower'] if p['follower'] else 'Solo'}" for p in team['pairs']])
            ctk.CTkLabel(frame, text=pairs_text).pack(side="right", padx=10)

    def select_frame_by_name(self, name):
        # 버튼 색상 초기화
        self.home_button.configure(fg_color=("gray75", "gray25") if name == "home" else "transparent")
        self.data_button.configure(fg_color=("gray75", "gray25") if name == "data" else "transparent")
        self.settings_button.configure(fg_color=("gray75", "gray25") if name == "settings" else "transparent")

        # 프레임 교체
        if name == "home":
            self.home_frame.grid(row=0, column=1, sticky="nsew")
        else:
            self.home_frame.grid_forget()
            
        if name == "data":
            self.data_frame.grid(row=0, column=1, sticky="nsew")
            self.data_frame.refresh_class_list() # Ensure lists are fresh
        else:
            self.data_frame.grid_forget()

        if name == "settings":
            self.settings_frame.grid(row=0, column=1, sticky="nsew")
            self.settings_frame.load_settings()
        else:
            self.settings_frame.grid_forget()

    def home_button_event(self):
        self.select_frame_by_name("home")

    def data_button_event(self):
        self.select_frame_by_name("data")

    def settings_button_event(self):
        self.select_frame_by_name("settings")

if __name__ == "__main__":
    app = App()
    app.mainloop()
