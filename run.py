import sys
import os

# src 폴더를 path에 추가하여 모듈 import가 가능하게 함
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from main import App

if __name__ == "__main__":
    app = App()
    app.mainloop()
